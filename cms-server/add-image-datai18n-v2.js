#!/usr/bin/env node
/**
 * 为所有 HTML 文件添加缺失的 data-i18n 属性
 * 安全模式：只添加属性，绝不修改任何文本内容
 */

const fs = require('fs');
const path = require('path');

const htmlDir = process.argv[2] || __dirname.replace('/cms/server', '');

// 需要添加 data-i18n 的常见模式
const PATTERNS = [
  // Hero 背景图
  {
    regex: /<img([^>]*?)src=["']([^"']*(?:hero|jeddah|riyadh|banner)[^"']*?)["']([^>]*?)>/gi,
    getKey: (src) => 'hero.bgImage',
    description: 'Hero 背景图'
  },
  // 侧边栏二维码
  {
    regex: /<img([^>]*?)src=["']([^"']*(?:qr-personal|wechat1)[^"']*?)["']([^>]*?)>/gi,
    getKey: () => 'sidebar.qr.personal',
    description: '个人微信二维码'
  },
  {
    regex: /<img([^>]*?)src=["']([^"']*(?:qr-enterprise|wechat2)[^"']*?)["']([^>]*?)>/gi,
    getKey: () => 'sidebar.qr.enterprise',
    description: '企业微信二维码'
  },
  {
    regex: /<img([^>]*?)src=["']([^"']*(?:qr-whatsapp|whatsapp)[^"']*?)["']([^>]*?)>/gi,
    getKey: () => 'sidebar.qr.whatsapp',
    description: 'WhatsApp 二维码'
  }
];

function addDataI18n(htmlFile) {
  let content = fs.readFileSync(htmlFile, 'utf8');
  let modified = false;
  const changes = [];
  
  PATTERNS.forEach(pattern => {
    content = content.replace(pattern.regex, (match, before, src, after) => {
      // 检查是否已有 data-i18n
      if (match.includes('data-i18n=') || match.includes('data-i18n="')) {
        return match;
      }
      
      const key = pattern.getKey(src);
      changes.push(`${pattern.description} → ${key}`);
      modified = true;
      
      // 在 <img 后面插入 data-i18n
      return `<img data-i18n="${key}"${before}src="${src}"${after}>`;
    });
  });
  
  if (modified) {
    fs.writeFileSync(htmlFile, content, 'utf8');
    console.log(`✅ ${path.basename(htmlFile)}:\n   ${changes.join('\n   ')}`);
    return true;
  } else {
    console.log(`⏭ ${path.basename(htmlFile)}: 无需修改`);
    return false;
  }
}

function main() {
  const htmlFiles = fs.readdirSync(htmlDir)
    .filter(f => f.endsWith('.html') && !f.startsWith('zsts-'))
    .map(f => path.join(htmlDir, f));
  
  console.log(`找到 ${htmlFiles.length} 个 HTML 文件\n`);
  
  let modifiedCount = 0;
  htmlFiles.forEach(file => {
    if (addDataI18n(file)) modifiedCount++;
  });
  
  console.log(`\n完成！修改了 ${modifiedCount} 个文件。`);
}

main();
