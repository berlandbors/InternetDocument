const MAX_HISTORY = 50;
const MAX_FAVORITES = 100;

export function saveToHistory(query) {
  let history = loadHistory();
  history = history.filter(q => q !== query);
  history.unshift(query);
  if (history.length > MAX_HISTORY) history = history.slice(0, MAX_HISTORY);
  try { localStorage.setItem('search_history', JSON.stringify(history)); } catch {}
}

export function loadHistory() {
  try { return JSON.parse(localStorage.getItem('search_history') || '[]'); } catch { return []; }
}

export function saveToFavorites(item) {
  let favs = loadFavorites();
  if (favs.some(f => f.url === item.url)) return;
  favs.unshift(item);
  if (favs.length > MAX_FAVORITES) favs = favs.slice(0, MAX_FAVORITES);
  try { localStorage.setItem('favorites', JSON.stringify(favs)); } catch {}
}

export function loadFavorites() {
  try { return JSON.parse(localStorage.getItem('favorites') || '[]'); } catch { return []; }
}

export function removeFromFavorites(url) {
  let favs = loadFavorites().filter(f => f.url !== url);
  try { localStorage.setItem('favorites', JSON.stringify(favs)); } catch {}
}

export function cacheResult(key, data, ttl) {
  try { sessionStorage.setItem(key, JSON.stringify({ data, expires: Date.now() + ttl })); } catch {}
}

export function getCachedResult(key) {
  try {
    const item = JSON.parse(sessionStorage.getItem(key));
    if (item && item.expires > Date.now()) return item.data;
  } catch {}
  return null;
}

export function truncate(text, length) {
  if (!text) return '';
  if (text.length <= length) return text;
  return text.slice(0, length) + '...';
}

export function formatDate(dateStr) {
  if (!dateStr) return 'Дата неизвестна';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'Дата неизвестна';
    return d.toLocaleDateString('ru-RU');
  } catch { return 'Дата неизвестна'; }
}

export function stripHtml(html) {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, '');
}
