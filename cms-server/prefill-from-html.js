/**
 * 一键把所有 HTML 页面的 data-i18n 当前值抓取到对应 JSON 文件
 * 解决「编辑器打开时所有字段都为空」的问题
 */
const fs = require('fs');
const path = require('path');

const PAGE_MAP = {
  home: 'index.html',
  about: 'about.html',
  visa: 'visa.html',
  'saudi-visa': 'saudi-visa.html',
  enterprise: 'enterprise.html',
  transport: 'transport.html',
  insurance: 'insurance.html',
  inspection: 'inspection.html',
};

function parseSnapshot(html) {
  const snapshot = {};
  // 1. <tag ... data-i18n="key">文本</tag>
  const textRe = /<([a-zA-Z][a-zA-Z0-9]*)\b[^>]*\bdata-i18n="([a-zA-Z0-9_.\-]+)"[^>]*>([\s\S]*?)<\/\1>/g;
  let m;
  while ((m = textRe.exec(html)) !== null) {
    const key = m[2];
    if (snapshot[key] !== undefined) continue;
    const inner = m[3]
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .trim();
    if (inner) snapshot[key] = { zh: inner, en: '' };
  }
  // 2. <img data-i18n="key" src="...">
  const imgRe = /<img\b[^>]*\bdata-i18n="([a-zA-Z0-9_.\-]+)"[^>]*\bsrc="([^"]*)"[^>]*\/?>/g;
  while ((m = imgRe.exec(html)) !== null) {
    const key = m[1];
    if (snapshot[key] !== undefined) continue;
    if (m[2]) snapshot[key] = m[2];
  }
  // 3. 行内 background-image:url(...)
  const bgRe2 = /<([a-zA-Z][a-zA-Z0-9]*)\b[^>]*\bstyle="[^"]*background-image\s*:\s*url\(([^)]+)\)[^"]*"[^>]*\bdata-i18n="([a-zA-Z0-9_.\-]+)"[^>]*>/g;
  while ((m = bgRe2.exec(html)) !== null) {
    const key = m[3];
    if (snapshot[key] !== undefined) continue;
    const url = m[2].replace(/^['"]|['"]$/g, '').trim();
    if (url) snapshot[key] = url;
  }
  return snapshot;
}

function setNested(obj, flatKey, val) {
  const parts = flatKey.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length; i++) {
    if (i === parts.length - 1) {
      if (cur[parts[i]] == null) {
        cur[parts[i]] = (val && typeof val === 'object') ? val : { zh: String(val || ''), en: '' };
      }
    } else {
      cur[parts[i]] = cur[parts[i]] || {};
      cur = cur[parts[i]];
    }
  }
}

const root = path.join(__dirname, '..', '..');
const jsonDir = path.join(__dirname, '..', 'content', 'pages');

Object.entries(PAGE_MAP).forEach(([pageKey, htmlFile]) => {
  const htmlPath = path.join(root, htmlFile);
  const jsonPath = path.join(jsonDir, `${pageKey}.json`);
  if (!fs.existsSync(htmlPath)) {
    console.log(`⚠️  ${htmlFile} 不存在，跳过`);
    return;
  }
  const html = fs.readFileSync(htmlPath, 'utf8');
  const snapshot = parseSnapshot(html);

  let data = {};
  if (fs.existsSync(jsonPath)) {
    try { data = JSON.parse(fs.readFileSync(jsonPath, 'utf8')); } catch (e) {}
  }

  // 合并：snapshot 不覆盖已有内容
  let added = 0;
  Object.entries(snapshot).forEach(([k, v]) => {
    const parts = k.split('.');
    let cur = data;
    let exists = true;
    for (let i = 0; i < parts.length; i++) {
      if (cur[parts[i]] == null) { exists = false; break; }
      cur = cur[parts[i]];
    }
    if (!exists) {
      setNested(data, k, v);
      added++;
    }
  });

  fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2), 'utf8');
  console.log(`✅ ${pageKey}.json: 抓取 ${Object.keys(snapshot).length} 字段，新增 ${added} 字段`);
});

console.log('\n🎉 全部页面内容已预填充完成！现在打开 CMS 编辑器，所有字段都会显示当前 HTML 中的实际值。');
