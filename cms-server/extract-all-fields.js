/**
 * 全面提取所有页面的 data-i18n 字段并生成 PAGE_FIELDS 配置
 * 包括：文本字段 + 图片字段（<img> 标签）
 */
const fs = require('fs');
const path = require('path');

// 页面映射
const PAGE_MAP = {
  'index':        { file: 'index.html',         label: '首页' },
  'saudi-visa':   { file: 'saudi-visa.html',    label: '沙特签证' },
  'visa':         { file: 'visa.html',          label: '全球签证' },
  'insurance':    { file: 'insurance.html',     label: '境外保险' },
  'transport':    { file: 'transport.html',     label: '境外交通住宿' },
  'enterprise':   { file: 'enterprise.html',    label: '企业出海' },
  'inspection':   { file: 'inspection.html',    label: '企业考察' },
  'about':        { file: 'about.html',         label: '关于我们' },
};

// 全局字段前缀（不需要在页面编辑器中重复出现）
const GLOBAL_PREFIXES = ['nav.', 'footer.', 'modal.'];

// 友好的中文标签映射
function getFriendlyLabel(key) {
  const labels = {
    // Hero 区域
    'hero.badge':       '大图徽章标签',
    'hero.title':       '大图主标题',
    'hero.title1':      '大图标题（行1）',
    'hero.title2':      '大图标题（行2）',
    'hero.subtitle':    '大图副标题',
    'hero.desc':        '大图描述',
    'hero.services':    '服务/业务标签',
    'hero.cta1':        '按钮一文案',
    'hero.cta2':        '按钮二文案',
    'hero.bgImage':     '大图背景图片',
    
    // Section 通用
    'section.process.tag':      '办理流程-区域标签',
    'section.process.title':    '办理流程-标题',
    'section.process.subtitle': '办理流程-副标题',
    'section.materials.tag':    '申请材料-区域标签',
    'section.materials.title':  '申请材料-标题',
    'section.materials.subtitle':'申请材料-副标题',
    'section.faq.tag':          '常见问题-区域标签',
    'section.faq.title':        '常见问题-标题',
    'section.regions.tag':      '热门国家-区域标签',
    'section.regions.title':    '热门国家-标题',
    'section.regions.subtitle': '热门国家-副标题',
    'section.types.tag':        '保险类型-区域标签',
    'section.types.title':      '保险类型-标题',
    'section.types.subtitle':   '保险类型-副标题',
    'section.advantages.tag':   '服务优势-区域标签',
    'section.advantages.title': '服务优势-标题',
    'section.advantages.subtitle':'服务优势-副标题',
    'section.plan.tag':         '定制方案-区域标签',
    'section.plan.title':       '定制方案-标题',
    'section.plan.subtitle':    '定制方案-副标题',
    'section.testimonials.tag': '客户口碑-区域标签',
    'section.testimonials.title':'客户口碑-标题',
    'section.testimonials.subtitle':'客户口碑-副标题',
    'section.service.tag':      '服务详情-区域标签',
    'section.service.title':    '服务详情-标题',
    'section.service.subtitle': '服务详情-副标题',
    'section.profile.tag':      '公司简介-区域标签',
    'section.profile.title':    '公司简介-标题',
    'section.stats.tag':        '数据统计-区域标签',
    
    // Step 步骤
    'step.N.title':   '步骤N-标题',
    'step.N.desc':    '步骤N-描述',
    'step.N.icon':    '步骤N-图标',
    
    // FAQ
    'faq.qN':         '问题N',
    'faq.aN':         '答案N',
    
    // CTA
    'cta.title':      'CTA区域-标题',
    'cta.subtitle':   'CTA区域-副标题',
    'cta.btn1':       'CTA按钮一文案',
    'cta.btn2':       'CTA按钮二文案',
    'cta.bgImage':    'CTA背景图片',
    
    // Profile / About
    'profile.tag':    '公司简介-标签',
    'profile.title':  '公司简介-标题',
    'profile.pN':     '公司简介-段落N',
    'profile.image':  '公司简介-配图',
    
    // Stats 统计数据
    'stats.N.number': '统计数据N-数字',
    'stats.N.label':  '统计数据N-标签',
    
    // Advantages 优势
    'advantages.tag':      '核心优势-区域标签',
    'advantages.title':    '核心优势-标题',
    'advantages.subtitle': '核心优势-副标题',
    'adv.N.title':         '优势N-标题',
    'adv.N.desc':          '优势N-描述',
    'adv.N.icon':          '优势N-图标',
    
    // Region 国家/地区
    'region.tab.X':    '地区X-Tab标签',
    'region.X.title':  '地区X-标题',
    'region.X.intro':  '地区X-介绍',
    'region.X.image':  '地区X-配图',
    
    // Type 类型（保险等）
    'type.N.title':    '类型N-标题',
    'type.N.desc':     '类型N-描述',
    'type.N.icon':     '类型N-图标',
    'type.N.price':    '类型N-价格',
    
    // Advantage 列表项
    'advantage.N.title': '优势项N-标题',
    'advantage.N.desc':  '优势项N-描述',
    'advantage.N.icon':  '优势项N-图标',
    
    // Plan 方案
    'plan.step.N.title': '方案步骤N-标题',
    'plan.step.N.desc':  '方案步骤N-描述',
    
    // Testimonial 客户评价
    'testimonial.N.name':  '客户N-姓名',
    'testimonial.N.text':  '客户N-评价内容',
    'testimonial.N.avatar':'客户N-头像',
    
    // Service 服务详情
    'service.N.title': '服务项N-标题',
    'service.N.desc':  '服务项N-描述',
    'service.N.icon':  '服务项N-图标',
    
    // Sidebar 侧边栏
    'sidebar.contact.title':  '侧边栏-联系标题',
    'sidebar.contact.sub':    '侧边栏-联系副标题',
    'sidebar.phone.label':    '侧边栏-电话标签',
    'sidebar.email.label':    '侧边栏-邮箱标签',
    'sidebar.trust.title':    '侧边栏-信任标题',
    'sidebar.trust.pN':       '侧边栏-信任点N',
    'sidebar.qr.personal':    '侧边栏-个人微信二维码',
    'sidebar.qr.enterprise':  '侧边栏-企业微信二维码',
    'sidebar.qr.whatsapp':    '侧边栏-WhatsApp二维码',
    
    // Page
    'page.title':     '浏览器页面标题',
  };
  
  // 先尝试精确匹配
  if (labels[key]) return labels[key];
  
  // 模式匹配（处理 N 变量）
  for (const [pattern, label] of Object.entries(labels)) {
    const regex = new RegExp('^' + pattern.replace(/N/g, '(\\d+)').replace(/X/g, '(.+?)') + '$');
    const match = key.match(regex);
    if (match) {
      let result = label;
      for (let i = 1; i < match.length; i++) {
        result = result.replace('N', match[i]).replace('X', match[i]);
      }
      return result;
    }
  }
  
  // 默认：将 key 转为中文
  return key.split('.').map(part => {
    return part.replace(/([A-Z])/g, ' $1')
      .replace(/^./, s => s.toUpperCase())
      .trim();
  }).join('-');
}

// 判断是否是图片类型字段
function isImageField(key) {
  const imagePatterns = [
    /bgImage$/, /image$/, /icon$/, /avatar$/,
    /qr\./, /photo$/, /img$/
  ];
  return imagePatterns.some(p => p.test(key));
}

// 判断字段类型
function getFieldType(key) {
  if (isImageField(key)) return 'image';
  if (/^(faq\.a|desc|subtitle|intro|p\.\d+$)/.test(key)) return 'textarea';
  return 'text';
}

// 解析HTML文件，提取所有data-i18n属性和图片元素
function extractFields(filePath) {
  const html = fs.readFileSync(filePath, 'utf-8');
  const fields = new Map();
  
  // 提取 data-i18n 属性
  const i18nRegex = /data-i18n="([^"]+)"/g;
  let match;
  while ((match = i18nRegex.exec(html)) !== null) {
    const key = match[1];
    // 跳过全局字段
    if (GLOBAL_PREFIXES.some(p => key.startsWith(p))) continue;
    fields.set(key, { key, type: getFieldType(key) });
  }
  
  // 提取关键图片元素（Hero背景、section背景等）
  // 匝配 style="...background-image:url(...)" 或 <img> 在关键位置的
  const imgContextRegex = /(?:class="[^"]*(?:hero-bg|hero-image|section-bg|bg-image|feature-icon|step-icon|advantage-icon)[^"]*"[^>]*?(?:src|style)="([^"]*)")/gi;
  
  // 简化版：查找主要的图片位置
  const heroImgRegex = /(?:<!--\s*Hero\s*-->[\s\S]*?<img\s+src="([^"]+)"|class="[^"]*hero[^"]*background-image:\s*url\(([^)]+)\))/gi;
  
  return fields;
}

// 主函数
const baseDir = path.resolve('/Users/littlesnowow/WorkBuddy/2026-06-05-18-10-47');
const output = {};

console.log('📋 开始提取所有页面的可编辑字段...\n');

for (const [pageKey, config] of Object.entries(PAGE_MAP)) {
  const filePath = path.join(baseDir, config.file);
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  ${config.file} 不存在，跳过`);
    continue;
  }
  
  const fields = extractFields(filePath);
  const fieldList = [];
  
  // 排序：按 key 分组，保持合理顺序
  const sortedKeys = Array.from(fields.keys()).sort((a, b) => {
    const order = ['page', 'hero', 'section', 'step', 'type', 'region', 'advantage', 'profile', 'stats', 'advantages', 'adv', 'faq', 'cta', 'sidebar', 'testimonial', 'plan', 'service'];
    const aPrefix = a.split('.')[0];
    const bPrefix = b.split('.')[0];
    return order.indexOf(aPrefix) - order.indexOf(bPrefix);
  });
  
  for (const key of sortedKeys) {
    const fieldInfo = fields.get(key);
    fieldList.push({
      key,
      label: getFriendlyLabel(key),
      type: fieldInfo.type,
    });
  }
  
  output[pageKey] = fieldList;
  console.log(`✅ ${config.label} (${config.file}): ${fieldList.length} 个字段`);
}

// 输出结果
const resultJS = `// ══════════════════════════════════════════════
//  页面内容编辑器字段配置（自动生成）
//  包含所有文本字段 + 图片上传字段
//  生成时间: ${new Date().toISOString()}
// ══════════════════════════════════════════════
const PAGE_FIELDS = {
${Object.entries(output).map(([pageKey, fields]) => {
  return `  // ════════════════════════════════════════════\n  //  ${PAGE_MAP[pageKey]?.label || pageKey}\n  // ════════════════════════════════════════════\n  '${pageKey}': [\n${fields.map(f => 
    `    { key:'${f.key}', label:'${f.label}', type:'${f.type}' }`
  ).join(',\n')}\n  ],`;
}).join(',\n\n')}
};`;

fs.writeFileSync(path.join(__dirname, 'full-page-fields.js'), resultJS);
console.log('\n✅ 完整字段配置已保存到 full-page-fields.js');
console.log('\n📊 各页面字段统计:');
for (const [pageKey, fields] of Object.entries(output)) {
  const imgCount = fields.filter(f => f.type === 'image').length;
  const textCount = fields.filter(f => f.type === 'text').length;
  const taCount = fields.filter(f => f.type === 'textarea').length;
  console.log(`   ${PAGE_MAP[pageKey]?.label || pageKey}: 共${fields.length}个 (文本:${textCount}, 多行:${taCount}, 图片:${imgCount})`);
}
