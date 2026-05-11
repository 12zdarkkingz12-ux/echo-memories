require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const { createClient } = require('@supabase/supabase-js');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const sanitizeHtml = require('sanitize-html');

const app = express();

app.set('trust proxy', 1);

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const SITE_NAME = 'Echo Memories';
const SITE_LOGO = '/logo.png';
const DEFAULT_COVER = '/default-cover.jpg';
const AUTHOR_ROLES = ['مؤلف', 'مؤلف_أسطوري', 'مطور'];
const ROLE_ORDER = ['ضيف', 'عضو', 'مؤلف', 'مؤلف_أسطوري', 'مشرف', 'مطور'];

const CATEGORY_GROUPS = {
  basic: ['أكشن', 'مغامرة', 'فانتازيا', 'رومانسي', 'دراما', 'غموض', 'رعب', 'خيال علمي', 'كوميديا', 'نفسي'],
  worlds: ['زراعة', 'شوانهوان (Xuanhuan)', 'ووشيا (Wuxia)', 'شيانشيا (Xianxia)', 'داو', 'نظام', 'زنزانات', 'صيادين', 'سحر', 'فنون قتالية', 'تناسخ', 'انتقال لعالم آخر', 'سفر عبر الزمن'],
  popularTags: ['بطل قوي', 'انتقام', 'ذكاء وتخطيط', 'بطل شرير', 'بناء مملكة', 'تطور الشخصية', 'أسرار', 'قوى خاصة'],
  status: ['مستمرة', 'مكتملة', 'متوقفة'],
};

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

app.use(rateLimit({
  windowMs: 60 * 1000,
  limit: 200,
  message: 'تجاوزت الحد.',
}));

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
    maxAge: 7 * 24 * 60 * 60 * 1000,
  },
}));

app.use(passport.initialize());
app.use(passport.session());

app.use((req, res, next) => {
  res.locals.csrfToken = '';
  res.locals.user = req.user || null;
  res.locals.discordServerUrl = process.env.DISCORD_SERVER_URL || '#';
  res.locals.siteUrl = process.env.SITE_URL || '';
  res.locals.assetVersion = process.env.ASSET_VERSION || '1';
  res.locals.siteName = SITE_NAME;
  res.locals.siteLogo = SITE_LOGO;
  res.locals.defaultCover = DEFAULT_COVER;
  res.locals.categoryGroups = CATEGORY_GROUPS;
  res.locals.authorRoles = AUTHOR_ROLES;
  res.locals.currentPath = req.originalUrl.split('#')[0];
  next();
});

function normalizeText(value) {
  return String(value ?? '').trim();
}

function sanitizeContent(raw) {
  const cleaned = sanitizeHtml(String(raw ?? ''), { allowedTags: [], allowedAttributes: {} });
  return cleaned.replace(/\n/g, '<br>');
}

function validateComment(content) {
  if (!content || typeof content !== 'string') return false;
  const trimmed = content.trim();
  return trimmed.length >= 2 && trimmed.length <= 2000 ? trimmed : false;
}

function validateChapter(data) {
  const errors = [];
  if (!data.novel_id || isNaN(parseInt(data.novel_id))) errors.push('معرف الرواية غلط');
  if (!data.chapter_number || isNaN(parseInt(data.chapter_number))) errors.push('رقم الفصل غلط');
  if (!data.title || data.title.trim().length < 2) errors.push('العنوان قصير');
  if (!data.content || data.content.trim().length < 10) errors.push('المحتوى قصير');
  return errors;
}

function isValidUUID(str) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(str || '').trim());
}

function checkRole(minRole) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).render('error', { message: 'سجل دخولك أولاً', code: 401 });
    const current = ROLE_ORDER.indexOf(req.user.role);
    const required = ROLE_ORDER.indexOf(minRole);
    if (current >= required) return next();
    return res.status(403).render('error', { message: 'ما عندك صلاحية لهذه الصفحة', code: 403 });
  };
}

function firstNonEmpty(...values) {
  for (const value of values) {
    const text = normalizeText(value);
    if (text) return text;
  }
  return '';
}

function getNovelAuthorName(novel) {
  return firstNonEmpty(novel.author_name, novel.users?.username, novel.author_uuid, 'مجهول');
}

function decorateNovel(novel) {
  const tags = Array.isArray(novel.tags) ? novel.tags.filter(Boolean) : [];
  return {
    ...novel,
    tags,
    author_display: getNovelAuthorName(novel),
    chapter_count: Array.isArray(novel.chapters) ? novel.chapters.length : 0,
  };
}

function matchesNovelFilters(novel, query) {
  const search = normalizeText(query.q).toLowerCase();
  const genre = normalizeText(query.genre);
  const world = normalizeText(query.world);
  const tag = normalizeText(query.tag);
  const status = normalizeText(query.status);

  const haystack = [
    novel.title,
    novel.author_display,
    novel.users?.username,
    novel.genre,
    novel.world,
    novel.status,
    ...(novel.tags || []),
  ].map(v => normalizeText(v).toLowerCase()).join(' ');

  if (search && !haystack.includes(search)) return false;
  if (genre && genre !== 'الكل' && novel.genre !== genre) return false;
  if (world && world !== 'الكل' && novel.world !== world) return false;
  if (tag && tag !== 'الكل' && !(novel.tags || []).includes(tag)) return false;
  if (status && status !== 'الكل' && novel.status !== status) return false;
  return true;
}

function buildCommentRedirect(returnTo) {
  let target = normalizeText(returnTo) || '/';
  if (target.includes('#')) target = target.split('#')[0];
  const sep = target.includes('?') ? '&' : '?';
  return `${target}${sep}commented=1#comments`;
}

async function fetchNovelDirectory() {
  const { data, error } = await supabase
    .from('novels')
    .select('*, users(username, avatar, role), chapters(id)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(decorateNovel);
}

async function fetchAuthorChoices() {
  const { data, error } = await supabase
    .from('users')
    .select('id, username, discord_id, role, avatar')
    .in('role', AUTHOR_ROLES)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

async function fetchAllUsers() {
  const { data, error } = await supabase
    .from('users')
    .select('id, discord_id, username, role, avatar, created_at')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

passport.use(new DiscordStrategy({
  clientID: process.env.DISCORD_CLIENT_ID,
  clientSecret: process.env.DISCORD_CLIENT_SECRET,
  callbackURL: process.env.DISCORD_REDIRECT_URI,
  scope: ['identify'],
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const { data: existingUser } = await supabase
      .from('users')
      .select('*')
      .eq('discord_id', profile.id)
      .maybeSingle();

    const OWNER_USERNAMES = ['dark_9d'];
    const OWNER_IDS_ENV = (process.env.OWNER_DISCORD_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
    const isOwner = OWNER_USERNAMES.includes(profile.username) || OWNER_IDS_ENV.includes(profile.id);

    if (!existingUser) {
      const { data: newUser, error } = await supabase.from('users').insert([{ 
        discord_id: profile.id,
        username: profile.username,
        avatar: profile.avatar ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png` : null,
        role: isOwner ? 'مطور' : 'عضو',
      }]).select().single();
      if (error) throw error;
      return done(null, newUser);
    }

    if (isOwner && existingUser.role !== 'مطور') {
      await supabase.from('users').update({ role: 'مطور' }).eq('id', existingUser.id);
      existingUser.role = 'مطور';
    }

    return done(null, existingUser);
  } catch (err) {
    return done(err, null);
  }
}));

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  try {
    const { data: user, error } = await supabase.from('users').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    done(null, user || null);
  } catch (err) {
    done(err, null);
  }
});

app.get('/', async (req, res, next) => {
  try {
    const novels = await fetchNovelDirectory();
    const filtered = novels.filter(novel => matchesNovelFilters(novel, req.query));
    res.render('index', {
      novels: filtered,
      allNovelsCount: novels.length,
      filters: {
        q: normalizeText(req.query.q),
        genre: normalizeText(req.query.genre) || 'الكل',
        world: normalizeText(req.query.world) || 'الكل',
        tag: normalizeText(req.query.tag) || 'الكل',
        status: normalizeText(req.query.status) || 'الكل',
      },
    });
  } catch (err) {
    console.error('Error in /:', err);
    next(err);
  }
});

app.get('/novel/:id', async (req, res, next) => {
  try {
    const novelId = parseInt(req.params.id);
    if (isNaN(novelId)) return res.status(400).render('error', { message: 'طلب غير صحيح', code: 400 });

    const { data: novel, error } = await supabase
      .from('novels')
      .select('*, users(username, avatar, role)')
      .eq('id', novelId)
      .single();
    if (error || !novel) return res.status(404).render('404');

    const { data: chapters } = await supabase
      .from('chapters')
      .select('*')
      .eq('novel_id', novelId)
      .order('chapter_number', { ascending: true });

    const { data: comments } = await supabase
      .from('comments')
      .select('*, users(username, avatar, discord_id)')
      .eq('target_type', 'novel')
      .eq('target_id', novelId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false });

    let visibleChapters = chapters || [];
    if (!req.user || req.user.role === 'ضيف') visibleChapters = (chapters || []).slice(0, 4);

    res.render('novel', {
      novel: decorateNovel({ ...novel, chapters }),
      chapters: visibleChapters,
      allChaptersCount: chapters?.length || 0,
      comments: comments || [],
    });
  } catch (err) {
    next(err);
  }
});

app.get('/read/:novelId/:chapterId', async (req, res, next) => {
  try {
    const novelId = parseInt(req.params.novelId);
    const chapterId = parseInt(req.params.chapterId);
    if (isNaN(novelId) || isNaN(chapterId)) return res.status(400).render('error', { message: 'طلب غير صحيح', code: 400 });

    const { data: chapter, error } = await supabase
      .from('chapters')
      .select('*, novels(id, title, author_name, genre, world, status, tags, cover_image, users(username))')
      .eq('id', chapterId)
      .single();
    if (error || !chapter) return res.status(404).render('404');

    if (chapter.novel_id && chapter.novel_id !== novelId) {
      return res.status(404).render('404');
    }

    if ((!req.user || req.user.role === 'ضيف') && chapter.chapter_number > 4) {
      return res.status(403).render('error', { message: 'أول 4 فصول مجانية، سجّل دخولك عشان تكمل القراءة', code: 403 });
    }

    const { data: comments } = await supabase
      .from('comments')
      .select('*, users(username, avatar, discord_id)')
      .eq('target_type', 'chapter')
      .eq('target_id', chapterId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false });

    const { data: prevChapter } = await supabase
      .from('chapters')
      .select('id, chapter_number, title')
      .eq('novel_id', novelId)
      .eq('chapter_number', chapter.chapter_number - 1)
      .maybeSingle();

    const { data: nextChapter } = await supabase
      .from('chapters')
      .select('id, chapter_number, title')
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
    if (!req.user) {
      if (req.accepts('json')) return res.status(401).json({ error: 'سجّل دخولك أولاً' });
      return res.status(401).render('error', { message: 'سجّل دخولك أولاً', code: 401 });
    }

    const { target_type, target_id, content, return_to } = req.body;
    if (!['novel', 'chapter'].includes(target_type)) {
      if (req.accepts('json')) return res.status(400).json({ error: 'طلب غير صحيح' });
      return res.status(400).render('error', { message: 'طلب غير صحيح', code: 400 });
    }

    const targetId = parseInt(target_id);
    if (isNaN(targetId)) {
      if (req.accepts('json')) return res.status(400).json({ error: 'طلب غير صحيح' });
      return res.status(400).render('error', { message: 'طلب غير صحيح', code: 400 });
    }

    const cleanContent = validateComment(content);
    if (!cleanContent) {
      if (req.accepts('json')) return res.status(400).json({ error: 'التعليق إما فاضي أو يتجاوز 2000 حرف' });
      return res.status(400).render('error', { message: 'التعليق إما فاضي أو يتجاوز 2000 حرف', code: 400 });
    }

    const { data: inserted, error } = await supabase
      .from('comments')
      .insert([{ user_id: req.user.id, target_type, target_id: targetId, content: cleanContent, created_at: new Date() }])
      .select('id, content, created_at, target_type, target_id')
      .single();
    if (error) throw error;

    const payload = {
      comment: {
        id: inserted.id,
        content: inserted.content,
        created_at: inserted.created_at,
        target_type: inserted.target_type,
        target_id: inserted.target_id,
        users: {
          username: req.user.username,
          avatar: req.user.avatar,
          discord_id: req.user.discord_id,
        },
      },
    };

    const wantsJson = req.xhr || req.headers.accept?.includes('application/json') || req.body.ajax === '1';
    if (wantsJson) return res.status(201).json(payload);

    return res.redirect(buildCommentRedirect(return_to));
  } catch (err) {
    next(err);
  }
});

app.post('/comment/delete/:id', async (req, res, next) => {
  try {
    if (!req.user) return res.status(401).render('error', { message: 'سجّل دخولك أولاً', code: 401 });
    const commentId = parseInt(req.params.id);
    if (isNaN(commentId)) return res.status(400).render('error', { message: 'طلب غير صحيح', code: 400 });

    const { data: comment } = await supabase.from('comments').select('*').eq('id', commentId).single();
    if (!comment) return res.status(404).render('404');
    if (!['مشرف', 'مطور', 'مؤلف_أسطوري'].includes(req.user.role)) {
      return res.status(403).render('error', { message: 'ما عندك صلاحية لحذف هذا التعليق', code: 403 });
    }

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
    const authorChoices = await fetchAuthorChoices();
    if (req.user.role === 'مطور' || req.user.role === 'مشرف') {
      const novels = await fetchNovelDirectory();
      const users = req.user.role === 'مطور' ? await fetchAllUsers() : [];
      return res.render('admin', {
        novels,
        authorChoices,
        users,
        stats: {
          novels: novels.length,
          authors: authorChoices.length,
          users: users.length,
        },
      });
    }

    const { data: myNovelsRaw, error } = await supabase
      .from('novels')
      .select('*, users(username, avatar, role), chapters(id)')
      .eq('author_id', req.user.id)
      .order('created_at', { ascending: false });
    if (error) throw error;
    const myNovels = (myNovelsRaw || []).map(decorateNovel);
    res.render('dashboard', { novels: myNovels, authorChoices });
  } catch (err) {
    next(err);
  }
});

app.post('/chapter/new', checkRole('مؤلف'), async (req, res, next) => {
  try {
    const errors = validateChapter(req.body);
    if (errors.length > 0) return res.status(400).render('error', { message: errors.join(' | '), code: 400 });

    const novelId = parseInt(req.body.novel_id);
    const { data: novel } = await supabase.from('novels').select('author_id').eq('id', novelId).single();
    if (!novel || (novel.author_id !== req.user.id && !['مشرف', 'مطور'].includes(req.user.role))) {
      return res.status(403).render('error', { message: 'هذي الرواية مو ملكك', code: 403 });
    }

    const { error } = await supabase.from('chapters').insert([{ 
      novel_id: novelId,
      chapter_number: parseInt(req.body.chapter_number),
      title: req.body.title.trim(),
      content: req.body.content.trim(),
    }]);
    if (error) throw error;
    res.redirect(`/novel/${novelId}`);
  } catch (err) {
    next(err);
  }
});

app.post('/novel/new', checkRole('مشرف'), async (req, res, next) => {
  try {
    const title = normalizeText(req.body.title);
    const authorMode = normalizeText(req.body.author_mode) || 'list';
    const authorPick = normalizeText(req.body.author_pick);
    const authorUuid = normalizeText(req.body.author_uuid);
    const authorName = normalizeText(req.body.author_name);
    const genre = normalizeText(req.body.genre);
    const world = normalizeText(req.body.world);
    const status = normalizeText(req.body.status) || 'مستمرة';
    const coverImage = normalizeText(req.body.cover_image);
    const tags = Array.isArray(req.body.tags) ? req.body.tags.map(normalizeText).filter(Boolean) : req.body.tags ? [normalizeText(req.body.tags)] : [];

    if (title.length < 2) return res.status(400).render('error', { message: 'عنوان الرواية مطلوب', code: 400 });
    if (!genre) return res.status(400).render('error', { message: 'اختر تصنيفًا أساسيًا للرواية', code: 400 });
    if (!world) return res.status(400).render('error', { message: 'اختر العالم أو النظام', code: 400 });
    if (!CATEGORY_GROUPS.status.includes(status)) return res.status(400).render('error', { message: 'حالة الرواية غير صحيحة', code: 400 });

    let finalAuthorId = null;
    let finalAuthorName = authorName;
    let finalAuthorUuid = null;

    if (authorMode === 'uuid') {
      if (!isValidUUID(authorUuid)) return res.status(400).render('error', { message: 'UUID المؤلف غير صحيح', code: 400 });
      finalAuthorUuid = authorUuid;
      if (!finalAuthorName) finalAuthorName = authorUuid;
    } else {
      if (!isValidUUID(authorPick)) return res.status(400).render('error', { message: 'اختر مؤلفًا من القائمة أو غيّر إلى UUID', code: 400 });
      finalAuthorId = authorPick;
      const { data: pickedAuthor } = await supabase.from('users').select('username').eq('id', authorPick).maybeSingle();
      if (!pickedAuthor) return res.status(400).render('error', { message: 'المؤلف المختار غير موجود', code: 400 });
      if (!finalAuthorName) finalAuthorName = pickedAuthor.username;
    }

    const { error } = await supabase.from('novels').insert([{ 
      title,
      author_id: finalAuthorId,
      author_uuid: finalAuthorUuid,
      author_name: finalAuthorName,
      genre,
      world,
      tags,
      status,
      cover_image: coverImage || null,
    }]);
    if (error) throw error;
    res.redirect('/dashboard');
  } catch (err) {
    next(err);
  }
});

app.post('/dev/user-role', checkRole('مطور'), async (req, res, next) => {
  try {
    const userId = normalizeText(req.body.user_id);
    const role = normalizeText(req.body.role);
    if (!isValidUUID(userId)) return res.status(400).render('error', { message: 'UUID المستخدم غير صحيح', code: 400 });
    if (!ROLE_ORDER.includes(role)) return res.status(400).render('error', { message: 'الرتبة غير صحيحة', code: 400 });
    const { error } = await supabase.from('users').update({ role }).eq('id', userId);
    if (error) throw error;
    res.redirect('/dashboard');
  } catch (err) {
    next(err);
  }
});

app.get('/auth/discord', passport.authenticate('discord'));
app.get('/auth/discord/callback',
  passport.authenticate('discord', { failureRedirect: '/?auth=failed' }),
  (req, res) => res.redirect('/?welcome=1')
);

app.get('/logout', (req, res, next) => {
  req.logout(err => {
    if (err) return next(err);
    res.redirect('/');
  });
});

app.use((req, res) => res.status(404).render('404'));
app.use((err, req, res, next) => {
  console.error('Server error:', err.message || err);
  res.status(500).render('error', { message: 'صار خطأ في الخادم، نعتذر. حاول مرة ثانية.', code: 500 });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 ${SITE_NAME} يعيش على المنفذ ${PORT}`));
