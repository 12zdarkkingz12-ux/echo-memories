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

// ========================= Font Size (محفوظ بـ localStorage) =========================
const FONT_KEY = 'reader-font-size';
const FONT_DEFAULT = 18;
const FONT_MIN = 12;
const FONT_MAX = 32;

const setupFontControls = () => {
  const container = document.querySelector('.chapter-content');
  if (!container) return;

  // استرجع الحجم المحفوظ أو استخدم الافتراضي
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

// ========================= Cache Buster =========================
const bustCache = () => {
  if ('caches' in window) caches.keys().then(names => names.forEach(name => caches.delete(name)));
};
bustCache();

// ========================= Init =========================
window.addEventListener('load', () => {
  setupThemeBtn();
  setupFontControls();
});
