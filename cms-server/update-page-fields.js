/**
 * 将JSON格式的PAGE_FIELDS配置转换为JavaScript格式并更新到app.js
 */

const fs = require('fs');
const path = require('path');

// 读取JSON配置
const configPath = path.join(__dirname, 'page-fields-config.js');
const configContent = fs.readFileSync(configPath, 'utf8');

// 提取JSON部分
const jsonMatch = configContent.match(/const PAGE_FIELDS = ({[\s\S]*});/);
if (!jsonMatch) {
  console.error('无法解析配置文件');
  process.exit(1);
}

const PAGE_FIELDS = JSON.parse(jsonMatch[1]);

// 生成JavaScript代码
let jsCode = 'const PAGE_FIELDS = {\n';

Object.entries(PAGE_FIELDS).forEach(([pageKey, fields]) => {
  jsCode += `  ${pageKey}: [\n`;
  fields.forEach(f => {
    jsCode += `    { key:'${f.key}', label:'${f.label}', type:'${f.type}' },\n`;
  });
  jsCode += `  ],\n`;
});

jsCode += '};\n';

// 读取app.js
const appJsPath = path.join(__dirname, '../admin/assets/js/app.js');
let appJs = fs.readFileSync(appJsPath, 'utf8');

// 替换PAGE_FIELDS
const pageFieldsRegex = /const PAGE_FIELDS = {[\s\S]*?^};/m;
if (!pageFieldsRegex.test(appJs)) {
  console.error('无法在app.js中找到PAGE_FIELDS');
  process.exit(1);
}

appJs = appJs.replace(pageFieldsRegex, jsCode);

// 写回app.js
fs.writeFileSync(appJsPath, appJs, 'utf8');

console.log('✅ PAGE_FIELDS已更新到app.js');
console.log('更新的页面:');
Object.keys(PAGE_FIELDS).forEach(page => {
  console.log(`  - ${page}: ${PAGE_FIELDS[page].length} 个字段`);
});
