export const CONFIG = {
  apis: {
    archive: 'https://archive.org/advancedsearch.php',
    wikipedia: 'https://{lang}.wikipedia.org/w/api.php',
    unsplash: 'https://api.unsplash.com/search/photos',
    openlibrary: 'https://openlibrary.org/search.json',
    wikimedia: 'https://commons.wikimedia.org/w/api.php'
  },
  defaults: {
    resultsPerPage: 50,
    cacheTimeout: 3600000,
    maxHistoryItems: 50,
    maxFavorites: 100
  }
};
