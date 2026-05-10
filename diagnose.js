// =============================================
// تشخيص سريع لـ Echo Memories
// =============================================
const startTime = Date.now();
const results = {
  time: new Date().toISOString(),
  environment: {},
  files: {},
  supabase: null,
  server: null
};

console.log('🩺 بدء التشخيص...\n');

// 1. متغيرات البيئة (بدون إظهار الأسرار كاملة)
console.log('📋 1. متغيرات البيئة:');
const envVars = [
  'NODE_ENV', 'PORT', 'SITE_URL', 'DISCORD_SERVER_URL',
  'SUPABASE_URL', 'SESSION_SECRET', 'DISCORD_CLIENT_ID',
  'DISCORD_REDIRECT_URI', 'ASSET_VERSION'
];
envVars.forEach(key => {
  const val = process.env[key];
  const safe = val ? (val.length > 40 ? val.substring(0, 40) + '...' : val) : '❌ غير موجود';
  results.environment[key] = val ? '✅ موجود' : '❌ مفقود';
  console.log(`   ${key}: ${safe}`);
});

// 2. ملفات المشروع
console.log('\n📁 2. الملفات الأساسية:');
const fs = require('fs');
const path = require('path');
const filesToCheck = [
  'server.js',
  'package.json',
  '.env',
  'views/index.ejs',
  'views/novel.ejs',
  'views/read.ejs',
  'views/dashboard.ejs',
  'views/admin.ejs',
  'views/404.ejs',
  'public/style.css',
  'public/script.js',
  'public/logo.png',
  'public/default-cover.jpg'
];
filesToCheck.forEach(file => {
  const exists = fs.existsSync(path.join(__dirname, file));
  results.files[file] = exists ? '✅ موجود' : '❌ غير موجود';
  console.log(`   ${file}: ${results.files[file]}`);
});

// 3. اتصال Supabase
console.log('\n🗄️ 3. اتصال Supabase:');
const testSupabase = async () => {
  try {
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_KEY || ''
    );
    
    const { data, error } = await supabase
      .from('users')
      .select('count', { count: 'exact', head: true });
    
    if (error) {
      console.log(`   ❌ فشل: ${error.message}`);
      results.supabase = `❌ ${error.message}`;
    } else {
      console.log('   ✅ اتصال ناجح');
      results.supabase = '✅ ناجح';
    }
  } catch (err) {
    console.log(`   ❌ خطأ: ${err.message}`);
    results.supabase = `❌ ${err.message}`;
  }
};

// 4. Express سريع
console.log('\n🚀 4. محاولة تشغيل Express مصغر:');
const testExpress = () => {
  try {
    const express = require('express');
    const app = express();
    app.set('view engine', 'ejs');
    
    // محاولة تحميل القالب الرئيسي
    try {
      const ejs = require('ejs');
      const template = fs.readFileSync(
        path.join(__dirname, 'views', 'index.ejs'), 'utf8'
      );
      console.log('   ✅ قالب index.ejs تم تحميله');
      results.files['index.ejs صالح'] = '✅';
    } catch (err) {
      console.log(`   ❌ فشل تحميل القالب: ${err.message}`);
      results.files['index.ejs صالح'] = `❌ ${err.message}`;
    }
    
    console.log('   ✅ Express يعمل');
    results.server = '✅ يعمل';
  } catch (err) {
    console.log(`   ❌ فشل: ${err.message}`);
    results.server = `❌ ${err.message}`;
  }
};

// تشغيل كل الاختبارات
(async () => {
  await testSupabase();
  testExpress();
  
  const duration = Date.now() - startTime;
  console.log(`\n⏱️ مدة التشخيص: ${duration}ms`);
  console.log('\n📊 ملخص النتائج:');
  console.log(JSON.stringify(results, null, 2));
  
  console.log('\n💡 إذا فشل اتصال Supabase، تأكد من:');
  console.log('   - SUPABASE_URL و SUPABASE_SERVICE_KEY صحيحين');
  console.log('   - عنوان IP غير محظور في إعدادات Supabase');
  console.log('   - الجدول users موجود في قاعدة البيانات');
  
  process.exit(0);
})();