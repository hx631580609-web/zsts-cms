/**
 * ZSTS CMS 后端入口
 * Port: 3001
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { initDB } = require('./db/setup');

// 初始化数据库
initDB();

const app = express();
const PORT = process.env.PORT || 3001;

// 中间件
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const multer = require('multer');
const uploadDir = path.join(__dirname, '../uploads/images');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.png';
    const name = `img_${Date.now()}${Math.random().toString(36).slice(2, 8)}${ext}`;
    cb(null, name);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg','.jpeg','.png','.gif','.webp','.svg'];
    const ext = path.extname(file.originalname).toLowerCase();
    allowed.includes(ext) ? cb(null, true) : cb(new Error('不支持的图片格式'));
  }
});

app.post('/api/upload', require('./middleware/auth').requireAuth, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: '未选择文件' });
  res.json({
    url: `/uploads/images/${req.file.filename}`,
    filename: req.file.filename,
    size: req.file.size
  });
});

// 静态文件
app.use('/admin', express.static(path.join(__dirname, '../admin')));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use('/local-cdn', express.static(path.join(__dirname, '../../local-cdn')));
app.use('/images', express.static(path.join(__dirname, '../../images')));
// 预览模式下，/preview/images/* 等相对路径也要能访问到正确资源
app.use('/preview/images', express.static(path.join(__dirname, '../../images')));
app.use('/preview/local-cdn', express.static(path.join(__dirname, '../../local-cdn')));

// favicon: 静默返回 204 避免浏览器控制台 404 报错
app.get('/favicon.ico', (req, res) => res.status(204).end());

// 预览客户端 JS v2（兼容已缓存的旧版 HTML）
app.get('/preview-client-v2.js', (req, res) => {
  const filePath = path.join(__dirname, 'preview-client.js');
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) return res.status(404).send('// not found');
    res.removeHeader('Cache-Control');
    res.removeHeader('Last-Modified');
    res.removeHeader('ETag');
    res.set({
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': 'Thu, 01 Jan 1970 00:00:00 GMT',
    });
    res.send(data);
  });
});

// 预览客户端 JS v4（禁用缓存，确保每次都加载最新版）
app.get('/preview-client-v4.js', (req, res) => {
  const filePath = path.join(__dirname, 'preview-client.js');
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) return res.status(404).send('// not found');
    res.removeHeader('Cache-Control');
    res.removeHeader('Last-Modified');
    res.removeHeader('ETag');
    res.set({
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': 'Thu, 01 Jan 1970 00:00:00 GMT',
    });
    res.send(data);
  });
});

// 预览模式：托管官网前端页面，注入预览客户端 JS，并修复相对路径
app.get('/preview/*', (req, res) => {
  // 从 /preview/index.html 提取实际文件名
  const htmlFile = req.params[0] || 'index.html';
  const frontendPath = path.join(__dirname, '../../', htmlFile);

  // HTML 文件名 → CMS pageKey 映射
  const htmlToPageKey = {
    'index.html':        'home',
    'about.html':        'about',
    'visa.html':         'visa',
    'saudi-visa.html':   'saudi-visa',
    'enterprise.html':   'enterprise',
    'transport.html':    'transport',
    'insurance.html':    'insurance',
    'inspection.html':   'inspection',
  };
  const pageKey = htmlToPageKey[htmlFile] || '';
  
  fs.readFile(frontendPath, 'utf8', (err, data) => {
    if (err) return res.status(404).send('页面不存在');

    let injected = data;

    // 修复资源相对路径：把 href="local-cdn/xxx" 和 src="local-cdn/xxx" 改成绝对路径
    // 但不修改页面导航链接（如 href="visa.html"），让它们保持相对路径
    // 这样导航链接会指向 /preview/xxx.html，资源链接指向 /local-cdn/xxx
    injected = injected
      .replace(/href="local-cdn\//g, 'href="/local-cdn/')
      .replace(/src="local-cdn\//g, 'src="/local-cdn/')
      .replace(/href="images\//g, 'href="/images/')
      .replace(/src="images\//g, 'src="/images/');

    // 注入预览标志 + pageKey
    let previewScript = '<script>window.CMS_PREVIEW=1;';
    if (pageKey) previewScript += `\nwindow.CMS_PAGE_KEY='${pageKey}';`;
    previewScript += '</script>';
    injected = injected.replace('<head>', `<head>\n    ${previewScript}`);

    // 注入预览客户端 JS v4（每次更新 JS 改文件名以破坏缓存）
    injected = injected.replace('</body>', `<script src="/preview-client-v4.js"></script></body>`);

    // 禁用预览页面的浏览器缓存，确保每次都加载最新版 HTML + JS
    res.set({
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    }).send(injected);
  });
});

// 路由（需要认证的API）
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./middleware/auth').requireAuth, require('./routes/users'));
// 内容API：GET无需认证（预览模式需要），PUT需要认证（在routes/content.js内部处理）
app.use('/api/content', require('./routes/content'));
app.use('/api/logs', require('./middleware/auth').requireAuth, require('./routes/logs'));
app.use('/api/ai-channels', require('./middleware/auth').requireAuth, require('./routes/ai-channels'));

// ── AI 内容生成代理（需 CMS 认证，支持 URL token 传参用于 iframe）
const { createProxyMiddleware } = require('http-proxy-middleware');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('./middleware/auth');

function aiAuth(req, res, next) {
  // 途径1：Authorization header（API 调用）
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    try {
      req.user = jwt.verify(header.split(' ')[1], JWT_SECRET);
      return next();
    } catch {}
  }
  // 途径2：URL query token（iframe 嵌入）
  const token = req.query.token;
  if (token) {
    try {
      req.user = jwt.verify(token, JWT_SECRET);
      return next();
    } catch {
      return res.status(401).json({ error: '令牌已失效，请重新登录' });
    }
  }
  // 途径3：Cookie fallback（Next.js 自身回传）
  const cookieToken = req.cookies?.cms_token;
  if (cookieToken) {
    try {
      req.user = jwt.verify(cookieToken, JWT_SECRET);
      return next();
    } catch {}
  }
  return res.status(401).json({ error: '未提供认证令牌' });
}

const aiProxy = createProxyMiddleware({
  target: 'http://localhost:3000',
  changeOrigin: true,
  ws: true,
  on: {
    proxyReq: (proxyReq, req) => {
      const user = req.user;
      if (user) {
        const cookie = `cms_user=${encodeURIComponent(user.username)}; Path=/`;
        proxyReq.setHeader('Cookie', (proxyReq.getHeader('Cookie') || '') + '; ' + cookie);
        proxyReq.setHeader('X-CMS-User', user.username);
        proxyReq.setHeader('X-CMS-Role', user.role);
      }
    },
  },
});

// 需要 cookie-parser 读 cookie
const cookieParser = require('cookie-parser');
// 注意：不使用 app.use('/prefix', ...) 否则 Express 会剥离前缀
// 导致 Next.js 收到错误路径
app.use(cookieParser(), (req, res, next) => {
  if (!req.path.startsWith('/ai-content')) return next();
  aiAuth(req, res, (err) => {
    if (err) return next(err);
    aiProxy(req, res, next);
  });
});

// 管理后台 SPA 路由兜底
app.get('/admin/*', (req, res) => {
  res.sendFile(path.join(__dirname, '../admin/index.html'));
});

// ── 从前端 HTML 抓取 data-i18n 当前值（用于编辑器首次回显默认值）─────
app.get('/api/page-snapshot/:pageKey', (req, res) => {
  const pageMap = {
    home: 'index.html',
    about: 'about.html',
    visa: 'visa.html',
    'saudi-visa': 'saudi-visa.html',
    enterprise: 'enterprise.html',
    transport: 'transport.html',
    insurance: 'insurance.html',
    inspection: 'inspection.html',
  };
  const htmlFile = pageMap[req.params.pageKey] || `${req.params.pageKey}.html`;
  const htmlPath = path.join(__dirname, '../..', htmlFile);
  if (!fs.existsSync(htmlPath)) return res.status(404).json({ error: 'HTML 文件不存在' });

  let html;
  try {
    html = fs.readFileSync(htmlPath, 'utf8');
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }

  // 用正则匹配所有 data-i18n 元素，提取当前展示的文本/src
  const snapshot = {};
  // 1. <span|div|p|h[1-6] ... data-i18n="key">文本</tag>
  const textRe = /<([a-zA-Z][a-zA-Z0-9]*)\b[^>]*\bdata-i18n="([a-zA-Z0-9_.\-]+)"[^>]*>([\s\S]*?)<\/\1>/g;
  let m;
  while ((m = textRe.exec(html)) !== null) {
    const key = m[2];
    if (snapshot[key] !== undefined) continue; // 后出现的同名 key 跳过
    const inner = m[3]
      .replace(/<br\s*\/?>/gi, '\n')         // <br> 换行
      .replace(/<[^>]+>/g, '')               // 去掉内嵌 HTML
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .trim();
    if (inner) snapshot[key] = { zh: inner, en: '' };
  }
  // 2. <img data-i18n="key" src="...">  (单标签)
  const imgRe = /<img\b[^>]*\bdata-i18n="([a-zA-Z0-9_.\-]+)"[^>]*\bsrc="([^"]*)"[^>]*\/?>/g;
  while ((m = imgRe.exec(html)) !== null) {
    const key = m[1];
    if (snapshot[key] !== undefined) continue;
    if (m[2]) snapshot[key] = m[2];
  }
  // 3. <div ... data-i18n="key" style="background-image:url(...)">  (Hero 背景)
  const bgRe = /<([a-zA-Z][a-zA-Z0-9]*)\b[^>]*\bdata-i18n="([a-zA-Z0-9_.\-]+)"[^>]*\bbackground-image\s*:\s*url\(([^)]+)\)[^>]*>/g;
  while ((m = bgRe.exec(html)) !== null) {
    const key = m[2];
    if (snapshot[key] !== undefined) continue;
    const url = m[3].replace(/^['"]|['"]$/g, '').trim();
    if (url) snapshot[key] = url;
  }
  // 4. 行内 style="... background-image:url(...) ... data-i18n="key"" (顺序在前)
  const bgRe2 = /<([a-zA-Z][a-zA-Z0-9]*)\b[^>]*\bstyle="[^"]*background-image\s*:\s*url\(([^)]+)\)[^"]*"[^>]*\bdata-i18n="([a-zA-Z0-9_.\-]+)"[^>]*>/g;
  while ((m = bgRe2.exec(html)) !== null) {
    const key = m[3];
    if (snapshot[key] !== undefined) continue;
    const url = m[2].replace(/^['"]|['"]$/g, '').trim();
    if (url) snapshot[key] = url;
  }

  res.json({ htmlFile, count: Object.keys(snapshot).length, snapshot });
});

// 根路径重定向到 admin 登录页
app.get('/', (req, res) => res.redirect('/admin/'));

// 错误处理
app.use((err, req, res, next) => {
  console.error('[Error]', err);
  res.status(500).json({ error: err.message || '服务器内部错误' });
});

app.listen(PORT, () => {
  console.log(`\n✅ ZSTS CMS 后端已启动`);
  console.log(`   管理后台：http://localhost:${PORT}/admin/`);
  console.log(`   API Base：http://localhost:${PORT}/api/\n`);
});
