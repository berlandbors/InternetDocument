import { CONFIG } from '../config.js';
import { cacheResult, getCachedResult } from './utils.js';

export async function searchArchive(query, contentType = 'all', filters = {}) {
  const { sort = 'relevance', lang, dateFrom, dateTo, page = 1 } = filters;
  const mediaType = contentType === 'all' ? '' : contentType;
  const rows = 20;
  const start = (page - 1) * rows;

  let q = query;
  if (mediaType) q += ` AND mediatype:${mediaType}`;
  if (lang) q += ` AND language:${lang}`;
  if (dateFrom) q += ` AND date:[${dateFrom} TO ${dateTo || '*'}]`;

  const sortParam = sort === 'date' ? 'date desc' : sort === 'popular' ? 'downloads desc' : 'relevance';
  const url = `${CONFIG.apis.archive}?q=${encodeURIComponent(q)}&fl[]=identifier&fl[]=title&fl[]=description&fl[]=creator&fl[]=date&fl[]=mediatype&rows=${rows}&start=${start}&output=json&sort[]=${encodeURIComponent(sortParam)}`;

  console.log('[Archive] Searching:', query, '| URL:', url);

  const cacheKey = `archive_${url}`;
  const cached = getCachedResult(cacheKey);
  if (cached) {
    console.log('[Archive] Cache hit, returning', cached.length, 'results');
    return cached;
  }

  const parseDoc = doc => ({
    id: doc.identifier,
    title: Array.isArray(doc.title) ? doc.title[0] : (doc.title || 'Untitled'),
    description: Array.isArray(doc.description) ? doc.description[0] : (doc.description || ''),
    author: Array.isArray(doc.creator) ? doc.creator.join(', ') : (doc.creator || ''),
    date: doc.date || '',
    type: doc.mediatype || 'texts',
    source: 'archive',
    url: `https://archive.org/details/${doc.identifier}`,
    thumbnail: `https://archive.org/services/img/${doc.identifier}`,
    mediaType: doc.mediatype
  });

  try {
    console.log('[Archive] Fetching primary URL...');
    const resp = await fetch(url);
    console.log('[Archive] Response status:', resp.status, resp.statusText);
    if (!resp.ok) throw new Error(`Archive API error: ${resp.status}`);
    const json = await resp.json();
    console.log('[Archive] Response numFound:', json.response?.numFound, '| docs:', json.response?.docs?.length);
    const docs = json.response?.docs || [];
    const results = docs.map(parseDoc);
    console.log('[Archive] Parsed', results.length, 'results');
    cacheResult(cacheKey, results, CONFIG.defaults.cacheTimeout);
    return results;
  } catch (err) {
    console.warn('[Archive] Primary request failed:', err.message, '— trying fallback...');
    // Fallback: strip optional filters to maximise compatibility
    try {
      const fallbackUrl = `${CONFIG.apis.archive}?q=${encodeURIComponent(query)}&output=json&rows=${rows}&start=${start}`;
      console.log('[Archive] Fallback URL:', fallbackUrl);
      const resp2 = await fetch(fallbackUrl);
      console.log('[Archive] Fallback response status:', resp2.status);
      if (!resp2.ok) throw new Error(`Archive fallback error: ${resp2.status}`);
      const json2 = await resp2.json();
      console.log('[Archive] Fallback numFound:', json2.response?.numFound, '| docs:', json2.response?.docs?.length);
      const docs2 = json2.response?.docs || [];
      const results2 = docs2.map(parseDoc);
      console.log('[Archive] Fallback parsed', results2.length, 'results');
      cacheResult(cacheKey, results2, CONFIG.defaults.cacheTimeout);
      return results2;
    } catch (fallbackErr) {
      console.error('[Archive] Both primary and fallback failed:', fallbackErr.message);
      return [];
    }
  }
}
