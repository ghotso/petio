const Request = require("../models/request");
const Archive = require("../models/archive");
const User = require("../models/user");
const Admin = require("../models/admin");
const Profile = require("../models/profile");
const Mailer = require("../mail/mailer");
const Sonarr = require("../services/sonarr");
const Radarr = require("../services/radarr");

class processRequest {
  constructor(req = {}, usr = {}) {
    this.request = req;
    this.user = usr;
  }
  async new() {
    let out = {};
    let quotaPass = await this.checkQuota();
    if (quotaPass) {
      try {
        let existing = await Request.findOne({ requestId: this.request.id });
        if (existing) {
          out = await this.existing();
        } else {
          out = await this.create();
        }
        if (quotaPass !== "admin") {
          let updatedUser = await User.findOneAndUpdate({ id: this.user.id }, { $inc: { quotaCount: 1 } }, { new: true, useFindAndModify: false });
          out.quota = updatedUser.quotaCount;
        }
        this.mailRequest();
      } catch (err) {
        console.log("REQ: Error");
        console.log(err);
        out = {
          message: "failed",
          error: true,
          user: this.user,
          request: this.request,
        };
      }
    } else {
      out = {
        message: `You are over your quota. Quotas reset each week.`,
        error: true,
        user: this.user,
        request: this.request,
      };
    }
    return out;
  }

  async existing() {
    let userDetails = await User.findOne({ id: this.user.id });
    if (!userDetails) {
      userDetails = await Admin.findOne({ id: this.user.id });
    }
    let profile = userDetails.profile ? await Profile.findById(this.user.profile) : false;
    let autoApprove = profile ? profile.autoApprove : false;
    await Request.updateOne({ requestId: this.request.id }, { $push: { users: this.user.id } });
    if (autoApprove) {
      await Request.updateOne({ requestId: this.request.id }, { $set: { approved: true } });
      this.sendToDvr(profile);
    }
    return {
      message: "request updated",
      user: this.user.title,
      request: this.request,
    };
  }

  async create() {
    let userDetails = await User.findOne({ id: this.user.id });
    if (!userDetails) {
      userDetails = await Admin.findOne({ id: this.user.id });
    }
    let profile = userDetails.profile ? await Profile.findById(this.user.profile) : false;
    let autoApprove = profile ? profile.autoApprove : false;

    const newRequest = new Request({
      requestId: this.request.id,
      type: this.request.type,
      title: this.request.title,
      thumb: this.request.thumb,
      users: [this.user.id],
      imdb_id: this.request.imdb_id,
      tmdb_id: this.request.tmdb_id,
      tvdb_id: this.request.tvdb_id,
      approved: autoApprove,
    });

    try {
      await newRequest.save();
      this.sendToDvr(profile);
    } catch (err) {
      console.log(err);
      return {
        message: "failed",
        error: true,
        user: this.user,
        request: this.request,
      };
    }

    return {
      message: "request added",
      user: this.user.title,
      request: this.request,
    };
  }

  async sendToDvr(profile) {
    console.log("Sending to DVR");
    // If profile is set use arrs from profile
    if (profile) {
      if (profile.radarr && this.request.type === "movie") {
        Object.keys(profile.radarr).map((r) => {
          let active = profile.radarr[r];
          if (active) {
            new Radarr(r).processRequest(this.request.id);
          }
        });
      }
      if (profile.sonarr && this.request.type === "tv") {
        Object.keys(profile.sonarr).map((s) => {
          let active = profile.sonarr[s];
          if (active) {
            new Sonarr(s).processRequest(this.request.id);
          }
        });
      }
    } else {
      // No profile set send to all arrs
      console.log("No profile");
      if (this.request.type === "tv") new Sonarr().processRequest(this.request.id);
      if (this.request.type === "movie") new Radarr().processRequest(this.request.id);
    }
  }

  async removeFromDVR() {
    if (this.request) {
      if (this.request.radarrId.length > 0 && this.request.type === "movie") {
        for (let i = 0; i < Object.keys(this.request.radarrId).length; i++) {
          let radarrIds = this.request.radarrId[i];
          let rId = radarrIds[Object.keys(radarrIds)[0]];
          let serverUuid = Object.keys(radarrIds)[0];
          let server = new Radarr(serverUuid);
          try {
            server.remove(rId);
            console.log(`REQ: ${this.request.title} removed from Radarr server - ${serverUuid}`);
          } catch (err) {
            console.log(`REQ: Error unable to remove from Radarr`, err);
          }
        }
      }
      if (this.request.sonarrId.length > 0 && this.request.type === "tv") {
        for (let i = 0; i < Object.keys(this.request.sonarrId).length; i++) {
          let sonarrIds = this.request.sonarrId[i];
          let sId = sonarrIds[Object.keys(sonarrIds)[0]];
          let serverUuid = Object.keys(sonarrIds)[0];
          let server = new Sonarr(serverUuid);
          try {
            server.remove(sId);
            console.log(`REQ: ${this.request.title} removed from Sonarr server - ${serverUuid}`);
          } catch (err) {
            console.log(`REQ: Error unable to remove from Sonarr`, err);
          }
        }
      }
    }
  }

  async mailRequest() {
    let userData = this.user;
    if (!userData.email) {
      console.log("no user email");
      return;
    }
    const requestData = this.request;
    let type = requestData.type === "tv" ? "TV Show" : "Movie";
    new Mailer().mail(
      `You've just requested the ${type} ${requestData.title}`,
      `${type}: ${requestData.title}`,
      `Your request has been received and you'll receive an email once it has been added to Plex!`,
      `https://image.tmdb.org/t/p/w500${requestData.thumb}`,
      [userData.email],
      [userData.title]
    );
  }

  async checkQuota() {
    let userDetails = await User.findOne({ id: this.user.id });
    if (!userDetails) {
      let admin = await Admin.findOne({ id: this.user.id });
      if (admin) {
        return "admin";
      }
      return false;
    }
    let userQuota = userDetails.quotaCount ? userDetails.quotaCount : 0;
    let profile = userDetails.profile ? await Profile.findById(this.user.profile) : false;
    let quotaCap = profile ? profile.quota : 0;

    console.log(userQuota, quotaCap);

    if (quotaCap > 0 && userQuota >= quotaCap) {
      return false;
    }

    return true;
  }

  async archive(complete = Boolean, removed = Boolean, reason = false) {
    console.log(this.request);
    let archiveRequest = new Archive({
      requestId: this.request.requestId,
      type: this.request.type,
      title: this.request.title,
      thumb: this.request.thumb,
      imdb_id: this.request.imdb_id,
      tmdb_id: this.request.tmdb_id,
      tvdb_id: this.request.tvdb_id,
      users: this.request.users,
      sonarrId: this.request.sonarrId,
      radarrId: this.request.radarrId,
      approved: this.request.approved,
      removed: removed ? true : false,
      removed_reason: reason,
      complete: complete ? true : false,
    });
    await archiveRequest.save();
    Request.findOneAndRemove(
      {
        requestId: this.request.requestId,
      },
      { useFindAndModify: false },
      function (err, data) {
        if (err) {
          console.log(`REQ: Archive Error: ${err}`);
        } else {
          console.log("REQ: Request Archived!");
        }
      }
    );
  }
}

module.exports = processRequest;