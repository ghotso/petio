const http = require("http");
const agent = new http.Agent({ family: 4 });
const axios = require("axios");
const Promise = require("bluebird");

// Config
const getConfig = require("../util/config");
const onServer = require("../plex/onServer");
const sanitize = require("sanitize-filename");
const logger = require("../util/logger");
const { movieLookup } = require("../tmdb/movie");
const { showLookup } = require("../tmdb/show");

async function search(term) {
  logger.log("verbose", `TMDB Search ${term}`);

  // Ensure proper UTF-8 encoding
  const encodedTerm = encodeURIComponent(term);
  logger.log("debug", `Encoded search term: ${encodedTerm}`);

  const [movies, shows, people, companies] = await Promise.all([
    searchMovies(term),
    searchShows(term),
    searchPeople(term),
    searchCompanies(term),
  ]);

  // Process movie results
  await Promise.map(
    movies.results,
    async (result, i) => {
      movieLookup(result.id, true);
      let res = await onServer("movie", false, false, result.id);
      movies.results[i].on_server = res.exists;
    },
    { concurrency: 10 }
  );

  // Process show results
  await Promise.map(
    shows.results,
    async (result, i) => {
      showLookup(result.id, true);
      let res = await onServer("show", false, false, result.id);
      shows.results[i].on_server = res.exists;
    },
    { concurrency: 10 }
  );

  return {
    movies: movies.results,
    shows: shows.results,
    people: people.results,
    companies: companies.results,
  };
}

async function searchMovies(term) {
  const config = getConfig();
  const tmdbApikey = config.tmdbApi;
  const tmdb = "https://api.themoviedb.org/3/";
  
  // Set proper headers for UTF-8
  const headers = {
    'Accept': 'application/json',
    'Content-Type': 'application/json; charset=utf-8'
  };

  let url = `${tmdb}search/movie?query=${encodeURIComponent(term)}&language=de-DE&include_adult=false&api_key=${tmdbApikey}&append_to_response=credits,videos`;
  
  try {
    let res = await axios.get(url, { 
      httpAgent: agent,
      headers: headers,
      responseType: 'json',
      responseEncoding: 'utf8'
    });
    return res.data;
  } catch (err) {
    logger.error(`Error searching for movies with term: ${term}`);
    logger.error(err.message);
    return {
      results: [],
    };
  }
}

async function searchShows(term) {
  const config = getConfig();
  const tmdbApikey = config.tmdbApi;
  const tmdb = "https://api.themoviedb.org/3/";
  
  const headers = {
    'Accept': 'application/json',
    'Content-Type': 'application/json; charset=utf-8'
  };

  let url = `${tmdb}search/tv?query=${encodeURIComponent(term)}&language=de-DE&include_adult=false&api_key=${tmdbApikey}&append_to_response=credits,videos`;
  
  try {
    let res = await axios.get(url, { 
      httpAgent: agent,
      headers: headers,
      responseType: 'json',
      responseEncoding: 'utf8'
    });
    return res.data;
  } catch (err) {
    logger.error(`Error searching for shows with term: ${term}`);
    logger.error(err.message);
    return {
      results: [],
    };
  }
}

async function searchPeople(term) {
  const config = getConfig();
  const tmdbApikey = config.tmdbApi;
  const tmdb = "https://api.themoviedb.org/3/";
  
  const headers = {
    'Accept': 'application/json',
    'Content-Type': 'application/json; charset=utf-8'
  };

  let url = `${tmdb}search/person?query=${encodeURIComponent(term)}&language=de-DE&include_adult=false&api_key=${tmdbApikey}&append_to_response=credits,videos`;
  
  try {
    let res = await axios.get(url, { 
      httpAgent: agent,
      headers: headers,
      responseType: 'json',
      responseEncoding: 'utf8'
    });
    return res.data;
  } catch (err) {
    logger.error(`Error searching for people with term: ${term}`);
    logger.error(err.message);
    return {
      results: [],
    };
  }
}

async function searchCompanies(term) {
  const config = getConfig();
  const tmdbApikey = config.tmdbApi;
  const tmdb = "https://api.themoviedb.org/3/";
  
  const headers = {
    'Accept': 'application/json',
    'Content-Type': 'application/json; charset=utf-8'
  };

  let url = `${tmdb}search/company?query=${encodeURIComponent(term)}&language=de-DE&api_key=${tmdbApikey}`;
  
  try {
    let res = await axios.get(url, { 
      httpAgent: agent,
      headers: headers,
      responseType: 'json',
      responseEncoding: 'utf8'
    });
    return res.data;
  } catch (err) {
    logger.error(`Error searching for companies with term: ${term}`);
    logger.error(err.message);
    return {
      results: [],
    };
  }
}

module.exports = search;