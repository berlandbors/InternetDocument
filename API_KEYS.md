# 🔑 API Keys Setup

This project uses free APIs for image search. You need to get your own API keys:

## Pixabay
1. Visit https://pixabay.com/api/docs/
2. Sign up for free account
3. Copy your API key
4. Add to `config.js`: `apiKeys.pixabay = 'YOUR_KEY'`
- **Limit**: 100 requests/minute
- **Free forever**

## Pexels
1. Visit https://www.pexels.com/api/
2. Sign up for free account
3. Copy your API key
4. Add to `config.js`: `apiKeys.pexels = 'YOUR_KEY'`
- **Limit**: 200 requests/hour
- **Free forever**

## Flickr
1. Visit https://www.flickr.com/services/api/
2. Sign up and create an app
3. Copy your API key
4. Add to `config.js`: `apiKeys.flickr = 'YOUR_KEY'`
- **Limit**: 3600 requests/hour
- **Free forever**

## Note
Without API keys, image sources will return limited or no results. All other sources (Archive.org, Wikipedia, etc.) work without keys.
