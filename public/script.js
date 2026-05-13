// ═══════════════════════════════════════════════════════════════
// صدى الذكريات · Echo Memories — Dark Manuscript v3 · script.js
// ═══════════════════════════════════════════════════════════════

// ── Theme ────────────────────────────────────────────────────────
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

// ── Sidebar ──────────────────────────────────────────────────────
const setupSidebar = () => {
  const menuBtn  = document.getElementById('menuBtn');
  const sidebar  = document.getElementById('sidebar');
  const overlay  = document.getElementById('sidebarOverlay');
  const closeBtn = document.getElementById('sidebarClose');
  if (!menuBtn || !sidebar || !overlay) return;

  const open  = () => { sidebar.classList.add('open');    overlay.classList.add('open');    document.body.style.overflow = 'hidden'; };
  const close = () => { sidebar.classList.remove('open'); overlay.classList.remove('open'); document.body.style.overflow = ''; };

  menuBtn.addEventListener('click', open);
  closeBtn && closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', close);
  document.addEventListener('keydown', e => e.key === 'Escape' && close());
};

// ── Star Field Canvas ────────────────────────────────────────────
let starCanvas, starCtx, stars = [], animFrame;
const STAR_COUNT = 130;

const initStars = () => {
  starCanvas = document.getElementById('starCanvas');
  if (!starCanvas) return;
  starCtx = starCanvas.getContext('2d');
  resizeCanvas();
  stars = Array.from({ length: STAR_COUNT }, newStar);
  if (animFrame) cancelAnimationFrame(animFrame);
  animateStars();
};

const resizeCanvas = () => {
  if (!starCanvas) return;
  starCanvas.width  = window.innerWidth;
  starCanvas.height = window.innerHeight;
};

const newStar = () => ({
  x: Math.random() * window.innerWidth,
  y: Math.random() * window.innerHeight,
  r: Math.random() * 1.4 + 0.2,
  alpha: Math.random() * 0.6 + 0.2,
  speed: Math.random() * 0.22 + 0.04,
  twinkle: Math.random() * Math.PI * 2,
  twinkleSpeed: Math.random() * 0.02 + 0.006,
});

const animateStars = () => {
  if (!starCtx) return;
  starCtx.clearRect(0, 0, starCanvas.width, starCanvas.height);
  const isLight   = document.body.classList.contains('light');
  const baseColor = isLight ? '100,60,200' : '175,140,255';

  for (const s of stars) {
    s.twinkle += s.twinkleSpeed;
    const a = s.alpha * (0.55 + 0.45 * Math.sin(s.twinkle));
    starCtx.beginPath();
    starCtx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    starCtx.fillStyle = `rgba(${baseColor},${a.toFixed(2)})`;
    starCtx.fill();
    s.y -= s.speed;
    if (s.y < -3) { s.y = starCanvas.height + 3; s.x = Math.random() * starCanvas.width; }
  }
  animFrame = requestAnimationFrame(animateStars);
};

window.addEventListener('resize', () => {
  resizeCanvas();
  stars = Array.from({ length: STAR_COUNT }, newStar);
}, { passive: true });

// ── 3D Card Tilt ─────────────────────────────────────────────────
const setupCardTilt = () => {
  if (window.matchMedia('(hover: none)').matches) return;
  const cards = document.querySelectorAll('.novel-card');
  cards.forEach(card => {
    card.addEventListener('mousemove', e => {
      const rect = card.getBoundingClientRect();
      const dx   = (e.clientX - (rect.left + rect.width  / 2)) / (rect.width  / 2);
      const dy   = (e.clientY - (rect.top  + rect.height / 2)) / (rect.height / 2);
      card.style.transform  = `perspective(900px) rotateX(${dy * -7}deg) rotateY(${dx * 7}deg) translateY(-6px) scale(1.01)`;
      card.style.transition = 'transform 0.08s linear, box-shadow 0.3s';
    });
    card.addEventListener('mouseleave', () => {
      card.style.transform  = '';
      card.style.transition = 'transform 0.55s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.3s';
      setTimeout(() => { card.style.transition = ''; }, 560);
    });
  });
};

// ── Cursor Sparks ────────────────────────────────────────────────
let lastSpark = 0;
const SPARK_COLORS = ['#a855f7','#c084fc','#e879f9','#7c3aed','#ddd6fe','#f0abfc'];

const setupCursorSparks = () => {
  if (window.matchMedia('(hover: none)').matches) return;
  document.addEventListener('mousemove', e => {
    const now = Date.now();
    if (now - lastSpark < 65) return;
    lastSpark = now;
    const spark = document.createElement('div');
    spark.className = 'cursor-spark';
    const size  = Math.random() * 5 + 3;
    const color = SPARK_COLORS[Math.floor(Math.random() * SPARK_COLORS.length)];
    spark.style.cssText = `left:${e.clientX - size/2}px;top:${e.clientY - size/2}px;width:${size}px;height:${size}px;background:${color};box-shadow:0 0 ${size*2}px ${color};`;
    document.body.appendChild(spark);
    spark.addEventListener('animationend', () => spark.remove());
  });
};

// ── Scroll Reveal ────────────────────────────────────────────────
const setupScrollReveal = () => {
  const selector = '.chapter-card,.one-comment,.info-card,.stat-card,.novel-list-item,.form-card,.lock-notice,.search-panel';
  const targets  = document.querySelectorAll(selector);
  if (!targets.length) return;

  targets.forEach(el => { if (!el.classList.contains('reveal')) el.classList.add('reveal'); });

  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if (!entry.isIntersecting) return;
      setTimeout(() => entry.target.classList.add('in-view'), i * 55);
      io.unobserve(entry.target);
    });
  }, { threshold: 0.07, rootMargin: '0px 0px -25px 0px' });

  targets.forEach(el => io.observe(el));
};

// ── Font Slider ───────────────────────────────────────────────────
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

// ── Reading Progress ──────────────────────────────────────────────
const setupReadingProgress = () => {
  const chapter = document.getElementById('chapterContent');
  if (!chapter) return;
  const bar = document.createElement('div');
  bar.className = 'reading-progress';
  document.body.prepend(bar);

  window.addEventListener('scroll', () => {
    const rect  = chapter.getBoundingClientRect();
    const total = rect.height - window.innerHeight;
    if (total <= 0) { bar.style.width = '100%'; return; }
    const scrolled = -rect.top;
    bar.style.width = Math.min(100, Math.max(0, (scrolled / total) * 100)) + '%';
  }, { passive: true });
};

// ── Back to Top ───────────────────────────────────────────────────
const setupBackTop = () => {
  const btn = document.getElementById('backTop');
  if (!btn) return;
  window.addEventListener('scroll', () => {
    btn.classList.toggle('visible', window.scrollY > 300);
  }, { passive: true });
  btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
};

// ── Header Shrink ─────────────────────────────────────────────────
const setupHeaderShrink = () => {
  const header = document.querySelector('header');
  if (!header) return;
  window.addEventListener('scroll', () => {
    header.style.height = window.scrollY > 60 ? '54px' : '';
  }, { passive: true });
};

// ── Utility ───────────────────────────────────────────────────────
const escapeHtml = (value) => String(value ?? '')
  .replaceAll('&',  '&amp;')
  .replaceAll('<',  '&lt;')
  .replaceAll('>',  '&gt;')
  .replaceAll('"',  '&quot;')
  .replaceAll("'",  '&#39;');

const showFlash = (message, isError = false) => {
  document.querySelectorAll('.flash-msg').forEach(f => f.remove());
  const flash = document.createElement('div');
  flash.className = 'flash-msg' + (isError ? ' error' : '');
  flash.textContent = message;
  document.body.appendChild(flash);
  requestAnimationFrame(() => flash.classList.add('show'));
  setTimeout(() => { flash.classList.remove('show'); setTimeout(() => flash.remove(), 350); }, 2600);
};

const makeCommentNode = (comment) => {
  const avatarUrl = comment?.users?.avatar
    ? (String(comment.users.avatar).startsWith('http') ? comment.users.avatar : '/logo.png')
    : '/logo.png';
  const name    = escapeHtml(comment?.users?.username || 'مجهول');
  const date    = new Date(comment?.created_at || Date.now()).toLocaleString('ar');
  const content = escapeHtml(comment?.content || '').replaceAll('\n', '<br>');
  const wrapper = document.createElement('div');
  wrapper.className = 'one-comment new-comment';
  wrapper.innerHTML = `
    <div class="comment-avatar"><img src="${avatarUrl}" alt="${name}" onerror="this.src='/logo.png'"></div>
    <div class="comment-body">
      <strong>${name}</strong>
      <span class="comment-date">${date}</span>
      <p>${content}</p>
    </div>`;
  return wrapper;
};

// ── First Commenter Badge ─────────────────────────────────────────
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
    badge.style.animation = 'popIn 0.4s ease forwards';
    userEl.after(badge);
  });
};

// ── Petals (on ?welcome=1) ────────────────────────────────────────
const spawnPetals = () => {
  const params = new URLSearchParams(location.search);
  if (!params.has('welcome')) return;
  const colors = ['#a855f7','#c084fc','rgba(255,255,255,0.65)','#e879f9','#ddd6fe'];
  for (let i = 0; i < 30; i++) {
    setTimeout(() => {
      const petal  = document.createElement('div');
      petal.className = 'petal';
      const size   = 10 + Math.random() * 16;
      const startX = Math.random() * 100;
      const endX   = startX + (Math.random() - 0.5) * 30;
      const dur    = 3.5 + Math.random() * 3;
      const color  = colors[Math.floor(Math.random() * colors.length)];
      petal.style.cssText = `left:${startX}%;top:-40px;width:${size}px;height:${size*0.65}px;background:${color};border-radius:60% 40% 60% 40%;animation-duration:${dur}s;--petal-end:translateY(110vh) translateX(${endX-startX}vw) rotate(${360+Math.random()*360}deg) scale(0.5);`;
      document.body.appendChild(petal);
      petal.addEventListener('animationend', () => petal.remove());
    }, i * 100);
  }
  const url = new URL(location.href);
  url.searchParams.delete('welcome');
  history.replaceState({}, '', url);
};

// ── Form Loading ──────────────────────────────────────────────────
const setupFormLoading = () => {
  document.querySelectorAll('form').forEach(form => {
    form.addEventListener('submit', () => {
      const btn = form.querySelector('button[type=submit]');
      if (btn) {
        btn.classList.add('loading');
        btn.dataset.originalText = btn.dataset.originalText || btn.textContent;
        btn.textContent = '⏳ جاري الإرسال…';
      }
    });
  });
};

// ── Flash from URL ────────────────────────────────────────────────
const setupFlash = () => {
  const params = new URLSearchParams(location.search);
  if (params.has('commented')) showFlash('✅ تم إرسال التعليق!');
};

// ── Author Mode (dashboard) ───────────────────────────────────────
const setupAuthorMode = () => {
  const mode     = document.getElementById('authorMode');
  const pickWrap = document.getElementById('authorPickWrap');
  const uuidWrap = document.getElementById('authorUuidWrap');
  const pick     = document.getElementById('authorPick');
  const name     = document.getElementById('authorName');
  if (!mode || !pickWrap || !uuidWrap || !name) return;

  const syncMode = () => {
    const isUuid = mode.value === 'uuid';
    pickWrap.classList.toggle('hidden-field', isUuid);
    uuidWrap.classList.toggle('hidden-field', !isUuid);
    if (!isUuid && pick && pick.selectedOptions[0]) {
      const label = pick.selectedOptions[0].dataset.username || pick.selectedOptions[0].textContent.split('·')[0].trim();
      if (!name.value) name.value = label;
    }
  };
  mode.addEventListener('change', syncMode);
  pick && pick.addEventListener('change', () => {
    if (mode.value === 'list' && pick.selectedOptions[0]) {
      const label = pick.selectedOptions[0].dataset.username || pick.selectedOptions[0].textContent.split('·')[0].trim();
      if (name.value.trim() === '' || name.value === label) name.value = label;
    }
  });
  syncMode();
};

// ── AJAX Comments ─────────────────────────────────────────────────
const setupAjaxComments = () => {
  document.querySelectorAll('form[data-comment-form]').forEach(form => {
    const list = form.closest('.comments-section')?.querySelector('[data-comment-list]');
    if (!list) return;
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const textarea  = form.querySelector('textarea[name="content"]');
      const submitBtn = form.querySelector('button[type="submit"]');
      const fd = new FormData(form);
      fd.append('ajax', '1');
      try {
        if (submitBtn) submitBtn.disabled = true;
        const response = await fetch(form.action, {
          method: 'POST',
          headers: { 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
          body: fd,
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'تعذر إرسال التعليق');
        const empty = list.querySelector('[data-empty-comments]');
        if (empty) empty.remove();
        const node = makeCommentNode(data.comment);
        list.prepend(node);
        if (textarea) textarea.value = '';
        showFlash('✅ تم إرسال التعليق!');
        node.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } catch (error) {
        showFlash(error.message || 'حصلت مشكلة أثناء الإرسال', true);
        HTMLFormElement.prototype.submit.call(form);
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  });
};

// ── Cache Buster ──────────────────────────────────────────────────
if ('caches' in window) caches.keys().then(names => names.forEach(n => caches.delete(n)));

// ── Init ──────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  setupThemeBtn();
  setupSidebar();
  initStars();
  setupCardTilt();
  setupCursorSparks();
  setupScrollReveal();
  setupFontControls();
  setupReadingProgress();
  setupBackTop();
  setupHeaderShrink();
  markFirstCommenter();
  setupFormLoading();
  setupFlash();
  spawnPetals();
  setupAuthorMode();
  setupAjaxComments();
});
