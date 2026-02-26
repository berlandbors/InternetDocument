export const CONFIG = {
  apis: {
    archive: 'https://archive.org/advancedsearch.php',
    wikipedia: 'https://{lang}.wikipedia.org/w/api.php',
    openlibrary: 'https://openlibrary.org/search.json',
    wikimedia: 'https://commons.wikimedia.org/w/api.php',
    pixabay: 'https://pixabay.com/api/',
    pexels: 'https://api.pexels.com/v1/search',
    flickr: 'https://api.flickr.com/services/rest/'
  },
  apiKeys: {
    // Users should set their own keys
    // For demo purposes, these will return limited results
    pixabay: '', // Get free key at https://pixabay.com/api/docs/
    pexels: '', // Get free key at https://www.pexels.com/api/
    flickr: '' // Get free key at https://www.flickr.com/services/api/
  },
  defaults: {
    resultsPerPage: 50,
    cacheTimeout: 3600000,
    maxHistoryItems: 50,
    maxFavorites: 100
  }
};
