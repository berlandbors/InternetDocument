import { CONFIG } from '../config.js';
import { cacheResult, getCachedResult } from './utils.js';

export async function searchPixabay(query, filters = {}) {
  const { page = 1 } = filters;
  const apiKey = CONFIG.apiKeys?.pixabay || 'DEMO_KEY';

  const url = `https://pixabay.com/api/?key=${apiKey}&q=${encodeURIComponent(query)}&image_type=photo&per_page=50&page=${page}`;

  console.log('🔍 [Pixabay] Searching:', query);

  const cacheKey = `pixabay_${url}`;
  const cached = getCachedResult(cacheKey);
  if (cached) {
    console.log('✅ [Pixabay] Cache hit:', cached.length, 'results');
    return cached;
  }

  try {
    const resp = await fetch(url);
    console.log('📡 [Pixabay] Response:', resp.status);

    if (!resp.ok) throw new Error(`Pixabay API error: ${resp.status}`);

    const json = await resp.json();
    const hits = json.hits || [];

    console.log('✅ [Pixabay] Found:', hits.length, 'images');

    const results = hits.map(img => ({
      id: img.id.toString(),
      title: img.tags || 'Фото',
      description: `${img.likes} likes • ${img.views} views`,
      author: img.user || 'Unknown',
      date: '',
      type: 'image',
      source: 'pixabay',
      url: img.pageURL,
      thumbnail: img.webformatURL,
      fullImage: img.largeImageURL,
      width: img.imageWidth,
      height: img.imageHeight
    }));

    cacheResult(cacheKey, results, CONFIG.defaults.cacheTimeout);
    return results;
  } catch (err) {
    console.error('❌ [Pixabay] Error:', err.message);
    return [];
  }
}
