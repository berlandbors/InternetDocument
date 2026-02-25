import { cacheResult, getCachedResult } from './utils.js';

export async function searchOpenLibrary(query, filters = {}) {
  const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=20`;

  const cacheKey = `openlibrary_${url}`;
  const cached = getCachedResult(cacheKey);
  if (cached) return cached;

  try {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`OpenLibrary API error: ${resp.status}`);
    const json = await resp.json();
    const docs = json.docs || [];
    const results = docs.map(doc => ({
      id: doc.key || String(doc.cover_i),
      title: doc.title || 'Без названия',
      description: doc.first_sentence?.value || doc.subtitle || '',
      author: doc.author_name ? doc.author_name.join(', ') : '',
      date: doc.first_publish_year ? String(doc.first_publish_year) : '',
      type: 'book',
      source: 'openlibrary',
      url: `https://openlibrary.org${doc.key}`,
      thumbnail: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : null
    }));
    cacheResult(cacheKey, results, 3600000);
    return results;
  } catch (err) {
    console.error('searchOpenLibrary error:', err);
    return [];
  }
}
