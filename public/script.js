// ========================= Theme =========================
const applyTheme = () => {
  const isLight = localStorage.getItem('theme') === 'light';
  document.body.classList.toggle('light', isLight);
  const btn = document.getElementById('theme-switch');
  if (btn) btn.textContent = isLight ? '☀️' : '🌙';
};
if (!localStorage.getItem('theme')) localStorage.setItem('theme', 'dark');
applyTheme();

const setupThemeBtn = () => {
  const btn = document.getElementById('theme-switch');
  if (!btn) return;
  btn.onclick = () => {
    const newTheme = localStorage.getItem('theme') === 'light' ? 'dark' : 'light';
    localStorage.setItem('theme', newTheme);
    applyTheme();
  };
};

// ========================= Sidebar =========================
const setupSidebar = () => {
  const menuBtn   = document.getElementById('menuBtn');
  const sidebar   = document.getElementById('sidebar');
  const overlay   = document.getElementById('sidebarOverlay');
  const closeBtn  = document.getElementById('sidebarClose');
  if (!menuBtn || !sidebar || !overlay) return;

  const open  = () => { sidebar.classList.add('open'); overlay.classList.add('open'); document.body.style.overflow = 'hidden'; };
  const close = () => { sidebar.classList.remove('open'); overlay.classList.remove('open'); document.body.style.overflow = ''; };

  menuBtn.addEventListener('click', open);
  closeBtn && closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', close);
  document.addEventListener('keydown', e => e.key === 'Escape' && close());
};

// ========================= Font Slider =========================
const FONT_KEY     = 'reader-font-size';
const FONT_DEFAULT = 18;

const setupFontControls = () => {
  const container = document.getElementById('chapterContent');
  const slider    = document.getElementById('fontSlider');
  const display   = document.getElementById('fontDisplay');
  if (!container || !slider) return;

  let fontSize = parseFloat(localStorage.getItem(FONT_KEY)) || FONT_DEFAULT;
  slider.value = fontSize;
  container.style.fontSize = fontSize + 'px';
  if (display) display.textContent = fontSize;

  slider.addEventListener('input', () => {
    fontSize = parseFloat(slider.value);
    container.style.fontSize = fontSize + 'px';
    if (display) display.textContent = fontSize;
    localStorage.setItem(FONT_KEY, fontSize);
  });
};

// ========================= Reading Progress =========================
const setupReadingProgress = () => {
  const chapter = document.getElementById('chapterContent');
  if (!chapter) return;
  const bar = document.createElement('div');
  bar.className = 'reading-progress';
  document.body.prepend(bar);

  window.addEventListener('scroll', () => {
    const rect = chapter.getBoundingClientRect();
    const total = rect.height - window.innerHeight;
    if (total <= 0) { bar.style.width = '100%'; return; }
    const scrolled = -rect.top;
    bar.style.width = Math.min(100, Math.max(0, (scrolled / total) * 100)) + '%';
  }, { passive: true });
};

// ========================= Back to Top =========================
const setupBackTop = () => {
  const btn = document.getElementById('backTop');
  if (!btn) return;
  window.addEventListener('scroll', () => {
    btn.classList.toggle('visible', window.scrollY > 300);
  }, { passive: true });
  btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
};

// ========================= First Commenter Badge =========================
const markFirstCommenter = () => {
  const comments = document.querySelectorAll('.one-comment');
  if (!comments.length) return;
  const seen = new Set();
  comments.forEach(c => {
    const userEl = c.querySelector('strong');
    if (!userEl) return;
    const name = userEl.textContent.trim();
    if (seen.has(name)) return;
    seen.add(name);
    const badge = document.createElement('span');
    badge.className = 'first-comment-badge';
    badge.textContent = '✦';
    userEl.after(badge);
  });
};

// ========================= Petals (only on ?welcome=1) =========================
const spawnPetals = () => {
  const params = new URLSearchParams(location.search);
  if (!params.has('welcome')) return;

  const colors = ['#b47edc', '#d8b4fe', 'rgba(255,255,255,0.7)', '#c084fc', '#e879f9'];
  const count  = 25;

  for (let i = 0; i < count; i++) {
    setTimeout(() => {
      const petal = document.createElement('div');
      petal.className = 'petal';
      const size = 10 + Math.random() * 16;
      const startX = Math.random() * 100;
      const endX = startX + (Math.random() - 0.5) * 30;
      const duration = 3.5 + Math.random() * 3;
      const color = colors[Math.floor(Math.random() * colors.length)];

      petal.style.cssText = `
        left:${startX}%;
        top:-40px;
        width:${size}px;
        height:${size * 0.7}px;
        background:${color};
        border-radius:60% 40% 60% 40%;
        animation-duration:${duration}s;
        animation-delay:0s;
        --petal-end:translateY(110vh) translateX(${(endX - startX)}vw) rotate(${360 + Math.random()*360}deg) scale(0.6);
      `;

      document.body.appendChild(petal);
      petal.addEventListener('animationend', () => petal.remove());
    }, i * 120);
  }

  // Remove ?welcome=1 from URL without reload
  const url = new URL(location.href);
  url.searchParams.delete('welcome');
  history.replaceState({}, '', url);
};

// ========================= Form Loading State =========================
const setupFormLoading = () => {
  document.querySelectorAll('form').forEach(form => {
    form.addEventListener('submit', () => {
      const btn = form.querySelector('button[type=submit]');
      if (btn) {
        btn.classList.add('loading');
        btn.textContent = '⏳ جاري الإرسال…';
      }
    });
  });
};

// ========================= Flash Message =========================
const setupFlash = () => {
  const params = new URLSearchParams(location.search);
  if (!params.has('commented')) return;
  const flash = document.createElement('div');
  flash.className = 'flash-msg';
  flash.textContent = '✅ تم إرسال التعليق!';
  document.body.appendChild(flash);
  requestAnimationFrame(() => flash.classList.add('show'));
  setTimeout(() => {
    flash.classList.remove('show');
    setTimeout(() => flash.remove(), 400);
  }, 3000);
};

// ========================= Cache Buster =========================
if ('caches' in window) caches.keys().then(names => names.forEach(name => caches.delete(name)));

// ========================= Init =========================
window.addEventListener('DOMContentLoaded', () => {
  setupThemeBtn();
  setupSidebar();
  setupFontControls();
  setupReadingProgress();
  setupBackTop();
  markFirstCommenter();
  setupFormLoading();
  setupFlash();
  spawnPetals();
});
