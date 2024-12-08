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
const convertGermanChars = require("../util/germanCharMap");

async function search(term) {
  logger.log("verbose", `TMDB Search ${term}`);

  // Convert the search term to handle German special characters
  const normalizedTerm = convertGermanChars(term);
  
  // If the normalized term is different from the original, search both
  const searchTerms = normalizedTerm !== term ? [term, normalizedTerm] : [term];
  
  let allResults = await Promise.map(searchTerms, async (searchTerm) => {
    return Promise.all([
      searchMovies(sanitize(searchTerm)),
      searchShows(sanitize(searchTerm)),
      searchPeople(sanitize(searchTerm)),
      searchCompanies(sanitize(searchTerm)),
    ]);
  });

  // Merge and deduplicate results
  let movies = mergeResults(allResults.map(result => result[0].results));
  let shows = mergeResults(allResults.map(result => result[1].results));
  let people = mergeResults(allResults.map(result => result[2].results));
  let companies = mergeResults(allResults.map(result => result[3].results));

  await Promise.map(
    movies,
    async (result, i) => {
      movieLookup(result.id, true);
      let res = await onServer("movie", false, false, result.id);
      movies[i].on_server = res.exists;
    },
    { concurrency: 10 }
  );

  await Promise.map(
    shows,
    async (result, i) => {
      showLookup(result.id, true);
      let res = await onServer("show", false, false, result.id);
      shows[i].on_server = res.exists;
    },
    { concurrency: 10 }
  );

  return {
    movies: movies,
    shows: shows,
    people: people,
    companies: companies,
  };
}

// Helper function to merge and deduplicate results
function mergeResults(resultsArrays) {
  const seen = new Set();
  return resultsArrays
    .flat()
    .filter(item => {
      if (seen.has(item.id)) {
        return false;
      }
      seen.add(item.id);
      return true;
    });
}

async function searchMovies(term) {
  const config = getConfig();
  const tmdbApikey = config.tmdbApi;
  const tmdb = "https://api.themoviedb.org/3/";
  let url = `${tmdb}search/movie?query=${term}&language=de-DE&include_adult=false&api_key=${tmdbApikey}&append_to_response=credits,videos`;
  try {
    let res = await axios.get(url, { httpAgent: agent });
    return res.data;
  } catch (err) {
    logger.error("Error searching for movies");
    return {
      results: [],
    };
  }
}

async function searchShows(term) {
  const config = getConfig();
  const tmdbApikey = config.tmdbApi;
  const tmdb = "https://api.themoviedb.org/3/";
  let url = `${tmdb}search/tv?query=${term}&language=de-DE&include_adult=false&api_key=${tmdbApikey}&append_to_response=credits,videos`;
  try {
    let res = await axios.get(url, { httpAgent: agent });
    return res.data;
  } catch (err) {
    logger.error("Error searching for shows");
    return {
      results: [],
    };
  }
}

async function searchPeople(term) {
  const config = getConfig();
  const tmdbApikey = config.tmdbApi;
  const tmdb = "https://api.themoviedb.org/3/";
  let url = `${tmdb}search/person?query=${term}&language=de-DE&include_adult=false&api_key=${tmdbApikey}&append_to_response=credits,videos`;
  try {
    let res = await axios.get(url, { httpAgent: agent });
    return res.data;
  } catch (err) {
    logger.error("Error searching for people");
    return {
      results: [],
    };
  }
}

async function searchCompanies(term) {
  const config = getConfig();
  const tmdbApikey = config.tmdbApi;
  const tmdb = "https://api.themoviedb.org/3/";
  let url = `${tmdb}search/company?query=${term}&language=de-DE&api_key=${tmdbApikey}`;
  try {
    let res = await axios.get(url, { httpAgent: agent });
    return res.data;
  } catch (err) {
    logger.error("Error searching for companies");
    return {
      results: [],
    };
  }
}

module.exports = search;