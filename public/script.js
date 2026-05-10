// ========================= Theme =========================
const themeToggle = () => {
  const isLight = localStorage.getItem('theme') === 'light';
  if (isLight) document.body.classList.add('light');
  else document.body.classList.remove('light');
};
if (!localStorage.getItem('theme')) localStorage.setItem('theme', 'dark');
themeToggle();

const setupThemeBtn = () => {
  const btn = document.getElementById('theme-switch');
  if (btn) btn.onclick = () => {
    const newTheme = localStorage.getItem('theme') === 'light' ? 'dark' : 'light';
    localStorage.setItem('theme', newTheme);
    themeToggle();
  };
};

// ========================= Font Size =========================
const FONT_KEY = 'reader-font-size';
const FONT_DEFAULT = 18;
const FONT_MIN = 12;
const FONT_MAX = 32;

const setupFontControls = () => {
  const container = document.querySelector('.chapter-content');
  if (!container) return;
  let fontSize = parseFloat(localStorage.getItem(FONT_KEY)) || FONT_DEFAULT;
  container.style.fontSize = fontSize + 'px';
  const plus  = document.getElementById('fontPlus');
  const minus = document.getElementById('fontMinus');
  if (plus) plus.onclick = () => {
    if (fontSize >= FONT_MAX) return;
    fontSize += 2;
    container.style.fontSize = fontSize + 'px';
    localStorage.setItem(FONT_KEY, fontSize);
  };
  if (minus) minus.onclick = () => {
    if (fontSize <= FONT_MIN) return;
    fontSize -= 2;
    container.style.fontSize = fontSize + 'px';
    localStorage.setItem(FONT_KEY, fontSize);
  };
};

// ========================= شريط تقدم القراءة =========================
const setupReadingProgress = () => {
  const chapter = document.querySelector('.chapter-content');
  if (!chapter) return;
  const bar = document.createElement('div');
  bar.className = 'reading-progress';
  document.body.prepend(bar);
  window.addEventListener('scroll', () => {
    const rect = chapter.getBoundingClientRect();
    const total = rect.height - window.innerHeight;
    if (total <= 0) return bar.style.width = '100%';
    const scrolled = -rect.top;
    let percent = Math.min(100, Math.max(0, (scrolled / total) * 100));
    bar.style.width = percent + '%';
  });
};

// ========================= بصمة القارئ – نجمة =========================
const markFirstCommenter = () => {
  const comments = document.querySelectorAll('.one-comment');
  if (!comments.length) return;
  const seen = new Set();
  comments.forEach(c => {
    const userEl = c.querySelector('strong');
    if (!userEl) return;
    const name = userEl.textContent;
    if (seen.has(name)) return;
    seen.add(name);
    const badge = document.createElement('span');
    badge.className = 'first-comment-badge';
    badge.textContent = '✦';
    userEl.prepend(badge);
  });
};

// ========================= بتلات الترحيب عند الدخول =========================
const spawnPetals = () => {
  if (sessionStorage.getItem('petals_done')) return;
  sessionStorage.setItem('petals_done', '1');
  for (let i = 0; i < 18; i++) {
    setTimeout(() => {
      const petal = document.createElement('div');
      petal.className = 'petal';
      petal.style.left = Math.random() * 100 + '%';
      petal.style.animationDuration = (2 + Math.random() * 2) + 's';
      petal.style.animationDelay = '0s';
      petal.style.width = (12 + Math.random() * 14) + 'px';
      petal.style.height = petal.style.width;
      document.body.appendChild(petal);
      petal.addEventListener('animationend', () => petal.remove());
    }, i * 80);
  }
};

// ========================= Cache Buster =========================
const bustCache = () => {
  if ('caches' in window) caches.keys().then(names => names.forEach(name => caches.delete(name)));
};
bustCache();

// ========================= Init =========================
window.addEventListener('load', () => {
  setupThemeBtn();
  setupFontControls();
  setupReadingProgress();
  markFirstCommenter();
  spawnPetals();
});
