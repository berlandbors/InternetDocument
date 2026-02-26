import { CONFIG } from '../config.js';
import { cacheResult, getCachedResult } from './utils.js';

export async function searchArchive(query, contentType = 'all', filters = {}) {
  const { sort = 'relevance', lang, dateFrom, dateTo, page = 1 } = filters;

  // Build query using working format: +AND+ (literal plus = space in URL form-encoding)
  let q = encodeURIComponent(query);

  // Add mediatype filter if specified
  if (contentType !== 'all') {
    const mediatypeMap = {
      'texts': 'texts',
      'image': 'image',
      'audio': 'audio',
      'video': 'movies',
      'movies': 'movies',
      'article': 'texts'
    };
    const mediatype = mediatypeMap[contentType] || contentType;
    q += `+AND+mediatype:${mediatype}`;
  }

  // Add language filter
  if (lang) {
    q += `+AND+language:${lang}`;
  }

  // Add date range filter
  if (dateFrom) {
    q += `+AND+date:[${dateFrom}+TO+${dateTo || '*'}]`;
  }

  // Sort parameter: use literal + (not %20) so archive.org receives e.g. "downloads desc"
  let sortParam = '';
  if (sort === 'date') {
    sortParam = 'date+desc';
  } else if (sort === 'popular') {
    sortParam = 'downloads+desc';
  }
  // sort === 'relevance': leave sortParam empty (archive.org default)

  const rows = 50;

  // Use single comma-separated fl[] and literal + signs in the URL (working format)
  let url = `${CONFIG.apis.archive}?q=${q}&fl[]=identifier,title,creator,description,date,mediatype&rows=${rows}&output=json`;

  if (sortParam) {
    url += `&sort[]=${sortParam}`;
  }

  if (page > 1) {
    url += `&page=${page}`;
  }

  console.log('🔍 [Archive] Query:', q);
  console.log('🔍 [Archive] Type:', contentType, '| Sort:', sort, '| Page:', page);
  console.log('🌐 [Archive] URL:', url);

  const cacheKey = `archive_${url}`;
  const cached = getCachedResult(cacheKey);
  if (cached) {
    console.log('✅ [Archive] Cache hit:', cached.length, 'results');
    return cached;
  }

  try {
    const resp = await fetch(url);
    console.log('📡 [Archive] Response:', resp.status, resp.statusText);

    if (!resp.ok) {
      throw new Error(`Archive API returned ${resp.status} ${resp.statusText}`);
    }

    const json = await resp.json();
    const docs = json.response?.docs || [];
    const numFound = json.response?.numFound || 0;

    console.log(`✅ [Archive] Found: ${numFound} total, returning ${docs.length} docs`);

    if (docs.length === 0) {
      console.warn('⚠️ [Archive] No results for query:', q);
    }

    const results = docs.map(doc => ({
      id: doc.identifier,
      title: Array.isArray(doc.title) ? doc.title[0] : (doc.title || 'Untitled'),
      description: Array.isArray(doc.description) ? doc.description[0] : (doc.description || ''),
      author: Array.isArray(doc.creator) ? doc.creator.join(', ') : (doc.creator || 'Unknown'),
      date: doc.date || '',
      type: doc.mediatype || 'texts',
      source: 'archive',
      url: `https://archive.org/details/${doc.identifier}`,
      thumbnail: `https://archive.org/services/img/${doc.identifier}`,
      mediaType: doc.mediatype
    }));

    cacheResult(cacheKey, results, CONFIG.defaults.cacheTimeout);
    return results;

  } catch (err) {
    console.error('❌ [Archive] Error:', err.message);
    console.error('❌ [Archive] Failed URL:', url);
    return [];
  }
}
