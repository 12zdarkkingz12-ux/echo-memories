require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const { createClient } = require('@supabase/supabase-js');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const csrf = require('csurf');
const sanitizeHtml = require('sanitize-html');

const app = express();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// ========================= Security Headers =========================
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https://cdn.discordapp.com"],
      fontSrc: ["'self'"],
    },
  },
}));

// ========================= Rate Limiting =========================
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: 'طلبات كثيرة جداً، حاول بعد شوي.',
  standardHeaders: true,
  legacyHeaders: false,
});

const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: 'تجاوزت الحد، خذ نفس.',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(generalLimiter);

// ========================= Core Middleware =========================
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 24 * 7
  }
}));

app.use(passport.initialize());
app.use(passport.session());

// ========================= CSRF =========================
const csrfProtection = csrf({ cookie: false });

app.use((req, res, next) => {
  if (req.path.startsWith('/auth/')) return next();
  csrfProtection(req, res, next);
});

app.use((req, res, next) => {
  if (req.csrfToken) res.locals.csrfToken = req.csrfToken();
  res.locals.user = req.user || null;
  res.locals.discordServerUrl = process.env.DISCORD_SERVER_URL || '#';
  res.locals.siteUrl = process.env.SITE_URL || '';
  res.locals.assetVersion = process.env.ASSET_VERSION || '1';
  next();
});

// ========================= Helpers =========================
function sanitizeContent(raw) {
  const cleaned = sanitizeHtml(raw, { allowedTags: [], allowedAttributes: {} });
  return cleaned.replace(/\n/g, '<br>');
}

function validateComment(content) {
  if (!content || typeof content !== 'string') return false;
  const trimmed = content.trim();
  if (trimmed.length < 2 || trimmed.length > 2000) return false;
  return trimmed;
}

function validateChapter(data) {
  const { novel_id, chapter_number, title, content } = data;
  const errors = [];
  if (!novel_id || isNaN(parseInt(novel_id))) errors.push('معرف الرواية غلط');
  if (!chapter_number || isNaN(parseInt(chapter_number)) || parseInt(chapter_number) < 1) errors.push('رقم الفصل غلط');
  if (!title || title.trim().length < 2 || title.trim().length > 200) errors.push('العنوان يجب أن يكون بين 2 و 200 حرف');
  if (!content || content.trim().length < 10) errors.push('المحتوى قصير جداً');
  return errors;
}

function isValidUUID(str) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

function checkRole(minRole) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).send('سجل دخولك أولاً');
    const roles = ['ضيف', 'عضو', 'مؤلف', 'مؤلف_أسطوري', 'مشرف', 'مطور'];
    const userRank = roles.indexOf(req.user.role);
    const requiredRank = roles.indexOf(minRole);
    if (userRank >= requiredRank) return next();
    res.status(403).send('ما عندك صلاحية لهذي الصفحة');
  };
}

// ========================= Discord Auth =========================
passport.use(new DiscordStrategy({
  clientID: process.env.DISCORD_CLIENT_ID,
  clientSecret: process.env.DISCORD_CLIENT_SECRET,
  callbackURL: process.env.DISCORD_REDIRECT_URI,
  scope: ['identify']
}, async (accessToken, refreshToken, profile, done) => {
  try {
    let { data: user, error } = await supabase
      .from('users').select('*').eq('discord_id', profile.id).maybeSingle();
    if (error) return done(error, null);
    if (!user) {
      const { data: newUser, error: insertError } = await supabase
        .from('users')
        .insert([{
          discord_id: profile.id,
          username: profile.username,
          avatar: profile.avatar
            ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`
            : null,
          role: 'عضو'
        }])
        .select().single();
      if (insertError) return done(insertError, null);
      return done(null, newUser);
    }
    return done(null, user);
  } catch (err) {
    return done(err, null);
  }
}));

passport.serializeUser((user, done) => done(null, user.id));

passport.deserializeUser(async (id, done) => {
  try {
    const { data: user, error } = await supabase
      .from('users').select('*').eq('id', id).single();
    if (error) return done(error, null);
    done(null, user || null);
  } catch (err) {
    done(err, null);
  }
});

// ========================= Routes =========================

app.get('/', async (req, res, next) => {
  try {
    // ✨ إضافة chapters(count) لبطاقات الروايات الجديدة
    const { data: novels, error } = await supabase
      .from('novels').select('*, users(username), chapters(count)').order('created_at', { ascending: false });
    if (error) throw error;
    res.render('index', { novels: novels || [] });
  } catch (err) {
    next(err);
  }
});

app.get('/novel/:id', async (req, res, next) => {
  try {
    const novelId = parseInt(req.params.id);
    if (isNaN(novelId)) return res.status(400).send('معرف غلط');

    const { data: novel, error } = await supabase
      .from('novels').select('*, users(username)').eq('id', novelId).single();
    if (error || !novel) return res.status(404).render('404');

    const { data: chapters } = await supabase
      .from('chapters').select('*').eq('novel_id', novelId)
      .order('chapter_number', { ascending: true });

    const { data: comments } = await supabase
      .from('comments').select('*, users(username, avatar)')
      .eq('target_type', 'novel').eq('target_id', novelId)
      .eq('is_deleted', false).order('created_at', { ascending: false });

    let visibleChapters = chapters || [];
    if (!req.user || req.user.role === 'ضيف') {
      visibleChapters = (chapters || []).slice(0, 4);
    }

    res.render('novel', {
      novel,
      chapters: visibleChapters,
      allChaptersCount: chapters?.length || 0,
      comments: comments || []
    });
  } catch (err) {
    next(err);
  }
});

// باقي الراوتات كما هي في نسختك المصلحة (read, comment, dashboard, admin...)
app.get('/read/:novelId/:chapterId', async (req, res, next) => {
  try {
    const novelId = parseInt(req.params.novelId);
    const chapterId = parseInt(req.params.chapterId);
    if (isNaN(novelId) || isNaN(chapterId)) return res.status(400).send('معرف غلط');

    const { data: chapter, error } = await supabase
      .from('chapters').select('*, novels(title, id)').eq('id', chapterId).single();
    if (error || !chapter) return res.status(404).render('404');

    if ((!req.user || req.user.role === 'ضيف') && chapter.chapter_number > 4) {
      return res.status(403).send('أول 4 فصول مجانية، سجل عشان تكمل.');
    }

    const { data: comments } = await supabase
      .from('comments').select('*, users(username, avatar)')
      .eq('target_type', 'chapter').eq('target_id', chapterId)
      .eq('is_deleted', false).order('created_at', { ascending: false });

    const { data: prevChapter } = await supabase
      .from('chapters').select('id, chapter_number, title')
      .eq('novel_id', novelId)
      .eq('chapter_number', chapter.chapter_number - 1)
      .maybeSingle();

    const { data: nextChapter } = await supabase
      .from('chapters').select('id, chapter_number, title')
      .eq('novel_id', novelId)
      .eq('chapter_number', chapter.chapter_number + 1)
      .maybeSingle();

    const safeContent = sanitizeContent(chapter.content);
    res.render('read', { chapter, safeContent, comments: comments || [], prevChapter, nextChapter });
  } catch (err) {
    next(err);
  }
});

app.post('/comment', async (req, res, next) => {
  try {
    if (!req.user) return res.status(401).send('سجل دخولك');
    const { target_type, target_id, content } = req.body;
    if (!['novel', 'chapter'].includes(target_type)) return res.status(400).send('نوع غلط');
    const targetId = parseInt(target_id);
    if (isNaN(targetId)) return res.status(400).send('معرف غلط');
    const cleanContent = validateComment(content);
    if (!cleanContent) return res.status(400).send('التعليق إما فاضي أو يتجاوز 2000 حرف');
    const { error } = await supabase.from('comments').insert([{
      user_id: req.user.id,
      target_type,
      target_id: targetId,
      content: cleanContent,
      created_at: new Date()
    }]);
    if (error) throw error;
    res.redirect('back');
  } catch (err) {
    next(err);
  }
});

app.post('/comment/delete/:id', async (req, res, next) => {
  try {
    if (!req.user) return res.status(401).send('سجل دخولك');
    const commentId = parseInt(req.params.id);
    if (isNaN(commentId)) return res.status(400).send('معرف غلط');

    const { data: comment } = await supabase.from('comments').select('*').eq('id', commentId).single();
    if (!comment) return res.status(404).send('ما فيه تعليق');

    let isAuthor = false;
    if (comment.target_type === 'novel') {
      const { data: novel } = await supabase.from('novels').select('author_id').eq('id', comment.target_id).single();
      isAuthor = novel?.author_id === req.user.id;
    } else if (comment.target_type === 'chapter') {
      const { data: chap } = await supabase.from('chapters').select('novel_id').eq('id', comment.target_id).single();
      const { data: novel } = await supabase.from('novels').select('author_id').eq('id', chap?.novel_id).single();
      isAuthor = novel?.author_id === req.user.id;
    }

    const canDelete =
      req.user.role === 'مطور' ||
      req.user.role === 'مشرف' ||
      (req.user.role === 'مؤلف_أسطوري' && isAuthor);

    if (!canDelete) return res.status(403).send('ما لك صلاحية تحذف هذا التعليق');

    const { error } = await supabase
      .from('comments')
      .update({ is_deleted: true, deleted_by: req.user.id, deleted_at: new Date() })
      .eq('id', commentId);
    if (error) throw error;

    res.redirect('back');
  } catch (err) {
    next(err);
  }
});

app.get('/dashboard', checkRole('مؤلف'), async (req, res, next) => {
  try {
    if (req.user.role === 'مطور' || req.user.role === 'مشرف') {
      const { data: allNovels, error } = await supabase.from('novels').select('*, users(username)');
      if (error) throw error;
      return res.render('admin', { novels: allNovels || [], user: req.user });
    }
    const { data: myNovels, error } = await supabase.from('novels').select('*').eq('author_id', req.user.id);
    if (error) throw error;
    res.render('dashboard', { novels: myNovels || [] });
  } catch (err) {
    next(err);
  }
});

app.post('/chapter/new', checkRole('مؤلف'), async (req, res, next) => {
  try {
    const errors = validateChapter(req.body);
    if (errors.length > 0) return res.status(400).send(errors.join(' | '));
    const { novel_id, chapter_number, title, content } = req.body;
    const { data: novel } = await supabase.from('novels').select('author_id').eq('id', parseInt(novel_id)).single();
    if (!novel || (novel.author_id !== req.user.id && !['مشرف', 'مطور'].includes(req.user.role))) {
      return res.status(403).send('هذي الرواية مو ملكك');
    }
    const { error } = await supabase.from('chapters').insert([{
      novel_id: parseInt(novel_id),
      chapter_number: parseInt(chapter_number),
      title: title.trim(),
      content: content.trim()
    }]);
    if (error) throw error;
    res.redirect(`/novel/${novel_id}`);
  } catch (err) {
    next(err);
  }
});

app.post('/novel/new', checkRole('مشرف'), async (req, res, next) => {
  try {
    const { title, author_id, category, cover_image } = req.body;
    if (!title || title.trim().length < 2) return res.status(400).send('العنوان مطلوب');
    if (!isValidUUID(author_id)) return res.status(400).send('معرف المؤلف غلط — يجب أن يكون UUID صالح');
    const { error } = await supabase.from('novels').insert([{
      title: title.trim(),
      author_id,
      category: category?.trim() || null,
      cover_image: cover_image?.trim() || null
    }]);
    if (error) throw error;
    res.redirect('/dashboard');
  } catch (err) {
    next(err);
  }
});

// ========================= Auth Routes =========================
app.get('/auth/discord', authLimiter, passport.authenticate('discord'));
app.get('/auth/discord/callback', authLimiter,
  passport.authenticate('discord', { failureRedirect: '/?auth=failed' }),
  (req, res) => res.redirect('/')
);

app.get('/logout', (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    res.redirect('/');
  });
});

// ========================= 404 =========================
app.use((req, res) => {
  res.status(404).render('404');
});

// ========================= Error Handler =========================
app.use((err, req, res, next) => {
  if (err.code === 'EBADCSRFTOKEN') return res.status(403).send('الطلب مو شرعي، حاول مرة ثانية.');
  console.error('Server error:', err.message || err);
  res.status(500).send('صار خطأ في الخادم، نعتذر. حاول مرة ثانية.');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Echo Memories تعيش على http://localhost:${PORT}`));
