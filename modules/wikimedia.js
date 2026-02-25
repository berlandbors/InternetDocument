import { cacheResult, getCachedResult, stripHtml } from './utils.js';

export async function searchWikimedia(query, filters = {}) {
  const url = `https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srnamespace=6&format=json&origin=*&srlimit=20`;

  const cacheKey = `wikimedia_${url}`;
  const cached = getCachedResult(cacheKey);
  if (cached) return cached;

  try {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Wikimedia API error: ${resp.status}`);
    const json = await resp.json();
    const items = json.query?.search || [];

    const results = await Promise.all(items.map(async item => {
      let thumbnail = null;
      try {
        const thumbUrl = `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(item.title)}&prop=imageinfo&iiprop=url|thumburl&iiurlwidth=300&format=json&origin=*`;
        const thumbResp = await fetch(thumbUrl);
        if (thumbResp.ok) {
          const thumbJson = await thumbResp.json();
          const pages = thumbJson.query?.pages || {};
          const page = Object.values(pages)[0];
          thumbnail = page?.imageinfo?.[0]?.thumburl || null;
        }
      } catch {}

      return {
        id: String(item.pageid),
        title: item.title || 'Без названия',
        description: stripHtml(item.snippet || ''),
        author: 'Wikimedia Commons',
        date: item.timestamp || '',
        type: 'media',
        source: 'wikimedia',
        url: `https://commons.wikimedia.org/wiki/${encodeURIComponent(item.title)}`,
        thumbnail
      };
    }));

    cacheResult(cacheKey, results, 3600000);
    return results;
  } catch (err) {
    console.error('searchWikimedia error:', err);
    return [];
  }
}
