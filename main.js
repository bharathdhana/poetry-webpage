import { poems } from './poemsData.js';

// -------------------------------------------------------------
// Constants
// -------------------------------------------------------------
const CONSTANTS = {
  READING_SPEED_WPM: 120,
  TOAST_DURATION: 3000,
};

// -------------------------------------------------------------
// State
// -------------------------------------------------------------
let currentPoemId = null;
let poemEngagement = {};
let currentFont = localStorage.getItem('poemFontPreference') || 'serif';
let localLikedPoems = JSON.parse(localStorage.getItem('localLikedPoems')) || {};

const socket = io();

// -------------------------------------------------------------
// Toggle Menu — defined early so window.toggleMenu is always set
// -------------------------------------------------------------
function toggleMenu() {
  const toggle = document.getElementById('menu-toggle');
  const menu = document.getElementById('nav-menu');
  const overlay = document.getElementById('menu-overlay');
  if (!toggle || !menu) return;

  const isOpen = menu.classList.toggle('active');
  toggle.classList.toggle('active', isOpen);
  toggle.setAttribute('aria-expanded', isOpen);
  if (overlay) overlay.classList.toggle('active', isOpen);
  document.body.classList.toggle('no-scroll', isOpen);
}
window.toggleMenu = toggleMenu;

// -------------------------------------------------------------
// Global helpers for inline HTML handlers
// -------------------------------------------------------------
window.toggleReplyForm = (id) => {
  const form = document.getElementById(`reply-form-${id}`);
  if (form) form.style.display = form.style.display === 'none' ? 'flex' : 'none';
};

window.handleReaction = (commentId, emoji) => {
  socket.emit('add_reaction', { poemId: currentPoemId, commentId, emoji });
};

window.handleReply = (event, commentId) => {
  event.preventDefault();
  const input = event.target.querySelector('input');
  const text = input?.value.trim();
  if (text) {
    socket.emit('add_reply', { poemId: currentPoemId, commentId, replyText: text });
    input.value = '';
    event.target.style.display = 'none';
  }
};

window.resetFilters = () => {
  const search = document.getElementById('search-input');
  const theme = document.getElementById('theme-filter');
  const volume = document.getElementById('volume-filter');
  if (search) search.value = '';
  if (theme) theme.value = 'all';
  if (volume) volume.value = 'all';
  renderPoems();
  updateFilterCounts();
};

// -------------------------------------------------------------
// Utility Functions
// -------------------------------------------------------------
function getReadingTime(content) {
  const words = content.trim().split(/\s+/).length;
  const minutes = Math.ceil(words / CONSTANTS.READING_SPEED_WPM);
  return minutes < 1 ? '< 1 min read' : `${minutes} min read`;
}

function showToast(message) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<span class="toast-icon">✨</span> <span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('hiding');
    setTimeout(() => toast.remove(), 300);
  }, CONSTANTS.TOAST_DURATION);
}

function createFloatingLike() {
  const likeBtn = document.getElementById('like-btn');
  if (!likeBtn) return;
  const heart = document.createElement('div');
  heart.className = 'floating-heart';
  heart.innerHTML = '❤️';
  heart.style.left = `calc(50% + ${(Math.random() - 0.5) * 40}px)`;
  heart.style.bottom = '100%';
  likeBtn.appendChild(heart);
  setTimeout(() => heart.remove(), 1000);
}

// -------------------------------------------------------------
// Filter Counts
// -------------------------------------------------------------
function updateFilterCounts() {
  const searchInput = document.getElementById('search-input');
  const themeSelect = document.getElementById('theme-filter');
  const volumeSelect = document.getElementById('volume-filter');

  const searchTerm = searchInput?.value.toLowerCase() || '';
  const currentTheme = themeSelect?.value || 'all';
  const currentVolume = volumeSelect?.value || 'all';

  const updateSelect = (select, type) => {
    if (!select) return;
    Array.from(select.options).forEach(opt => {
      if (opt.value === 'all') {
        opt.textContent = `All ${type}s (${poems.length})`;
        return;
      }
      const count = poems.filter(p => {
        const matchesSearch = !searchTerm ||
          p.title.toLowerCase().includes(searchTerm) ||
          p.content.toLowerCase().includes(searchTerm);
        if (type === 'Theme') {
          return p.theme === opt.value && (currentVolume === 'all' || p.volume === currentVolume) && matchesSearch;
        } else {
          return p.volume === opt.value && (currentTheme === 'all' || p.theme === currentTheme) && matchesSearch;
        }
      }).length;
      opt.textContent = `${opt.value} (${count})`;
      opt.disabled = count === 0;
    });
  };

  updateSelect(themeSelect, 'Theme');
  updateSelect(volumeSelect, 'Volume');
}

// -------------------------------------------------------------
// Render Poems
// -------------------------------------------------------------
function renderPoems() {
  const grid = document.getElementById('poem-grid');
  const countSummary = document.getElementById('poem-count-summary');
  if (!grid) return;

  const query = (document.getElementById('search-input')?.value || '').toLowerCase();
  const theme = document.getElementById('theme-filter')?.value || 'all';
  const volume = document.getElementById('volume-filter')?.value || 'all';

  const filtered = poems.filter(poem => {
    const matchesSearch = !query ||
      poem.title.toLowerCase().includes(query) ||
      poem.author.toLowerCase().includes(query) ||
      poem.content.toLowerCase().includes(query);
    const matchesTheme = theme === 'all' || poem.theme === theme;
    const matchesVolume = volume === 'all' || poem.volume === volume;
    return matchesSearch && matchesTheme && matchesVolume;
  });

  grid.innerHTML = '';

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="no-results animate-in">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <h3>No poems found</h3>
        <p>Try adjusting your search or filters.</p>
        <button class="clear-filters-btn glass-panel" style="margin: 1.5rem auto 0;" onclick="window.resetFilters()">Clear all filters</button>
      </div>
    `;
    if (countSummary) countSummary.textContent = 'No poems match your search';
    return;
  }

  if (countSummary) countSummary.textContent = `Showing ${filtered.length} of ${poems.length} poems`;

  filtered.forEach((poem, index) => {
    const card = document.createElement('div');
    card.className = 'poem-card glass-panel animate-in';
    const finalEmotion = (poem.emotion && poem.emotion !== 'neutral') ? poem.emotion : 'serenity';
    card.style.background = `linear-gradient(to bottom, rgba(0,0,0,0.5), rgba(0,0,0,0.8)), url('/backgrounds/bg_${finalEmotion}.png')`;
    card.style.backgroundSize = 'cover';
    card.style.backgroundPosition = 'center';
    card.style.animationDelay = `${index * 0.1 + 0.5}s`;
    card.innerHTML = `
      <div class="card-volume">${poem.volume || 'Volume I'}</div>
      <div class="card-theme">${poem.theme || 'Uncategorized'}</div>
      <h3 class="card-title">${poem.title}</h3>
      <div class="card-author">By ${poem.author}</div>
      <div class="card-preview">"${poem.preview}"</div>
      <div class="card-footer">
        <span class="card-read-time">${getReadingTime(poem.content)}</span>
        <span class="card-arrow">Read →</span>
      </div>
    `;
    card.addEventListener('click', () => openPoemReader(poem));
    grid.appendChild(card);
  });
}

// -------------------------------------------------------------
// Poem Reader
// -------------------------------------------------------------
function openPoemReader(poem) {
  currentPoemId = poem.id;
  const interactions = poemEngagement[currentPoemId] || { likes: 0, comments: [] };

  const readerTitle = document.getElementById('reader-title');
  const readerAuthor = document.getElementById('reader-author');
  const readerBody = document.getElementById('reader-body');
  const reader = document.getElementById('reader-modal');
  const likeCount = document.getElementById('like-count');
  const likeBtn = document.getElementById('like-btn');

  if (readerTitle) readerTitle.textContent = poem.title;
  if (readerAuthor) readerAuthor.textContent = `By ${poem.author}`;
  if (readerBody) {
    const stanzas = poem.content.split(/\n\s*\n/);
    readerBody.innerHTML = stanzas.map(s => `<p>${s.replace(/\n/g, '<br>')}</p>`).join('');
    readerBody.classList.toggle('font-sans', currentFont === 'sans');
    readerBody.classList.toggle('font-serif', currentFont === 'serif');
  }
  if (likeCount) likeCount.textContent = interactions.likes || 0;
  if (likeBtn) {
    likeBtn.classList.toggle('liked', !!localLikedPoems[currentPoemId]);
  }

  renderComments();

  if (reader) reader.classList.add('active');
  const finalEmotion = (poem.emotion && poem.emotion !== 'neutral') ? poem.emotion : 'serenity';
  document.body.className = `emotion-${finalEmotion}`;
  document.body.style.setProperty('--emotion-depth', poem.depth || 0.5);
  document.body.style.overflow = 'hidden';
}

function closePoemReader() {
  currentPoemId = null;
  const reader = document.getElementById('reader-modal');
  if (reader) reader.classList.remove('active');
  document.body.style.overflow = '';
  document.body.className = '';
  document.body.style.removeProperty('--emotion-depth');
}

// -------------------------------------------------------------
// Font Preference
// -------------------------------------------------------------
function applyFontPreference() {
  const readerBody = document.getElementById('reader-body');
  if (!readerBody) return;
  readerBody.classList.toggle('font-sans', currentFont === 'sans');
  readerBody.classList.toggle('font-serif', currentFont === 'serif');
}

// -------------------------------------------------------------
// Random Poem
// -------------------------------------------------------------
function handleRandomPoem() {
  const randomPoem = poems[Math.floor(Math.random() * poems.length)];
  const poemsSection = document.getElementById('section-poems');
  const poemsNav = document.getElementById('nav-poems');
  if (poemsSection?.style.display === 'none' && poemsNav) {
    switchSection(poemsNav, poemsSection);
  }
  openPoemReader(randomPoem);
}

// -------------------------------------------------------------
// Comments
// -------------------------------------------------------------
function renderComments() {
  const list = document.getElementById('comments-list');
  if (!list) return;
  list.innerHTML = '';
  const interactions = poemEngagement[currentPoemId] || { likes: 0, comments: [] };

  if (!interactions.comments?.length) {
    list.innerHTML = '<div class="no-comments">No comments yet. Be the first!</div>';
    return;
  }

  interactions.comments.forEach(c => {
    const el = document.createElement('div');
    el.className = 'comment-item';
    const repliesHtml = (c.replies || []).map(r => `
      <div class="reply-item">
        <div class="comment-text">${r.text}</div>
        <div class="comment-time">${new Date(r.timestamp).toLocaleString()}</div>
      </div>
    `).join('');
    const reactionsHtml = Object.entries(c.reactions || {}).map(([emoji, count]) => `
      <button class="reaction-btn" onclick="window.handleReaction('${c.id}', '${emoji}')">
        ${emoji} <span class="reaction-count">${count}</span>
      </button>
    `).join('');
    el.innerHTML = `
      <div class="comment-text">${c.text}</div>
      <div class="comment-time">${new Date(c.timestamp).toLocaleString()}</div>
      <div class="comment-actions">
        ${reactionsHtml}
        <button class="reaction-btn" onclick="window.handleReaction('${c.id}', '❤️')">❤️</button>
        <button class="reaction-btn" onclick="window.handleReaction('${c.id}', '👏')">👏</button>
        <button class="reply-btn" onclick="window.toggleReplyForm('${c.id}')">Reply</button>
      </div>
      <div class="replies-list">${repliesHtml}</div>
      <form class="reply-form" id="reply-form-${c.id}" style="display: none;" onsubmit="window.handleReply(event, '${c.id}')">
        <input type="text" placeholder="Write a reply..." required>
        <button type="submit">Post</button>
      </form>
    `;
    list.appendChild(el);
  });
}

// -------------------------------------------------------------
// Navigation
// -------------------------------------------------------------
function switchSection(targetNav, targetSection) {
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  targetNav?.classList.add('active');
  document.querySelectorAll('.content-section').forEach(s => {
    s.style.display = 'none';
    s.classList.remove('active');
  });
  if (targetSection) {
    targetSection.style.display = 'block';
    setTimeout(() => targetSection.classList.add('active'), 10);
  }
}

// -------------------------------------------------------------
// Socket Listeners
// -------------------------------------------------------------
socket.on('initial_data', (data) => {
  poemEngagement = data;
  const reader = document.getElementById('reader-modal');
  if (currentPoemId && reader?.classList.contains('active')) {
    renderComments();
    const likeCount = document.getElementById('like-count');
    if (likeCount) likeCount.textContent = data[currentPoemId]?.likes || 0;
  }
});

socket.on('engagement_update', ({ poemId, data }) => {
  poemEngagement[poemId] = data;
  const reader = document.getElementById('reader-modal');
  if (currentPoemId === poemId && reader?.classList.contains('active')) {
    const likeCount = document.getElementById('like-count');
    if (likeCount) likeCount.textContent = data.likes || 0;
    renderComments();
  }
});

socket.on('notification', showToast);

// -------------------------------------------------------------
// Initialization
// -------------------------------------------------------------
function init() {
  updateFilterCounts();
  renderPoems();
  applyFontPreference();

  // Navigation
  document.getElementById('nav-home')?.addEventListener('click', e => {
    e.preventDefault();
    switchSection(document.getElementById('nav-home'), document.getElementById('section-home'));
  });
  document.getElementById('nav-poems')?.addEventListener('click', e => {
    e.preventDefault();
    switchSection(document.getElementById('nav-poems'), document.getElementById('section-poems'));
  });
  document.getElementById('nav-about')?.addEventListener('click', e => {
    e.preventDefault();
    switchSection(document.getElementById('nav-about'), document.getElementById('section-about'));
  });

  // Filters
  document.getElementById('search-input')?.addEventListener('input', () => { updateFilterCounts(); renderPoems(); });
  document.getElementById('theme-filter')?.addEventListener('change', () => { updateFilterCounts(); renderPoems(); });
  document.getElementById('volume-filter')?.addEventListener('change', () => { updateFilterCounts(); renderPoems(); });
  document.getElementById('random-btn')?.addEventListener('click', handleRandomPoem);
  document.getElementById('clear-filters')?.addEventListener('click', window.resetFilters);

  // Reader
  document.getElementById('close-btn')?.addEventListener('click', closePoemReader);
  document.getElementById('reader-modal')?.addEventListener('click', e => { if (e.target === e.currentTarget) closePoemReader(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closePoemReader(); });

  // Font Toggle
  document.getElementById('font-toggle')?.addEventListener('click', () => {
    currentFont = currentFont === 'serif' ? 'sans' : 'serif';
    localStorage.setItem('poemFontPreference', currentFont);
    applyFontPreference();
  });

  // Engagement
  document.getElementById('like-btn')?.addEventListener('click', () => {
    if (!currentPoemId) return;
    if (!localLikedPoems[currentPoemId]) {
      localLikedPoems[currentPoemId] = true;
      localStorage.setItem('localLikedPoems', JSON.stringify(localLikedPoems));
      document.getElementById('like-btn')?.classList.add('liked');
      socket.emit('like_poem', currentPoemId);
    }
    createFloatingLike();
  });

  document.getElementById('comment-form')?.addEventListener('submit', e => {
    e.preventDefault();
    const input = document.getElementById('comment-input');
    const text = input?.value.trim();
    if (text && currentPoemId) {
      socket.emit('add_comment', { poemId: currentPoemId, text });
      if (input) input.value = '';
    }
  });

  // Hamburger Menu
  document.getElementById('menu-toggle')?.addEventListener('click', toggleMenu);

  // Close menu when nav link clicked
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
      if (document.getElementById('nav-menu')?.classList.contains('active')) {
        toggleMenu();
      }
    });
  });

  // Close menu when clicking outside
  document.addEventListener('click', e => {
    const menu = document.getElementById('nav-menu');
    const toggle = document.getElementById('menu-toggle');
    if (menu?.classList.contains('active') && !menu.contains(e.target) && !toggle?.contains(e.target)) {
      toggleMenu();
    }
  });
}

// Run init safely — works whether DOM is already loaded or not
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
