import { cacheResult, getCachedResult, stripHtml } from './utils.js';

export async function searchWikipedia(query, filters = {}) {
  const { lang = 'en', limit = 20 } = filters;
  const url = `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=${limit}&format=json&origin=*`;

  const cacheKey = `wikipedia_${url}`;
  const cached = getCachedResult(cacheKey);
  if (cached) return cached;

  try {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Wikipedia API error: ${resp.status}`);
    const json = await resp.json();
    const items = json.query?.search || [];
    const results = items.map(item => ({
      id: String(item.pageid),
      title: item.title || 'Без названия',
      description: stripHtml(item.snippet || ''),
      author: 'Wikipedia',
      date: item.timestamp || '',
      type: 'article',
      source: 'wikipedia',
      url: `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(item.title)}`,
      thumbnail: null
    }));
    cacheResult(cacheKey, results, 3600000);
    return results;
  } catch (err) {
    console.error('searchWikipedia error:', err);
    return [];
  }
}
