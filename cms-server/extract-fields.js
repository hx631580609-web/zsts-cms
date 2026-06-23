/**
 * 从HTML文件提取data-i18n属性，生成PAGE_FIELDS配置模板
 */

const fs = require('fs');
const path = require('path');

const HTML_DIR = '/Users/littlesnowow/WorkBuddy/2026-06-05-18-10-47';
const PAGES = [
  { key: 'saudi-visa', file: 'saudi-visa.html' },
  { key: 'visa', file: 'visa.html' },
  { key: 'insurance', file: 'insurance.html' },
  { key: 'transport', file: 'transport.html' },
  { key: 'enterprise', file: 'enterprise.html' },
  { key: 'inspection', file: 'inspection.html' },
  { key: 'about', file: 'about.html' },
];

const excludedPrefixes = ['nav.', 'footer.', 'modal.'];

function extractFields(htmlFile) {
  const filePath = path.join(HTML_DIR, htmlFile);
  if (!fs.existsSync(filePath)) {
    console.log(`文件不存在: ${filePath}`);
    return [];
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const regex = /data-i18n="([^"]+)"/g;
  const fields = new Set();
  let match;

  while ((match = regex.exec(content)) !== null) {
    const key = match[1];
    // 排除全局字段
    if (!excludedPrefixes.some(p => key.startsWith(p))) {
      fields.add(key);
    }
  }

  return Array.from(fields).sort();
}

function inferType(key) {
  if (key.includes('image') || key.includes('img') || key.includes('qr') || key.includes('photo')) return 'image';
  if (key.includes('desc') || key.includes('content') || key.includes('text') || key.includes('intro')) return 'textarea';
  return 'text';
}

function inferLabel(key) {
  // 简单的中文标签推断
  const parts = key.split('.');
  const lastPart = parts[parts.length - 1];
  
  const labelMap = {
    'title': '标题',
    'subtitle': '副标题',
    'desc': '描述',
    'description': '描述',
    'text': '文本',
    'content': '内容',
    'image': '图片',
    'img': '图片',
    'bg': '背景图',
    'background': '背景图',
    'tag': '标签',
    'badge': '徽章',
    'hero': '大图模块',
    'step': '步骤',
    'process': '办理流程',
    'faq': '常见问题',
    'question': '问题',
    'answer': '答案',
    'name': '名称',
    'phone': '电话',
    'email': '邮箱',
    'address': '地址',
  };

  return labelMap[lastPart] || lastPart;
}

let output = 'const PAGE_FIELDS = {\n';

PAGES.forEach(page => {
  const fields = extractFields(page.file);
  if (fields.length === 0) {
    console.log(`\n${page.key}: 未找到可编辑字段`);
    return;
  }

  console.log(`\n${page.key}: 找到 ${fields.length} 个字段`);
  output += `  '${page.key}': [\n`;
  
  fields.forEach(key => {
    const type = inferType(key);
    const label = inferLabel(key);
    output += `    { key:'${key}', label:'${label}', type:'${type}' },\n`;
    console.log(`  - ${key} (${type})`);
  });

  output += `  ],\n`;
});

output += '};';

// 保存到文件
const outputPath = path.join(HTML_DIR, 'cms/server/generated-page-fields.js');
fs.writeFileSync(outputPath, output, 'utf8');
console.log(`\n✅ 配置已保存到: ${outputPath}`);
console.log('\n请根据实际内容调整 label 和 type，然后合并到 app.js 的 PAGE_FIELDS 中');
