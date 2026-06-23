#!/usr/bin/env node
/**
 * 安全添加 data-i18n 属性到 HTML 文件
 * 只添加缺失的属性，绝不修改任何文本内容
 */

const fs = require('fs');
const path = require('path');

const htmlDir = process.argv[2] || __dirname.replace('/cms/server', '');

// 图片字段映射：CSS 选择器 → data-i18n key
const IMAGE_FIELDS = {
  // 通用
  'section.hero img, .hero img, [class*="hero"] img': 'hero.bgImage',
  '.sidebar img, [class*="sidebar"] img': null, // 需要更具体的选择器
};

// 为每个 HTML 文件添加 data-i18n 属性（只读模式，只添加属性）
function addDataI18nSafe(htmlFile) {
  let content = fs.readFileSync(htmlFile, 'utf8');
  let modified = false;
  
  // 1. 为 <img> 添加 data-i18n（如果还没有）
  // 匹配：<img ...> 且没有 data-i18n 属性的
  content = content.replace(
    /<img([^>]*?)>/gi,
    (match, attrs) => {
      // 如果已经有 data-i18n，跳过
      if (attrs.includes('data-i18n=') || attrs.includes('data-i18n="')) {
        return match;
      }
      
      // 尝试根据 src 推断 key
      const srcMatch = attrs.match(/src=["']([^"']+)["']/i);
      if (!srcMatch) return match;
      
      const src = srcMatch[1];
      let key = null;
      
      // 根据文件名推断 key
      if (src.includes('jeddah-tower') || src.includes('riyadh-skyline') || src.includes('hero')) {
        key = 'hero.bgImage';
      } else if (src.includes('qr-personal') || src.includes('wechat1')) {
        key = 'sidebar.qr.personal';
      } else if (src.includes('qr-enterprise') || src.includes('wechat2')) {
        key = 'sidebar.qr.enterprise';
      } else if (src.includes('qr-whatsapp') || src.includes('whatsapp')) {
        key = 'sidebar.qr.whatsapp';
      }
      
      if (key) {
        modified = true;
        return `<img${attrs} data-i18n="${key}">`;
      }
      
      return match;
    }
  );
  
  if (modified) {
    fs.writeFileSync(htmlFile, content, 'utf8');
    console.log(`✅ ${path.basename(htmlFile)}: 添加了图片 data-i18n 属性`);
  } else {
    console.log(`⏭ ${path.basename(htmlFile)}: 无需修改`);
  }
}

// 主函数
function main() {
  const htmlFiles = fs.readdirSync(htmlDir)
    .filter(f => f.endsWith('.html') && !f.startsWith('zsts-'))
    .map(f => path.join(htmlDir, f));
  
  console.log(`找到 ${htmlFiles.length} 个 HTML 文件\n`);
  
  htmlFiles.forEach(addDataI18nSafe);
  
  console.log('\n完成！所有图片 data-i18n 属性已添加。');
}

main();
