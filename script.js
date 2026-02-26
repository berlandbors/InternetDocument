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
const clearBtn = document.getElementById('clear-btn');
const historyBtn = document.getElementById('history-btn');
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
const themeSelector = document.getElementById('themeSelector');
const sidebar = document.getElementById('sidebar');
const searchInlineBtn = document.getElementById('search-inline-btn');

// --- Theme (terminal: green / amber / blue) ---
function applyTheme() {
  const theme = localStorage.getItem('terminal-theme') || 'green';
  document.documentElement.setAttribute('data-theme', theme);
  if (themeSelector) themeSelector.value = theme;
}
themeSelector.addEventListener('change', (e) => {
  localStorage.setItem('terminal-theme', e.target.value);
  applyTheme();
});
applyTheme();

// --- Real-time clock ---
function updateTime() {
  const el = document.getElementById('currentTime');
  if (!el) return;
  const now = new Date();
  el.textContent = now.toISOString().replace('T', ' ').slice(0, 19);
}
setInterval(updateTime, 1000);
updateTime();

// --- Boot screen ---
function runBootScreen() {
  const bootScreen = document.getElementById('boot-screen');
  const bootText = document.getElementById('boot-text');
  const bootSkipBtn = document.getElementById('boot-skip-btn');
  if (!bootScreen || !bootText) return;

  // Функция для закрытия boot screen
  function dismissBootScreen() {
    bootScreen.style.display = 'none';
    // На десктопе фокусируемся на поле ввода
    if (!window.matchMedia('(pointer: coarse)').matches) {
      queryInput.focus();
    }
  }

  // Проверяем, touch-устройство или нет
  const isTouchDevice = window.matchMedia('(pointer: coarse)').matches;

  const lines = [
    'UNIVERSAL SEARCH TERMINAL v1.0',
    '==============================',
    '',
    '> INITIALIZING...',
    '> LOADING MODULES... [OK]',
    '> CONNECTING TO NETWORK... [OK]',
    '> SYSTEM READY',
    '',
    isTouchDevice ? 'Tap button below to continue_' : 'Press ENTER to continue_'
  ];

  let lineIndex = 0;
  let charIndex = 0;
  let text = '';
  let typingComplete = false;

  function typeNext() {
    if (lineIndex >= lines.length) {
      typingComplete = true;

      // На touch-устройствах показываем кнопку
      if (isTouchDevice && bootSkipBtn) {
        bootSkipBtn.style.display = 'block';
        bootSkipBtn.addEventListener('click', dismissBootScreen);
      }

      // На десктопе слушаем Enter
      document.addEventListener('keydown', function dismissBoot(e) {
        if (e.key === 'Enter') {
          dismissBootScreen();
          document.removeEventListener('keydown', dismissBoot);
        }
      });

      return;
    }
    const line = lines[lineIndex];
    if (charIndex < line.length) {
      text += line.charAt(charIndex);
      bootText.textContent = text;
      charIndex++;
      setTimeout(typeNext, 25);
    } else {
      text += '\n';
      bootText.textContent = text;
      lineIndex++;
      charIndex = 0;
      setTimeout(typeNext, 80);
    }
  }

  typeNext();

  // Альтернатива: клик в любом месте экрана закрывает boot screen после завершения печати
  bootScreen.addEventListener('click', () => {
    if (typingComplete) {
      dismissBootScreen();
    }
  });
}

// --- Typewriter effect ---
function typewriterEffect(element, text, speed = 30) {
  element.textContent = '';
  let i = 0;
  const timer = setInterval(() => {
    if (i < text.length) {
      element.textContent += text.charAt(i);
      i++;
    } else {
      clearInterval(timer);
    }
  }, speed);
}

// --- Show / hide search status ---
function showSearchStatus() {
  const status = document.getElementById('searchStatus');
  if (status) status.style.display = 'block';
}
function hideSearchStatus() {
  const status = document.getElementById('searchStatus');
  if (status) status.style.display = 'none';
}

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

// --- Haptic feedback for mobile devices ---
function hapticFeedback() {
  if ('vibrate' in navigator) {
    navigator.vibrate(50);
  }
}

// --- Universal Search ---
async function universalSearch(page = 1) {
  const query = queryInput.value.trim();
  if (!query) { showError('> ERROR: ENTER SEARCH QUERY'); return; }

  // Easter eggs
  if (handleEasterEgg(query)) return;

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
  showSearchStatus();

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
    hideSearchStatus();
    displayResults(allResults);
    loadMoreBtn.style.display = newResults.length > 0 ? 'inline-flex' : 'none';
  } catch (err) {
    hideSearchStatus();
    showError('> ERROR: ' + err.message);
    resultsDiv.innerHTML = '';
  }
}

// --- Easter eggs ---
function handleEasterEgg(query) {
  const cmd = query.trim().toLowerCase();
  if (cmd === '/help') {
    resultsDiv.innerHTML = '';
    hideSearchStatus();
    tabsDiv.style.display = 'none';
    loadMoreBtn.style.display = 'none';
    resultsDiv.innerHTML = `<div class="result-card">
      <div class="result-card-index">┌─ [HELP] ─────────────────────────────────────────────────────────┐</div>
      <div class="result-card-description">
        /help    - Show this help message<br>
        /matrix  - Activate Matrix mode<br>
        /cowsay  - Display ASCII cow<br>
        Ctrl+/   - Focus search input<br>
        Ctrl+H   - Toggle history panel<br>
        Esc      - Close modal
      </div>
    </div>`;
    return true;
  }
  if (cmd === '/cowsay') {
    resultsDiv.innerHTML = '';
    hideSearchStatus();
    tabsDiv.style.display = 'none';
    loadMoreBtn.style.display = 'none';
    resultsDiv.innerHTML = `<div class="result-card"><pre class="result-card-description">
 _____________________
< UNIVERSAL SEARCH HUB >
 ---------------------
        \\   ^__^
         \\  (oo)\\_______
            (__)\\       )\\/\\
                ||----w |
                ||     ||
    </pre></div>`;
    return true;
  }
  if (cmd === '/matrix') {
    startMatrix();
    return true;
  }
  return false;
}

// --- Matrix easter egg ---
function startMatrix() {
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;top:0;left:0;z-index:9998;cursor:pointer';
  canvas.title = 'Click to exit Matrix mode';
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const cols = Math.floor(canvas.width / 16);
  const drops = Array(cols).fill(1);
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%^&*()/\\|<>';
  const interval = setInterval(() => {
    ctx.fillStyle = 'rgba(0,0,0,0.05)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#00ff00';
    ctx.font = '14px Courier New';
    drops.forEach((y, i) => {
      ctx.fillText(chars[Math.floor(Math.random() * chars.length)], i * 16, y * 16);
      const MATRIX_DROP_RESET_THRESHOLD = 0.975; // probability a column resets after reaching the bottom
      if (y * 16 > canvas.height && Math.random() > MATRIX_DROP_RESET_THRESHOLD) drops[i] = 0;
      drops[i]++;
    });
  }, 50);
  canvas.addEventListener('click', () => {
    clearInterval(interval);
    canvas.remove();
    queryInput.value = '';
    queryInput.focus();
  });
}

// --- Display results ---
function displayResults(results) {
  resultsDiv.innerHTML = '';

  if (results.length === 0) {
    resultsDiv.innerHTML = '<div class="empty-state"><div class="empty-icon">🔍</div><p>> NO RESULTS FOUND. MODIFY QUERY OR FILTERS.</p></div>';
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
    btn.textContent = `[${sourceLabel(src).toUpperCase()}] (${count})`;
    btn.dataset.tab = src;
    btn.addEventListener('click', () => { activeTab = src; displayResults(allResults); });
    tabsDiv.appendChild(btn);
  });
  tabsDiv.style.display = 'flex';

  const filtered = activeTab === 'all' ? results : results.filter(r => r.source === activeTab);
  filtered.forEach((item, index) => resultsDiv.appendChild(createResultCard(item, index)));
}

function sourceLabel(src) {
  const labels = { all: 'All', archive: 'Archive', wikipedia: 'Wikipedia', unsplash: 'Unsplash', openlibrary: 'OpenLibrary', wikimedia: 'Wikimedia' };
  return labels[src] || src;
}

function typeIcon(type) {
  const icons = { texts: '📄', image: '🖼', audio: '🎵', video: '🎬', article: '📰', book: '📚', media: '🎨' };
  return icons[type] || '📁';
}

// --- Create result card (terminal style) ---
function createResultCard(item, index) {
  const card = document.createElement('div');
  card.className = 'result-card';

  const idx = String(index + 1).padStart(3, '0');
  const thumbHtml = item.thumbnail
    ? `<img class="result-card-thumb" src="${escapeAttr(item.thumbnail)}" alt="" loading="lazy" onerror="this.style.display='none'">`
    : `<div class="result-card-thumb-placeholder">${typeIcon(item.type)}</div>`;

  card.innerHTML = `
    ${thumbHtml}
    <div class="result-card-index">┌─ [${escapeHtml(idx)}] ──────────────────────────────────────────────────────────┐</div>
    <div class="result-card-meta">
      <span class="result-meta-label">TITLE   :</span>
      <span class="result-meta-value">${escapeHtml(truncate(item.title, 80))}</span>
      <span class="result-meta-label">SOURCE  :</span>
      <span class="result-meta-value">${escapeHtml(sourceLabel(item.source).toUpperCase())}</span>
      <span class="result-meta-label">TYPE    :</span>
      <span class="result-meta-value">${escapeHtml((item.type || 'unknown').toUpperCase())}</span>
      ${item.author ? `<span class="result-meta-label">AUTHOR  :</span><span class="result-meta-value">${escapeHtml(truncate(item.author, 40))}</span>` : ''}
      ${item.date ? `<span class="result-meta-label">DATE    :</span><span class="result-meta-value">${escapeHtml(formatDate(item.date))}</span>` : ''}
      <span class="result-meta-label">STATUS  :</span>
      <span class="result-meta-value status-ok">[AVAILABLE]</span>
    </div>
    <div class="result-card-description">${escapeHtml(truncate(item.description, 200))}</div>
    <div class="result-card-actions">&gt; PRESS [ENTER] TO VIEW | [D] DOWNLOAD | [S] SHARE | [*] FAV</div>`;

  card.addEventListener('click', () => openItem(item));
  card.tabIndex = 0;
  card.addEventListener('keydown', (e) => {
    const tag = document.activeElement.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (e.key === 'Enter') openItem(item);
    if (e.key === 'd' || e.key === 'D') downloadItem();
    if (e.key === 's' || e.key === 'S') shareItem();
    if (e.key === '*') addToFav(item);
  });
  return card;
}

// --- Open modal ---
function openItem(item) {
  currentItem = item;
  modalTitle.textContent = item.title || 'NO TITLE';
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

  const favs = loadFavorites();
  const isFav = favs.some(f => f.url === item.url);
  btnFavorite.textContent = isFav ? '[*] UNFAVORITE' : '[*] FAVORITE';

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
    navigator.clipboard.writeText(url).then(() => alert('> LINK COPIED TO CLIPBOARD')).catch(() => {
      prompt('> COPY LINK:', url);
    });
  }
}

function downloadItem() {
  if (!currentItem) return;
  window.open(currentItem.url, '_blank');
}

function addToFav(item) {
  if (!item) return;
  saveToFavorites(item);
  renderFavorites();
}

function toggleFavorite() {
  if (!currentItem) return;
  const favs = loadFavorites();
  const isFav = favs.some(f => f.url === currentItem.url);
  if (isFav) {
    removeFromFavorites(currentItem.url);
    btnFavorite.textContent = '[*] FAVORITE';
  } else {
    saveToFavorites(currentItem);
    btnFavorite.textContent = '[*] UNFAVORITE';
  }
  renderFavorites();
}

// --- Sidebar rendering ---
function renderHistory() {
  const history = loadHistory();
  historyList.innerHTML = '';
  if (history.length === 0) {
    historyList.innerHTML = '<li style="color:var(--text-secondary);">> NO HISTORY</li>';
    return;
  }
  history.slice(0, 10).forEach(q => {
    const li = document.createElement('li');
    const span = document.createElement('span');
    span.textContent = '> ' + q;
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
    favoritesList.innerHTML = '<li style="color:var(--text-secondary);">> NO FAVORITES</li>';
    return;
  }
  favs.slice(0, 10).forEach(item => {
    const li = document.createElement('li');
    const span = document.createElement('span');
    span.textContent = '* ' + truncate(item.title, 28);
    span.style.overflow = 'hidden';
    span.style.textOverflow = 'ellipsis';
    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-btn';
    removeBtn.textContent = '[X]';
    removeBtn.title = 'Remove';
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

// --- Clear search ---
function clearSearch() {
  queryInput.value = '';
  resultsDiv.innerHTML = '';
  tabsDiv.style.display = 'none';
  loadMoreBtn.style.display = 'none';
  hideSearchStatus();
  hideError();
  queryInput.focus();
}

// --- Toggle sidebar ---
function toggleSidebar() {
  if (window.innerWidth <= 768) return; // sidebar always visible on mobile as block
  sidebar.style.display = sidebar.style.display === 'none' ? 'block' : 'none';
}

// --- Event listeners ---
searchBtn.addEventListener('click', () => { hapticFeedback(); universalSearch(1); });
searchInlineBtn.addEventListener('click', () => { hapticFeedback(); universalSearch(1); });

// Запасной механизм: обработка touch-событий для старых Android устройств
if ('ontouchstart' in window) {
  searchInlineBtn.addEventListener('touchend', (e) => {
    e.preventDefault();
    hapticFeedback();
    universalSearch(1);
  });
}
queryInput.addEventListener('keydown', e => { 
  if (e.key === 'Enter' || e.keyCode === 13) { 
    e.preventDefault(); 
    universalSearch(1); 
  } 
});

// Дополнительная обработка для некоторых мобильных браузеров
queryInput.addEventListener('search', e => {
  e.preventDefault();
  universalSearch(1);
});
queryInput.addEventListener('input', debounce(() => {}, 300));
clearBtn.addEventListener('click', clearSearch);
historyBtn.addEventListener('click', toggleSidebar);
loadMoreBtn.addEventListener('click', () => universalSearch(currentPage + 1));

modalClose.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', closeModal);
btnShare.addEventListener('click', shareItem);
btnDownload.addEventListener('click', downloadItem);
btnOpenSource.addEventListener('click', () => { if (currentItem) window.open(currentItem.url, '_blank'); });
btnFavorite.addEventListener('click', toggleFavorite);

// --- Global keyboard shortcuts ---
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (modal.style.display === 'flex') closeModal();
  }
  if (e.ctrlKey && e.key === 'h') {
    e.preventDefault();
    toggleSidebar();
  }
  if (e.ctrlKey && e.key === '/') {
    e.preventDefault();
    queryInput.focus();
  }
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
  runBootScreen();
  // Auto-focus search input on non-touch (desktop) devices only
  if (!window.matchMedia('(pointer: coarse)').matches) {
    queryInput.focus();
  }
});
