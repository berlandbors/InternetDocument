import { CONFIG } from '../config.js';
import { cacheResult, getCachedResult } from './utils.js';

export async function searchPexels(query, filters = {}) {
  const { page = 1 } = filters;
  const apiKey = CONFIG.apiKeys?.pexels || 'DEMO_KEY';

  const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=50&page=${page}`;

  console.log('🔍 [Pexels] Searching:', query);

  const cacheKey = `pexels_${url}`;
  const cached = getCachedResult(cacheKey);
  if (cached) return cached;

  try {
    const resp = await fetch(url, {
      headers: { 'Authorization': apiKey }
    });
    console.log('📡 [Pexels] Response:', resp.status);

    if (!resp.ok) throw new Error(`Pexels API error: ${resp.status}`);

    const json = await resp.json();
    const photos = json.photos || [];

    console.log('✅ [Pexels] Found:', photos.length, 'images');

    const results = photos.map(photo => ({
      id: photo.id.toString(),
      title: photo.alt || 'Фото',
      description: `By ${photo.photographer}`,
      author: photo.photographer,
      date: '',
      type: 'image',
      source: 'pexels',
      url: photo.url,
      thumbnail: photo.src.medium,
      fullImage: photo.src.large2x,
      width: photo.width,
      height: photo.height
    }));

    cacheResult(cacheKey, results, CONFIG.defaults.cacheTimeout);
    return results;
  } catch (err) {
    console.error('❌ [Pexels] Error:', err.message);
    return [];
  }
}
