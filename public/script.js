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
  const menuBtn = document.getElementById('menuBtn');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  const closeBtn = document.getElementById('sidebarClose');
  if (!menuBtn || !sidebar || !overlay) return;

  const open = () => { sidebar.classList.add('open'); overlay.classList.add('open'); document.body.style.overflow = 'hidden'; };
  const close = () => { sidebar.classList.remove('open'); overlay.classList.remove('open'); document.body.style.overflow = ''; };

  menuBtn.addEventListener('click', open);
  closeBtn && closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', close);
  document.addEventListener('keydown', e => e.key === 'Escape' && close());
};

// ========================= Font Slider =========================
const FONT_KEY = 'reader-font-size';
const FONT_DEFAULT = 18;

const setupFontControls = () => {
  const container = document.getElementById('chapterContent');
  const slider = document.getElementById('fontSlider');
  const display = document.getElementById('fontDisplay');
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

// ========================= Utility =========================
const escapeHtml = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

const showFlash = (message, isError = false) => {
  const flash = document.createElement('div');
  flash.className = 'flash-msg' + (isError ? ' error' : '');
  flash.textContent = message;
  document.body.appendChild(flash);
  requestAnimationFrame(() => flash.classList.add('show'));
  setTimeout(() => {
    flash.classList.remove('show');
    setTimeout(() => flash.remove(), 350);
  }, 2400);
};

const makeCommentNode = (comment) => {
  const avatarUrl = comment?.users?.avatar
    ? (String(comment.users.avatar).startsWith('http') ? comment.users.avatar : `/logo.png`)
    : '/logo.png';
  const name = escapeHtml(comment?.users?.username || 'مجهول');
  const date = new Date(comment?.created_at || Date.now()).toLocaleString('ar');
  const content = escapeHtml(comment?.content || '').replaceAll('\n', '<br>');

  const wrapper = document.createElement('div');
  wrapper.className = 'one-comment new-comment';
  wrapper.innerHTML = `
    <div class="comment-avatar"><img src="${avatarUrl}" alt="${name}" onerror="this.src='/logo.png'"></div>
    <div class="comment-body">
      <strong>${name}</strong>
      <span class="comment-date">${date}</span>
      <p>${content}</p>
    </div>
  `;
  return wrapper;
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
  const count = 25;

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
        --petal-end:translateY(110vh) translateX(${(endX - startX)}vw) rotate(${360 + Math.random() * 360}deg) scale(0.6);
      `;

      document.body.appendChild(petal);
      petal.addEventListener('animationend', () => petal.remove());
    }, i * 120);
  }

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
        btn.dataset.originalText = btn.dataset.originalText || btn.textContent;
        btn.textContent = '⏳ جاري الإرسال…';
      }
    });
  });
};

// ========================= Flash Message =========================
const setupFlash = () => {
  const params = new URLSearchParams(location.search);
  if (params.has('commented')) showFlash('✅ تم إرسال التعليق!');
};

// ========================= Author Mode =========================
const setupAuthorMode = () => {
  const mode = document.getElementById('authorMode');
  const pickWrap = document.getElementById('authorPickWrap');
  const uuidWrap = document.getElementById('authorUuidWrap');
  const pick = document.getElementById('authorPick');
  const uuid = document.getElementById('authorUuid');
  const name = document.getElementById('authorName');

  if (!mode || !pickWrap || !uuidWrap || !name) return;

  const syncMode = () => {
    const isUuid = mode.value === 'uuid';
    pickWrap.classList.toggle('hidden-field', isUuid);
    uuidWrap.classList.toggle('hidden-field', !isUuid);
    if (!isUuid && pick && pick.selectedOptions[0]) {
      const selected = pick.selectedOptions[0];
      const label = selected.dataset.username || selected.textContent.split('·')[0].trim();
      if (!name.value) name.value = label;
    }
    if (isUuid && uuid && !name.value) {
      name.placeholder = 'اسم الكاتب الظاهر';
    }
  };

  mode.addEventListener('change', syncMode);
  pick && pick.addEventListener('change', () => {
    if (mode.value === 'list' && pick.selectedOptions[0]) {
      const selected = pick.selectedOptions[0];
      const label = selected.dataset.username || selected.textContent.split('·')[0].trim();
      if (name.value.trim() === '' || name.value === label) name.value = label;
    }
  });
  syncMode();
};

// ========================= AJAX Comments =========================
const setupAjaxComments = () => {
  document.querySelectorAll('form[data-comment-form]').forEach(form => {
    const list = form.closest('.comments-section')?.querySelector('[data-comment-list]');
    if (!list) return;

    form.addEventListener('submit', async (event) => {
      event.preventDefault();

      const textarea = form.querySelector('textarea[name="content"]');
      const submitBtn = form.querySelector('button[type="submit"]');
      const fd = new FormData(form);
      fd.append('ajax', '1');

      try {
        submitBtn && (submitBtn.disabled = true);
        const response = await fetch(form.action, {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
          },
          body: fd,
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data.error || 'تعذر إرسال التعليق');
        }

        const empty = list.querySelector('[data-empty-comments]');
        if (empty) empty.remove();

        const commentNode = makeCommentNode(data.comment);
        list.prepend(commentNode);
        textarea && (textarea.value = '');
        showFlash('✅ تم إرسال التعليق!');
        commentNode.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } catch (error) {
        showFlash(error.message || 'حصلت مشكلة أثناء الإرسال', true);
        HTMLFormElement.prototype.submit.call(form);
      } finally {
        submitBtn && (submitBtn.disabled = false);
      }
    });
  });
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
  setupAuthorMode();
  setupAjaxComments();
});
