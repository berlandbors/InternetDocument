import { CONFIG } from './config.js';
import { searchArchive } from './modules/archive.js';
import { searchWikipedia } from './modules/wikipedia.js';
import { searchUnsplash } from './modules/unsplash.js';
import { searchOpenLibrary } from './modules/openlibrary.js';
import { searchWikimedia } from './modules/wikimedia.js';
import {
  saveToHistory, loadHistory,
  saveToFavorites, loadFavorites, removeFromFavorites,
  cacheResult, getCachedResult,
  truncate, formatDate
} from './modules/utils.js';

// --- State ---
let currentItem = null;
let currentPage = 1;
let lastQuery = '';
let lastFilters = {};
let allResults = [];
let activeTab = 'all';

// --- DOM refs ---
const queryInput = document.getElementById('query');
const searchBtn = document.getElementById('search-btn');
const resultsDiv = document.getElementById('results');
const tabsDiv = document.getElementById('tabs');
const loadMoreBtn = document.getElementById('load-more');
const modal = document.getElementById('modal');
const modalTitle = document.getElementById('modal-title');
const modalBody = document.getElementById('modal-body');
const modalDescription = document.getElementById('modal-description');
const modalOverlay = document.getElementById('modal-overlay');
const modalClose = document.getElementById('modal-close');
const btnShare = document.getElementById('btn-share');
const btnDownload = document.getElementById('btn-download');
const btnOpenSource = document.getElementById('btn-open-source');
const btnFavorite = document.getElementById('btn-favorite');
const historyList = document.getElementById('history-list');
const favoritesList = document.getElementById('favorites-list');
const errorMsg = document.getElementById('error-msg');
const themeToggle = document.getElementById('theme-toggle');

// --- Theme ---
function applyTheme() {
  const theme = localStorage.getItem('theme') || 'dark';
  document.body.classList.toggle('light-theme', theme === 'light');
  themeToggle.textContent = theme === 'light' ? '🌙' : '🌓';
}
themeToggle.addEventListener('click', () => {
  const current = localStorage.getItem('theme') || 'dark';
  localStorage.setItem('theme', current === 'dark' ? 'light' : 'dark');
  applyTheme();
});
applyTheme();

// --- Debounce ---
function debounce(fn, ms) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
}

// --- Get filters ---
function getFilters() {
  const sources = [...document.querySelectorAll('input[name="source"]:checked')].map(c => c.value);
  return {
    sources,
    contentType: document.getElementById('content-type').value,
    sort: document.getElementById('sort').value,
    lang: document.getElementById('lang').value,
    dateFrom: document.getElementById('date-from').value,
    dateTo: document.getElementById('date-to').value,
  };
}

// --- Universal Search ---
async function universalSearch(page = 1) {
  const query = queryInput.value.trim();
  if (!query) { showError('Введите поисковый запрос'); return; }
  hideError();

  lastQuery = query;
  lastFilters = getFilters();
  currentPage = page;

  if (page === 1) {
    allResults = [];
    resultsDiv.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    tabsDiv.style.display = 'none';
    loadMoreBtn.style.display = 'none';
  }

  saveToHistory(query);
  renderHistory();

  const { sources, contentType, sort, lang, dateFrom, dateTo } = lastFilters;
  const apiFilters = { sort, lang, dateFrom, dateTo, page };

  const tasks = [];
  if (sources.includes('archive')) tasks.push(searchArchive(query, contentType, apiFilters).catch(() => []));
  if (sources.includes('wikipedia')) tasks.push(searchWikipedia(query, { lang, limit: 20 }).catch(() => []));
  if (sources.includes('unsplash')) tasks.push(searchUnsplash(query, apiFilters).catch(() => []));
  if (sources.includes('openlibrary')) tasks.push(searchOpenLibrary(query, apiFilters).catch(() => []));
  if (sources.includes('wikimedia')) tasks.push(searchWikimedia(query, apiFilters).catch(() => []));

  try {
    const settled = await Promise.allSettled(tasks);
    const newResults = settled.flatMap(r => r.status === 'fulfilled' ? r.value : []);
    allResults = page === 1 ? newResults : [...allResults, ...newResults];
    displayResults(allResults);
    loadMoreBtn.style.display = newResults.length > 0 ? 'inline-flex' : 'none';
  } catch (err) {
    showError('Ошибка при поиске: ' + err.message);
    resultsDiv.innerHTML = '';
  }
}

// --- Display results ---
function displayResults(results) {
  resultsDiv.innerHTML = '';

  if (results.length === 0) {
    resultsDiv.innerHTML = '<div class="empty-state"><div class="empty-icon">🔍</div><p>Ничего не найдено. Попробуйте изменить запрос или фильтры.</p></div>';
    tabsDiv.style.display = 'none';
    return;
  }

  // Build tabs
  const sources = ['all', ...new Set(results.map(r => r.source))];
  tabsDiv.innerHTML = '';
  sources.forEach(src => {
    const count = src === 'all' ? results.length : results.filter(r => r.source === src).length;
    const btn = document.createElement('button');
    btn.className = 'tab-btn' + (src === activeTab ? ' active' : '');
    btn.textContent = `${sourceLabel(src)} (${count})`;
    btn.dataset.tab = src;
    btn.addEventListener('click', () => { activeTab = src; displayResults(allResults); });
    tabsDiv.appendChild(btn);
  });
  tabsDiv.style.display = 'flex';

  const filtered = activeTab === 'all' ? results : results.filter(r => r.source === activeTab);
  filtered.forEach(item => resultsDiv.appendChild(createResultCard(item)));
}

function sourceLabel(src) {
  const labels = { all: 'Все', archive: 'Archive', wikipedia: 'Wikipedia', unsplash: 'Unsplash', openlibrary: 'OpenLibrary', wikimedia: 'Wikimedia' };
  return labels[src] || src;
}

function typeIcon(type) {
  const icons = { texts: '📄', image: '🖼', audio: '🎵', video: '🎬', article: '📰', book: '📚', media: '🎨' };
  return icons[type] || '📁';
}

// --- Create result card ---
function createResultCard(item) {
  const card = document.createElement('div');
  card.className = 'result-card';

  const thumbHtml = item.thumbnail
    ? `<img class="result-card-thumb" src="${escapeAttr(item.thumbnail)}" alt="" loading="lazy" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'">`
      + `<div class="result-card-thumb-placeholder" style="display:none">${typeIcon(item.type)}</div>`
    : `<div class="result-card-thumb-placeholder">${typeIcon(item.type)}</div>`;

  card.innerHTML = `
    ${thumbHtml}
    <div class="result-card-body">
      <div class="result-card-header">
        <span class="result-card-title">${escapeHtml(truncate(item.title, 80))}</span>
        <span class="source-badge badge-${item.source}">${sourceLabel(item.source)}</span>
      </div>
      <p class="result-card-description">${escapeHtml(truncate(item.description, 120))}</p>
      <div class="result-card-meta">
        ${item.author ? `<span class="result-card-author">👤 ${escapeHtml(truncate(item.author, 40))}</span>` : ''}
        ${item.date ? `<span class="result-card-date">📅 ${formatDate(item.date)}</span>` : ''}
      </div>
    </div>`;

  card.addEventListener('click', () => openItem(item));
  return card;
}

// --- Open modal ---
function openItem(item) {
  currentItem = item;
  modalTitle.textContent = item.title || 'Без названия';
  modalDescription.textContent = item.description || '';

  modalBody.innerHTML = '';
  if (item.type === 'image' && item.thumbnail) {
    const img = document.createElement('img');
    img.src = item.thumbnail;
    img.alt = item.title;
    img.style.maxWidth = '100%';
    modalBody.appendChild(img);
  } else if (item.source === 'archive' && (item.mediaType === 'texts' || item.mediaType === 'movies' || item.mediaType === 'audio')) {
    const iframe = document.createElement('iframe');
    iframe.src = `https://archive.org/embed/${item.id}`;
    iframe.allowFullscreen = true;
    modalBody.appendChild(iframe);
  } else if (item.thumbnail) {
    const img = document.createElement('img');
    img.src = item.thumbnail;
    img.alt = item.title;
    img.style.maxWidth = '100%';
    modalBody.appendChild(img);
  }

  // Update favorite button
  const favs = loadFavorites();
  const isFav = favs.some(f => f.url === item.url);
  btnFavorite.textContent = isFav ? '★ Удалить из избранного' : '⭐ В избранное';

  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  modal.style.display = 'none';
  modalBody.innerHTML = '';
  document.body.style.overflow = '';
  currentItem = null;
}

// --- Modal actions ---
function shareItem() {
  if (!currentItem) return;
  const url = currentItem.url;
  if (navigator.share) {
    navigator.share({ title: currentItem.title, url }).catch(() => {});
  } else {
    navigator.clipboard.writeText(url).then(() => alert('✅ Ссылка скопирована!')).catch(() => {
      prompt('Скопируйте ссылку:', url);
    });
  }
}

function downloadItem() {
  if (!currentItem) return;
  window.open(currentItem.url, '_blank');
}

function toggleFavorite() {
  if (!currentItem) return;
  const favs = loadFavorites();
  const isFav = favs.some(f => f.url === currentItem.url);
  if (isFav) {
    removeFromFavorites(currentItem.url);
    btnFavorite.textContent = '⭐ В избранное';
  } else {
    saveToFavorites(currentItem);
    btnFavorite.textContent = '★ Удалить из избранного';
  }
  renderFavorites();
}

// --- Sidebar rendering ---
function renderHistory() {
  const history = loadHistory();
  historyList.innerHTML = '';
  if (history.length === 0) {
    historyList.innerHTML = '<li style="color:var(--text-secondary);font-size:12px">Нет истории</li>';
    return;
  }
  history.slice(0, 10).forEach(q => {
    const li = document.createElement('li');
    const span = document.createElement('span');
    span.textContent = q;
    span.style.overflow = 'hidden';
    span.style.textOverflow = 'ellipsis';
    li.appendChild(span);
    li.addEventListener('click', (e) => {
      if (e.target.classList.contains('remove-btn')) return;
      queryInput.value = q;
      universalSearch(1);
    });
    historyList.appendChild(li);
  });
}

function renderFavorites() {
  const favs = loadFavorites();
  favoritesList.innerHTML = '';
  if (favs.length === 0) {
    favoritesList.innerHTML = '<li style="color:var(--text-secondary);font-size:12px">Нет избранного</li>';
    return;
  }
  favs.slice(0, 10).forEach(item => {
    const li = document.createElement('li');
    const span = document.createElement('span');
    span.textContent = truncate(item.title, 30);
    span.style.overflow = 'hidden';
    span.style.textOverflow = 'ellipsis';
    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-btn';
    removeBtn.textContent = '✕';
    removeBtn.title = 'Удалить';
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      removeFromFavorites(item.url);
      renderFavorites();
    });
    li.appendChild(span);
    li.appendChild(removeBtn);
    li.addEventListener('click', () => openItem(item));
    favoritesList.appendChild(li);
  });
}

// --- Error display ---
function showError(msg) { errorMsg.textContent = msg; errorMsg.style.display = 'block'; }
function hideError() { errorMsg.style.display = 'none'; }

// --- Helpers ---
function escapeHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function escapeAttr(str) { return String(str).replace(/"/g, '&quot;'); }

// --- Event listeners ---
searchBtn.addEventListener('click', () => universalSearch(1));
queryInput.addEventListener('keydown', e => { if (e.key === 'Enter') universalSearch(1); });
queryInput.addEventListener('input', debounce(() => {}, 300));

loadMoreBtn.addEventListener('click', () => universalSearch(currentPage + 1));

modalClose.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', closeModal);
btnShare.addEventListener('click', shareItem);
btnDownload.addEventListener('click', downloadItem);
btnOpenSource.addEventListener('click', () => { if (currentItem) window.open(currentItem.url, '_blank'); });
btnFavorite.addEventListener('click', toggleFavorite);

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && modal.style.display === 'flex') closeModal();
  if (e.key === 'Enter' && document.activeElement !== queryInput) {}
});

// --- URL params on load ---
window.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(location.search);
  const q = params.get('q');
  const source = params.get('source');
  if (q) {
    queryInput.value = q;
    if (source) {
      document.querySelectorAll('input[name="source"]').forEach(cb => {
        cb.checked = cb.value === source;
      });
    }
    universalSearch(1);
  }
  renderHistory();
  renderFavorites();
});
