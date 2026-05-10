-- 1. جدول المستخدمين (من ديسكورد)
CREATE TABLE users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  discord_id TEXT UNIQUE NOT NULL,
  username TEXT NOT NULL,
  avatar TEXT,
  role TEXT DEFAULT 'عضو' CHECK (role IN ('ضيف', 'عضو', 'مؤلف', 'مؤلف_أسطوري', 'مشرف', 'مطور')),
  created_at TIMESTAMP DEFAULT NOW()
);

-- 2. جدول الروايات
CREATE TABLE novels (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  author_id UUID REFERENCES users(id) ON DELETE CASCADE,
  category TEXT,
  cover_image TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 3. جدول الفصول
CREATE TABLE chapters (
  id SERIAL PRIMARY KEY,
  novel_id INTEGER REFERENCES novels(id) ON DELETE CASCADE,
  chapter_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  published_at TIMESTAMP DEFAULT NOW()
);

-- 4. جدول التعليقات (مع حذف ناعم وسلة مهملات)
CREATE TABLE comments (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  target_type TEXT CHECK (target_type IN ('novel', 'chapter')) NOT NULL,
  target_id INTEGER NOT NULL,
  content TEXT NOT NULL,
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_by UUID REFERENCES users(id),
  deleted_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 5. دالة تلقائية لحذف التعليقات بعد 3 أشهر (تنفذ مرة كل يوم عبر pg_cron أو يدوي)
-- نصنع إجراءً مخزناً
CREATE OR REPLACE FUNCTION delete_old_comments()
RETURNS void AS $$
BEGIN
  -- حذف التعليقات التي مضى عليها 3 أشهر وأكثر، مع إبقاء سلة مهملات 5 أيام للمطور
  -- أولاً: ننقل التعليقات القديمة إلى جدول أرشيف (اختياري) أو نحذفها نهائياً
  DELETE FROM comments
  WHERE is_deleted = TRUE 
    AND deleted_at < NOW() - INTERVAL '5 days';
    
  -- ثانياً: نضع علامة حذف على التعليقات القديمة جداً (أكثر من 3 أشهر)
  UPDATE comments
  SET is_deleted = TRUE, deleted_at = NOW(), deleted_by = NULL
  WHERE created_at < NOW() - INTERVAL '3 months'
    AND is_deleted = FALSE;
END;
$$ LANGUAGE plpgsql;