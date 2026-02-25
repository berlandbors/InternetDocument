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
  const url = `${CONFIG.apis.archive}?q=${encodeURIComponent(q)}&fl[]=identifier,title,description,creator,date,mediatype&rows=${rows}&start=${start}&output=json&sort[]=${encodeURIComponent(sortParam)}`;

  const cacheKey = `archive_${url}`;
  const cached = getCachedResult(cacheKey);
  if (cached) return cached;

  try {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Archive API error: ${resp.status}`);
    const json = await resp.json();
    const docs = json.response?.docs || [];
    const results = docs.map(doc => ({
      id: doc.identifier,
      title: doc.title || 'Без названия',
      description: doc.description || '',
      author: doc.creator || '',
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
    console.error('searchArchive error:', err);
    return [];
  }
}
