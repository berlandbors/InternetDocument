import { CONFIG } from '../config.js';
import { cacheResult, getCachedResult } from './utils.js';

export async function searchFlickr(query, filters = {}) {
  const { page = 1 } = filters;
  const apiKey = CONFIG.apiKeys?.flickr || 'DEMO_KEY';

  const url = `https://api.flickr.com/services/rest/?method=flickr.photos.search&api_key=${apiKey}&text=${encodeURIComponent(query)}&per_page=50&page=${page}&format=json&nojsoncallback=1&extras=owner_name,url_m,url_l`;

  console.log('🔍 [Flickr] Searching:', query);

  const cacheKey = `flickr_${url}`;
  const cached = getCachedResult(cacheKey);
  if (cached) return cached;

  try {
    const resp = await fetch(url);
    console.log('📡 [Flickr] Response:', resp.status);

    if (!resp.ok) throw new Error(`Flickr API error: ${resp.status}`);

    const json = await resp.json();
    const photos = json.photos?.photo || [];

    console.log('✅ [Flickr] Found:', photos.length, 'images');

    const results = photos.map(photo => ({
      id: photo.id,
      title: photo.title || 'Фото',
      description: '',
      author: photo.ownername || 'Unknown',
      date: '',
      type: 'image',
      source: 'flickr',
      url: `https://www.flickr.com/photos/${photo.owner}/${photo.id}`,
      thumbnail: photo.url_m,
      fullImage: photo.url_l,
      width: 0,
      height: 0
    }));

    cacheResult(cacheKey, results, CONFIG.defaults.cacheTimeout);
    return results;
  } catch (err) {
    console.error('❌ [Flickr] Error:', err.message);
    return [];
  }
}
