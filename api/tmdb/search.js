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
  logger.log("verbose", `TMDB Search original term: ${term}`);

  // Try both the original term and a sanitized version
  const searchTerms = [
    term,                   // Original term with umlauts
    term.replace(/ü/g, 'ue').replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ß/g, 'ss') // ASCII version
  ];

  logger.log("debug", `Search terms to try: ${JSON.stringify(searchTerms)}`);

  let allResults = {
    movies: [],
    shows: [],
    people: [],
    companies: []
  };

  // Try each search term
  for (const searchTerm of searchTerms) {
    const [movies, shows, people, companies] = await Promise.all([
      searchMovies(searchTerm),
      searchShows(searchTerm),
      searchPeople(searchTerm),
      searchCompanies(searchTerm),
    ]);

    // Merge results, avoiding duplicates
    allResults.movies = mergeResults([...allResults.movies, ...movies.results]);
    allResults.shows = mergeResults([...allResults.shows, ...shows.results]);
    allResults.people = mergeResults([...allResults.people, ...people.results]);
    allResults.companies = mergeResults([...allResults.companies, ...companies.results]);
  }

  // Process movie results
  await Promise.map(
    allResults.movies,
    async (result, i) => {
      movieLookup(result.id, true);
      let res = await onServer("movie", false, false, result.id);
      allResults.movies[i].on_server = res.exists;
    },
    { concurrency: 10 }
  );

  // Process show results
  await Promise.map(
    allResults.shows,
    async (result, i) => {
      showLookup(result.id, true);
      let res = await onServer("show", false, false, result.id);
      allResults.shows[i].on_server = res.exists;
    },
    { concurrency: 10 }
  );

  return allResults;
}

// Helper function to merge and deduplicate results
function mergeResults(results) {
  const seen = new Set();
  return results.filter(item => {
    if (!item || seen.has(item.id)) {
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

  const headers = {
    'Accept': 'application/json',
    'Content-Type': 'application/json; charset=utf-8'
  };

  const encodedTerm = encodeURIComponent(term);
  const url = `${tmdb}search/movie?query=${encodedTerm}&language=de-DE&include_adult=false&api_key=${tmdbApikey}&append_to_response=credits,videos`;
  
  logger.log("debug", `Making movie search request with term: ${term}`);
  logger.log("debug", `Encoded URL: ${url}`);

  try {
    let res = await axios.get(url, { 
      httpAgent: agent,
      headers: headers,
      responseType: 'json',
      responseEncoding: 'utf8'
    });
    logger.log("debug", `Movie search results count: ${res.data.results.length}`);
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

  const encodedTerm = encodeURIComponent(term);
  const url = `${tmdb}search/tv?query=${encodedTerm}&language=de-DE&include_adult=false&api_key=${tmdbApikey}&append_to_response=credits,videos`;

  logger.log("debug", `Making TV search request with term: ${term}`);

  try {
    let res = await axios.get(url, { 
      httpAgent: agent,
      headers: headers,
      responseType: 'json',
      responseEncoding: 'utf8'
    });
    logger.log("debug", `TV search results count: ${res.data.results.length}`);
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

  const encodedTerm = encodeURIComponent(term);
  const url = `${tmdb}search/person?query=${encodedTerm}&language=de-DE&include_adult=false&api_key=${tmdbApikey}&append_to_response=credits,videos`;

  logger.log("debug", `Making person search request with term: ${term}`);

  try {
    let res = await axios.get(url, { 
      httpAgent: agent,
      headers: headers,
      responseType: 'json',
      responseEncoding: 'utf8'
    });
    logger.log("debug", `Person search results count: ${res.data.results.length}`);
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

  const encodedTerm = encodeURIComponent(term);
  const url = `${tmdb}search/company?query=${encodedTerm}&language=de-DE&api_key=${tmdbApikey}`;

  logger.log("debug", `Making company search request with term: ${term}`);

  try {
    let res = await axios.get(url, { 
      httpAgent: agent,
      headers: headers,
      responseType: 'json',
      responseEncoding: 'utf8'
    });
    logger.log("debug", `Company search results count: ${res.data.results.length}`);
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