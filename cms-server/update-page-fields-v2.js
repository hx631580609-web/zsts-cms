/**
 * 用完整的新 PAGE_FIELDS 替换 app.js 中的旧配置
 */
const fs = require('fs');
const path = require('path');

const appJsPath = path.join('/Users/littlesnowow/WorkBuddy/2026-06-05-18-10-47/cms/admin/assets/js/app.js');
const fieldsPath = path.join(__dirname, 'full-page-fields.js');

let appJs = fs.readFileSync(appJsPath, 'utf-8');
let newFields = fs.readFileSync(fieldsPath, 'utf-8');

// 提取 PAGE_FIELDS 部分（从 "const PAGE_FIELDS = {" 到下一个 "};;" 或 "};\n\nfunction"）
const pageFieldsMatch = appJs.match(/const PAGE_FIELDS = \{[\s\S]*?\};;/);
if (pageFieldsMatch) {
  console.log('✅ 找到旧的 PAGE_FIELDS 配置');
  
  // 替换
  appJs = appJs.replace(
    /const PAGE_FIELDS = \{[\s\S]*?};;/,
    newFields.trim()
  );
  
  fs.writeFileSync(appJsPath, appJs);
  console.log('✅ PAGE_FIELDS 已更新为完整配置（包含所有文本和图片字段）');
} else {
  console.error('❌ 未找到 PAGE_FIELDS 配置');
}

// 统计新配置中的字段数
const fieldCountMatch = newFields.match(/key:/g);
console.log(`📊 新配置共包含 ${fieldCountMatch ? fieldCountMatch.length : 0} 个可编辑字段`);
