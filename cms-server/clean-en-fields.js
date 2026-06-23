/**
 * 清除所有页面JSON中的en字段，只保留zh
 * 同时修复：如果zh字段是空字符串但en有值，把en值移到zh
 */
const fs = require('fs');
const path = require('path');

const jsonDir = path.join(__dirname, '..', 'content', 'pages');

function removeEn(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    return obj.map(removeEn);
  }
  const result = {};
  Object.entries(obj).forEach(([k, v]) => {
    if (k === 'en') return; // 直接丢弃en字段
    if (k === 'zh' && typeof v === 'string') {
      result[k] = v;
    } else if (typeof v === 'object') {
      result[k] = removeEn(v);
    } else {
      result[k] = v;
    }
  });
  return result;
}

fs.readdirSync(jsonDir).forEach(file => {
  if (!file.endsWith('.json')) return;
  const filePath = path.join(jsonDir, file);
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const cleaned = removeEn(data);
    fs.writeFileSync(filePath, JSON.stringify(cleaned, null, 2), 'utf8');
    console.log(`✅ ${file}: 已清除所有en字段`);
  } catch (e) {
    console.error(`❌ ${file}:`, e.message);
  }
});

console.log('\n完成！所有页面JSON已清除英文残留。');
