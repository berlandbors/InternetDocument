import { cacheResult, getCachedResult } from './utils.js';

const CLIENT_ID = 's2Qvf-xYSeSv0MjRgY-T8yqaB4hkqYLr4o-1hQFOVY4';

export async function searchUnsplash(query, filters = {}) {
  const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=20&client_id=${CLIENT_ID}`;

  const cacheKey = `unsplash_${url}`;
  const cached = getCachedResult(cacheKey);
  if (cached) return cached;

  try {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Unsplash API error: ${resp.status}`);
    const json = await resp.json();
    const photos = json.results || [];
    const results = photos.map(photo => ({
      id: photo.id,
      title: photo.alt_description || photo.description || 'Фото',
      description: photo.description || '',
      author: photo.user?.name || '',
      date: photo.created_at || '',
      type: 'image',
      source: 'unsplash',
      url: photo.links?.html || '',
      thumbnail: photo.urls?.small || ''
    }));
    cacheResult(cacheKey, results, 3600000);
    return results;
  } catch (err) {
    console.error('searchUnsplash error:', err);
    return [];
  }
}
