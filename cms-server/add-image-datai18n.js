/**
 * 为所有页面的关键图片添加 data-i18n 属性
 * 包括: Hero背景图、侧边栏二维码、服务图标等
 */
const fs = require('fs');
const path = require('path');

const baseDir = '/Users/littlesnowow/WorkBuddy/2026-06-05-18-10-47';

// 页面配置：每个页面的关键图片映射
const PAGE_IMAGE_CONFIGS = {
  'saudi-visa.html': [
    { pattern: /<img src="images\/jeddah-tower\.jpg"([^>]*)>/g, 
      replacement: '<img src="images/jeddah-tower.jpg"$1 data-i18n="hero.bgImage">' },
    { pattern: /<img src="images\/riyadh-skyline\.jpg"([^>]*)>/g, 
      replacement: '<img src="images/riyadh-skyline.jpg"$1 data-i18n="hero.bgImage">' },
    { pattern: /(<img src="images\/qr-personal\.png")/g, 
      replacement: '$1 data-i18n="sidebar.qr.personal"' },
    { pattern: /(<img src="images\/qr-enterprise\.png")/g, 
      replacement: '$1 data-i18n="sidebar.qr.enterprise"' },
    { pattern: /(<img src="images\/qr-whatsapp\.png")/g, 
      replacement: '$1 data-i18n="sidebar.qr.whatsapp"' },
  ],
  // 其他页面可以按需添加...
};

let totalModified = 0;

for (const [filename, configs] of Object.entries(PAGE_IMAGE_CONFIGS)) {
  const filePath = path.join(baseDir, filename);
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  ${filename} 不存在，跳过`);
    continue;
  }
  
  let html = fs.readFileSync(filePath, 'utf-8');
  let fileModified = false;
  
  for (const config of configs) {
    const newHtml = html.replace(config.pattern, config.replacement);
    if (newHtml !== html) {
      html = newHtml;
      fileModified = true;
      const matches = html.match(new RegExp(config.replacement.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || [];
      console.log(`  ✅ ${filename}: 添加了 ${matches.length} 个图片 data-i18n 属性`);
    }
  }
  
  if (fileModified) {
    fs.writeFileSync(filePath, html);
    totalModified++;
  }
}

console.log(`\n✅ 完成！共修改 ${totalModified} 个文件`);

// 同时为其他页面添加通用的二维码 data-i18n 属性
const otherPages = ['index.html', 'visa.html', 'insurance.html', 'transport.html', 'enterprise.html', 'inspection.html', 'about.html'];

for (const page of otherPages) {
  const filePath = path.join(baseDir, page);
  if (!fs.existsSync(page)) continue;
  
  let html = fs.readFileSync(filePath, 'utf-8');
  let modified = false;
  
  // 二维码图片
  if (html.includes('qr-personal.png') && !html.includes('data-i18n="sidebar.qr.personal"')) {
    // 只替换第一个 img 标签上的 qr-personal.png
    html = html.replace(
      /<img src="images\/qr-personal\.png"/g,
      '<img src="images/qr-personal.png" data-i18n="sidebar.qr.personal"'
    );
    modified = true;
  }
  if (html.includes('qr-enterprise.png') && !html.includes('data-i18n="sidebar.qr.enterprise"')) {
    html = html.replace(
      /<img src="images\/qr-enterprise\.png"/g,
      '<img src="images/qr-enterprise.png" data-i18n="sidebar.qr.enterprise"'
    );
    modified = true;
  }
  if (html.includes('qr-whatsapp.png') && !html.includes('data-i18n="sidebar.qr.whatsapp"')) {
    html = html.replace(
      /<img src="images\/qr-whatsapp\.png"/g,
      '<img src="images/qr-whatsapp.png" data-i18n="sidebar.qr.whatsapp"'
    );
    modified = true;
  }
  
  if (modified) {
    fs.writeFileSync(filePath, html);
    console.log(`  ✅ ${page}: 添加了二维码图片的 data-i18n 属性`);
    totalModified++;
  }
}

console.log(`\n🎉 总共修改了 ${totalModified} 个文件`);
