import './style.css';
import { poems } from './poemsData.js';

// -------------------------------------------------------------
// DOM Elements
// -------------------------------------------------------------
const DOM = {
  grid: document.getElementById('poem-grid'),
  reader: document.getElementById('reader-modal'),
  closeBtn: document.getElementById('close-btn'),
  readerTitle: document.getElementById('reader-title'),
  readerAuthor: document.getElementById('reader-author'),
  readerBody: document.getElementById('reader-body'),
  countSummary: document.getElementById('poem-count-summary'),

  nav: {
    home: document.getElementById('nav-home'),
    poems: document.getElementById('nav-poems'),
    about: document.getElementById('nav-about'),
    links: [document.getElementById('nav-home'), document.getElementById('nav-poems'), document.getElementById('nav-about')]
  },

  sections: {
    home: document.getElementById('section-home'),
    poems: document.getElementById('section-poems'),
    about: document.getElementById('section-about'),
    all: [document.getElementById('section-home'), document.getElementById('section-poems'), document.getElementById('section-about')]
  },

  filters: {
    search: document.getElementById('search-input'),
    theme: document.getElementById('theme-filter'),
    volume: document.getElementById('volume-filter'),
    random: document.getElementById('random-btn')
  },

  fontToggle: document.getElementById('font-toggle'),

  engagement: {
    likeBtn: document.getElementById('like-btn'),
    likeCount: document.getElementById('like-count'),
    form: document.getElementById('comment-form'),
    input: document.getElementById('comment-input'),
    list: document.getElementById('comments-list')
  }
};

// -------------------------------------------------------------
// State Management
// -------------------------------------------------------------
let currentPoemId = null;
let filteredPoems = [...poems];
let poemEngagement = {};
let currentFont = localStorage.getItem('poemFontPreference') || 'serif';
let localLikedPoems = JSON.parse(localStorage.getItem('localLikedPoems')) || {};

const socket = io();

// -------------------------------------------------------------
// Core UI Logic
// -------------------------------------------------------------

function getReadingTime(content) {
  const words = content.trim().split(/\s+/).length;
  const wpm = 120; // Poetry reading speed
  const minutes = Math.ceil(words / wpm);
  return minutes < 1 ? '< 1 min read' : `${minutes} min read`;
}

function renderPoems() {
  if (DOM.countSummary) {
    DOM.countSummary.textContent = `Showing ${filteredPoems.length} of ${poems.length} poems`;
  }

  DOM.grid.innerHTML = '';

  if (filteredPoems.length === 0) {
    DOM.grid.innerHTML = '<div class="no-results">No poems found matching your search.</div>';
    return;
  }

  filteredPoems.forEach((poem, index) => {
    const card = document.createElement('div');
    card.className = 'poem-card animate-in';

    const finalEmotion = (poem.emotion && poem.emotion !== 'neutral') ? poem.emotion : 'serenity';
    card.style.background = `linear-gradient(to bottom, rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.8)), url('/backgrounds/bg_${finalEmotion}.png')`;
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
    DOM.grid.appendChild(card);
  });
}

function openPoemReader(poem) {
  currentPoemId = poem.id;
  const interactions = poemEngagement[currentPoemId] || { likes: 0, comments: [] };

  DOM.readerTitle.textContent = poem.title;
  DOM.readerAuthor.textContent = `By ${poem.author}`;

  // Format content into stanzas
  const stanzas = poem.content.split(/\n\s*\n/);
  DOM.readerBody.innerHTML = stanzas.map(stanza => `<p>${stanza.replace(/\n/g, '<br>')}</p>`).join('');

  DOM.engagement.likeCount.textContent = interactions.likes || 0;

  if (localLikedPoems[currentPoemId]) {
    DOM.engagement.likeBtn.classList.add('liked');
  } else {
    DOM.engagement.likeBtn.classList.remove('liked');
  }

  renderComments();
  applyFontPreference();

  DOM.reader.classList.add('active');

  const finalEmotion = (poem.emotion && poem.emotion !== 'neutral') ? poem.emotion : 'serenity';
  document.body.className = `emotion-${finalEmotion}`;
  document.body.style.setProperty('--emotion-depth', poem.depth || 0.5);
  document.body.style.overflow = 'hidden';
}

function closePoemReader() {
  currentPoemId = null;
  DOM.reader.classList.remove('active');
  document.body.style.overflow = '';
  document.body.className = '';
  document.body.style.removeProperty('--emotion-depth');
}

// -------------------------------------------------------------
// Filtering & Search
// -------------------------------------------------------------

function applyFilters() {
  const query = DOM.filters.search?.value.toLowerCase() || '';
  const theme = DOM.filters.theme?.value || 'all';
  const volume = DOM.filters.volume?.value || 'all';

  filteredPoems = poems.filter(poem => {
    const matchesSearch = !query ||
      poem.title.toLowerCase().includes(query) ||
      poem.author.toLowerCase().includes(query) ||
      poem.content.toLowerCase().includes(query);
    const matchesTheme = theme === 'all' || poem.theme === theme;
    const matchesVolume = volume === 'all' || poem.volume === volume;
    return matchesSearch && matchesTheme && matchesVolume;
  });

  renderPoems();
}

function handleRandomPoem() {
  const randomPoem = poems[Math.floor(Math.random() * poems.length)];
  openPoemReader(randomPoem);

  // Switch to poems section if not already there
  if (DOM.sections.poems.style.display === 'none') {
    switchSection(DOM.nav.poems, DOM.sections.poems);
  }
}

function updateFilterCounts() {
  const themes = {};
  const volumes = {};

  poems.forEach(p => {
    themes[p.theme] = (themes[p.theme] || 0) + 1;
    volumes[p.volume] = (volumes[p.volume] || 0) + 1;
  });

  const updateSelect = (select, counts, prefix) => {
    if (!select) return;
    Array.from(select.options).forEach(opt => {
      if (opt.value === 'all') {
        opt.textContent = `All ${prefix}s (${poems.length})`;
      } else if (counts[opt.value] !== undefined) {
        opt.textContent = `${opt.value} (${counts[opt.value]})`;
      }
    });
  };

  updateSelect(DOM.filters.theme, themes, 'Theme');
  updateSelect(DOM.filters.volume, volumes, 'Volume');
}

// -------------------------------------------------------------
// Typography toggle
// -------------------------------------------------------------

function applyFontPreference() {
  if (!DOM.readerBody) return;
  DOM.readerBody.classList.toggle('font-sans', currentFont === 'sans');
  DOM.readerBody.classList.toggle('font-serif', currentFont === 'serif');
}

// -------------------------------------------------------------
// Engagement Logic
// -------------------------------------------------------------

function renderComments() {
  DOM.engagement.list.innerHTML = '';
  const interactions = poemEngagement[currentPoemId] || { likes: 0, comments: [] };

  if (!interactions.comments?.length) {
    DOM.engagement.list.innerHTML = '<div class="no-comments">No comments yet. Be the first!</div>';
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
    DOM.engagement.list.appendChild(el);
  });
}

// -------------------------------------------------------------
// Socket Listeners
// -------------------------------------------------------------

socket.on('initial_data', (data) => {
  poemEngagement = data;
  if (currentPoemId && DOM.reader.classList.contains('active')) {
    renderComments();
    DOM.engagement.likeCount.textContent = data[currentPoemId]?.likes || 0;
  }
});

socket.on('engagement_update', ({ poemId, data }) => {
  poemEngagement[poemId] = data;
  if (currentPoemId === poemId && DOM.reader.classList.contains('active')) {
    DOM.engagement.likeCount.textContent = data.likes || 0;
    renderComments();
  }
});

socket.on('notification', showToast);

// -------------------------------------------------------------
// Event Handlers & Helper Functions
// -------------------------------------------------------------

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
  }, 3000);
}

function createFloatingLike() {
  const heart = document.createElement('div');
  heart.className = 'floating-heart';
  heart.innerHTML = '❤️';
  const xOffset = (Math.random() - 0.5) * 40;
  heart.style.left = `calc(50% + ${xOffset}px)`;
  heart.style.bottom = '100%';
  DOM.engagement.likeBtn.appendChild(heart);
  setTimeout(() => heart.remove(), 1000);
}

// Global window helpers for inline handlers
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
  const text = input.value.trim();
  if (text) {
    socket.emit('add_reply', { poemId: currentPoemId, commentId, replyText: text });
    input.value = '';
    event.target.style.display = 'none';
  }
};

// -------------------------------------------------------------
// Initialization & Listeners
// -------------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
  updateFilterCounts();
  renderPoems();
  applyFontPreference();

  // Navigation listeners
  DOM.nav.home.addEventListener('click', (e) => { e.preventDefault(); switchSection(DOM.nav.home, DOM.sections.home); });
  DOM.nav.poems.addEventListener('click', (e) => { e.preventDefault(); switchSection(DOM.nav.poems, DOM.sections.poems); });
  DOM.nav.about.addEventListener('click', (e) => { e.preventDefault(); switchSection(DOM.nav.about, DOM.sections.about); });

  // Filter listeners
  DOM.filters.search?.addEventListener('input', applyFilters);
  DOM.filters.theme?.addEventListener('change', applyFilters);
  DOM.filters.volume?.addEventListener('change', applyFilters);

  DOM.filters.random?.addEventListener('click', handleRandomPoem);

  // Reader listeners
  DOM.closeBtn.addEventListener('click', closePoemReader);
  DOM.reader.addEventListener('click', (e) => e.target === DOM.reader && closePoemReader());
  document.addEventListener('keydown', (e) => e.key === 'Escape' && DOM.reader.classList.contains('active') && closePoemReader());

  DOM.fontToggle?.addEventListener('click', () => {
    currentFont = currentFont === 'serif' ? 'sans' : 'serif';
    localStorage.setItem('poemFontPreference', currentFont);
    applyFontPreference();
  });

  // Engagement listeners
  DOM.engagement.likeBtn?.addEventListener('click', () => {
    if (!currentPoemId) return;
    if (!localLikedPoems[currentPoemId]) {
      localLikedPoems[currentPoemId] = true;
      localStorage.setItem('localLikedPoems', JSON.stringify(localLikedPoems));
      DOM.engagement.likeBtn.classList.add('liked');
      socket.emit('like_poem', currentPoemId);
    }
    createFloatingLike();
  });

  DOM.engagement.form?.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = DOM.engagement.input.value.trim();
    if (text && currentPoemId) {
      socket.emit('add_comment', { poemId: currentPoemId, text });
      DOM.engagement.input.value = '';
    }
  });
});

function switchSection(targetNav, targetSection) {
  DOM.nav.links.forEach(link => link?.classList.remove('active'));
  targetNav.classList.add('active');

  DOM.sections.all.forEach(section => {
    if (section) {
      section.style.display = 'none';
      section.classList.remove('active');
    }
  });

  if (targetSection) {
    targetSection.style.display = 'block';
    setTimeout(() => targetSection.classList.add('active'), 10);
  }
}
