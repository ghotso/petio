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
const { getAllVariants } = require("../util/germanCharMap");

async function search(term) {
  logger.log("verbose", `TMDB Search ${term}`);

  // Get all possible variants of the search term
  const searchTerms = getAllVariants(term);
  logger.log("debug", `Search variants: ${searchTerms.join(', ')}`);

  // Search with all variants
  const searchPromises = searchTerms.map(async (searchTerm) => {
    const sanitizedTerm = sanitize(searchTerm);
    return Promise.all([
      searchMovies(sanitizedTerm),
      searchShows(sanitizedTerm),
      searchPeople(sanitizedTerm),
      searchCompanies(sanitizedTerm),
    ]);
  });

  const allResults = await Promise.all(searchPromises);

  // Merge and deduplicate results
  const movies = mergeResults(allResults.map(result => result[0].results));
  const shows = mergeResults(allResults.map(result => result[1].results));
  const people = mergeResults(allResults.map(result => result[2].results));
  const companies = mergeResults(allResults.map(result => result[3].results));

  // Process movie results
  await Promise.map(
    movies,
    async (result, i) => {
      movieLookup(result.id, true);
      let res = await onServer("movie", false, false, result.id);
      movies[i].on_server = res.exists;
    },
    { concurrency: 10 }
  );

  // Process show results
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
      if (!item || seen.has(item.id)) {
        return false;
      }
      seen.add(item.id);
      return true;
    })
    .sort((a, b) => {
      // Sort by popularity if available
      if (a.popularity && b.popularity) {
        return b.popularity - a.popularity;
      }
      return 0;
    });
}

async function searchMovies(term) {
  const config = getConfig();
  const tmdbApikey = config.tmdbApi;
  const tmdb = "https://api.themoviedb.org/3/";
  let url = `${tmdb}search/movie?query=${encodeURIComponent(term)}&language=de-DE&include_adult=false&api_key=${tmdbApikey}&append_to_response=credits,videos`;
  try {
    let res = await axios.get(url, { httpAgent: agent });
    return res.data;
  } catch (err) {
    logger.error(`Error searching for movies with term: ${term}`);
    return {
      results: [],
    };
  }
}

async function searchShows(term) {
  const config = getConfig();
  const tmdbApikey = config.tmdbApi;
  const tmdb = "https://api.themoviedb.org/3/";
  let url = `${tmdb}search/tv?query=${encodeURIComponent(term)}&language=de-DE&include_adult=false&api_key=${tmdbApikey}&append_to_response=credits,videos`;
  try {
    let res = await axios.get(url, { httpAgent: agent });
    return res.data;
  } catch (err) {
    logger.error(`Error searching for shows with term: ${term}`);
    return {
      results: [],
    };
  }
}

async function searchPeople(term) {
  const config = getConfig();
  const tmdbApikey = config.tmdbApi;
  const tmdb = "https://api.themoviedb.org/3/";
  let url = `${tmdb}search/person?query=${encodeURIComponent(term)}&language=de-DE&include_adult=false&api_key=${tmdbApikey}&append_to_response=credits,videos`;
  try {
    let res = await axios.get(url, { httpAgent: agent });
    return res.data;
  } catch (err) {
    logger.error(`Error searching for people with term: ${term}`);
    return {
      results: [],
    };
  }
}

async function searchCompanies(term) {
  const config = getConfig();
  const tmdbApikey = config.tmdbApi;
  const tmdb = "https://api.themoviedb.org/3/";
  let url = `${tmdb}search/company?query=${encodeURIComponent(term)}&language=de-DE&api_key=${tmdbApikey}`;
  try {
    let res = await axios.get(url, { httpAgent: agent });
    return res.data;
  } catch (err) {
    logger.error(`Error searching for companies with term: ${term}`);
    return {
      results: [],
    };
  }
}

module.exports = search;