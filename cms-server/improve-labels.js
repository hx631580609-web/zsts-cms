/**
 * 生成改进后的PAGE_FIELDS配置（带友好的中文标签）
 */

const fs = require('fs');
const path = require('path');

// 友好标签映射表
const LABEL_MAP = {
  // 通用
  'page.title': '页面标题',
  'hero.badge': '大图徽章',
  'hero.title': '大图标题',
  'hero.subtitle': '大图副标题',
  'hero.desc': '大图描述',
  'hero.bg': '大图背景',
  
  // 区块标题
  'section.process.tag': '办理流程标签',
  'section.process.title': '办理流程标题',
  'section.process.subtitle': '办理流程副标题',
  'section.faq.tag': '常见问题标签',
  'section.faq.title': '常见问题标题',
  'section.materials.tag': '申请材料标签',
  'section.materials.title': '申请材料标题',
  'section.materials.subtitle': '申请材料副标题',
  'section.types.tag': '保险类型标签',
  'section.types.title': '保险类型标题',
  'section.types.subtitle': '保险类型副标题',
  'section.regions.tag': '热门国家标签',
  'section.regions.title': '热门国家标题',
  'section.regions.subtitle': '热门国家副标题',
  'section.services.tag': '服务详情标签',
  'section.services.title': '服务详情标题',
  'section.services.subtitle': '服务详情副标题',
  
  // 步骤
  'step.1.title': '步骤1标题',
  'step.1.desc': '步骤1描述',
  'step.2.title': '步骤2标题',
  'step.2.desc': '步骤2描述',
  'step.3.title': '步骤3标题',
  'step.3.desc': '步骤3描述',
  'step.4.title': '步骤4标题',
  'step.4.desc': '步骤4描述',
  'step.5.title': '步骤5标题',
  'step.5.desc': '步骤5描述',
  
  //FAQ
  'faq.q1': '问题1',
  'faq.a1': '答案1',
  'faq.q2': '问题2',
  'faq.a2': '答案2',
  'faq.q3': '问题3',
  'faq.a3': '答案3',
  'faq.q4': '问题4',
  'faq.a4': '答案4',
  'faq.q5': '问题5',
  'faq.a5': '答案5',
  'faq.q6': '问题6',
  'faq.a6': '答案6',
  'faq.q7': '问题7',
  'faq.a7': '答案7',
  
  // CTA
  'cta.title': 'CTA标题',
  'cta.subtitle': 'CTA副标题',
  'cta.btn1': 'CTA按钮1',
  'cta.btn2': 'CTA按钮2',
  
  // 侧边栏
  'sidebar.contact.title': '侧边栏联系标题',
  'sidebar.contact.sub': '侧边栏联系副标题',
  'sidebar.phone.label': '电话标签',
  'sidebar.email.label': '邮箱标签',
  'sidebar.qr.personal': '个人微信二维码',
  'sidebar.qr.enterprise': '企业微信二维码',
  'sidebar.qr.whatsapp': 'WhatsApp二维码',
  'sidebar.trust.title': '信任标题',
  'sidebar.trust.p1': '信任点1',
  'sidebar.trust.p2': '信任点2',
  'sidebar.trust.p3': '信任点3',
  'sidebar.trust.p4': '信任点4',
  'sidebar.trust.p5': '信任点5',
  
  // 沙特签证页特定
  'visa.type1.title': '签证类型1标题',
  'visa.type1.desc': '签证类型1描述',
  'visa.type2.title': '签证类型2标题',
  'visa.type2.desc': '签证类型2描述',
  
  // 全球签证页特定
  'region.tab.sa': '沙特标签',
  'region.tab.aunz': '澳新标签',
  'region.tab.eu': '欧洲标签',
  'region.tab.na': '北美标签',
  'region.tab.jpkr': '日韩标签',
  'region.tab.mea': '中东非标签',
  'region.sa.title': '沙特区域标题',
  'region.sa.intro': '沙特区域介绍',
  'region.aunz.title': '澳新区域标题',
  'region.aunz.intro': '澳新区域介绍',
  'region.eu.title': '欧洲区域标题',
  'region.eu.intro': '欧洲区域介绍',
  'region.na.title': '北美区域标题',
  'region.na.intro': '北美区域介绍',
  'region.jpkr.title': '日韩区域标题',
  'region.jpkr.intro': '日韩区域介绍',
  'region.mea.title': '中东非区域标题',
  'region.mea.intro': '中东非区域介绍',
  
  // 保险页特定
  'ins.type1.title': '保险类型1标题',
  'ins.type1.desc': '保险类型1描述',
  'ins.type1.cta': '保险类型1按钮',
  'ins.type2.title': '保险类型2标题',
  'ins.type2.desc': '保险类型2描述',
  'ins.type2.cta': '保险类型2按钮',
  'ins.type3.title': '保险类型3标题',
  'ins.type3.desc': '保险类型3描述',
  'ins.type3.cta': '保险类型3按钮',
  'ins.type4.title': '保险类型4标题',
  'ins.type4.desc': '保险类型4描述',
  'ins.type4.cta': '保险类型4按钮',
  
  // 交通住宿页特定
  'transport.section1.tag': '服务优势标签',
  'transport.section1.title': '服务优势标题',
  'transport.section2.tag': '定制方案标签',
  'transport.section2.title': '定制方案标题',
  'transport.section4.tag': '客户口碑标签',
  'transport.section4.title': '客户口碑标题',
  'transport.service1.title': '服务1标题',
  'transport.service1.desc': '服务1描述',
  'transport.service2.title': '服务2标题',
  'transport.service2.desc': '服务2描述',
  'transport.service3.title': '服务3标题',
  'transport.service3.desc': '服务3描述',
  'transport.service4.title': '服务4标题',
  'transport.service4.desc': '服务4描述',
  'transport.service5.title': '服务5标题',
  'transport.service5.desc': '服务5描述',
  'transport.trust.p1': '口碑1',
  'transport.trust.p2': '口碑2',
  'transport.trust.p3': '口碑3',
  'transport.trust.p4': '口碑4',
  
  // 企业出海页特定
  'enterprise.services.tag': '服务详情标签',
  'enterprise.services.title': '服务详情标题',
  'enterprise.service1.title': '服务1标题',
  'enterprise.service1.desc': '服务1描述',
  'enterprise.service1.point1': '服务1要点1',
  'enterprise.service1.point2': '服务1要点2',
  'enterprise.service1.point3': '服务1要点3',
  'enterprise.service2.title': '服务2标题',
  'enterprise.service2.desc': '服务2描述',
  'enterprise.service2.point1': '服务2要点1',
  'enterprise.service2.point2': '服务2要点2',
  'enterprise.service2.point3': '服务2要点3',
  'enterprise.service3.title': '服务3标题',
  'enterprise.service3.desc': '服务3描述',
  'enterprise.service3.point1': '服务3要点1',
  'enterprise.service3.point2': '服务3要点2',
  'enterprise.service3.point3': '服务3要点3',
  'enterprise.service4.title': '服务4标题',
  'enterprise.service4.desc': '服务4描述',
  'enterprise.service4.point1': '服务4要点1',
  'enterprise.service4.point2': '服务2要点2',
  'enterprise.service4.point3': '服务4要点3',
  'enterprise.faq.q1': '企业FAQ问题1',
  'enterprise.faq.a1': '企业FAQ答案1',
  'enterprise.faq.q2': '企业FAQ问题2',
  'enterprise.faq.a2': '企业FAQ答案2',
  'enterprise.faq.q3': '企业FAQ问题3',
  'enterprise.faq.a3': '企业FAQ答案3',
  'enterprise.faq.q4': '企业FAQ问题4',
  'enterprise.faq.a4': '企业FAQ答案4',
  'enterprise.faq.q5': '企业FAQ问题5',
  'enterprise.faq.a5': '企业FAQ答案5',
  'enterprise.faq.q6': '企业FAQ问题6',
  'enterprise.faq.a6': '企业FAQ答案6',
  
  // 考察页特定
  'inspection.services.tag': '服务详情标签',
  'inspection.services.title': '服务详情标题',
  'inspection.services.subtitle': '服务详情副标题',
  'inspection.service1.title': '服务1标题',
  'inspection.service1.desc': '服务1描述',
  'inspection.service2.title': '服务2标题',
  'inspection.service2.desc': '服务2描述',
  'inspection.service3.title': '服务3标题',
  'inspection.service3.desc': '服务3描述',
  'inspection.service4.title': '服务4标题',
  'inspection.service4.desc': '服务4描述',
  'inspection.faq.q1': '考察FAQ问题1',
  'inspection.faq.a1': '考察FAQ答案1',
  'inspection.faq.q2': '考察FAQ问题2',
  'inspection.faq.a2': '考察FAQ答案2',
  'inspection.faq.q3': '考察FAQ问题3',
  'inspection.faq.a3': '考察FAQ答案3',
  'inspection.faq.q4': '考察FAQ问题4',
  'inspection.faq.a4': '考察FAQ答案4',
  'inspection.faq.q5': '考察FAQ问题5',
  'inspection.faq.a5': '考察FAQ答案5',
  'inspection.faq.q6': '考察FAQ问题6',
  'inspection.faq.a6': '考察FAQ答案6',
  
  // 关于我们页特定
  'profile.tag': '公司简介标签',
  'profile.title': '公司简介标题',
  'profile.p1': '公司简介段落1',
  'profile.p2': '公司简介段落2',
  'profile.p3': '公司简介段落3',
  'advantages.tag': '核心优势标签',
  'advantages.title': '核心优势标题',
  'advantages.subtitle': '核心优势副标题',
  'adv.1.title': '优势1标题',
  'adv.1.desc': '优势1描述',
  'adv.2.title': '优势2标题',
  'adv.2.desc': '优势2描述',
  'adv.3.title': '优势3标题',
  'adv.3.desc': '优势3描述',
  'adv.4.title': '优势4标题',
  'adv.4.desc': '优势4描述',
  'adv.5.title': '优势5标题',
  'adv.5.desc': '优势5描述',
  'adv.6.title': '优势6标题',
  'adv.6.desc': '优势6描述',
  'stats.1.number': '统计1数字',
  'stats.1.label': '统计1标签',
  'stats.2.number': '统计2数字',
  'stats.2.label': '统计2标签',
  'stats.3.number': '统计3数字',
  'stats.3.label': '统计3标签',
  'stats.4.number': '统计4数字',
  'stats.4.label': '统计4标签',
};

// 读取之前生成的配置
const generatedPath = path.join(__dirname, 'generated-page-fields.js');
const content = fs.readFileSync(generatedPath, 'utf8');

// 解析生成的配置并改进标签
const lines = content.split('\n');
const output = [];
let inPageFields = false;
let currentPage = '';

for (const line of lines) {
  if (line.trim().startsWith('const PAGE_FIELDS')) {
    output.push('const PAGE_FIELDS = {');
    continue;
  }
  
  if (line.trim() === '};') {
    output.push('};');
    continue;
  }
  
  // 匹配页面key
  const pageMatch = line.match(/^\s*'([^']+)':\s*\[/);
  if (pageMatch) {
    currentPage = pageMatch[1];
    output.push(line);
    continue;
  }
  
  // 匹配字段配置
  const fieldMatch = line.match(/\{ key:'([^']+)', label:'([^']*)', type:'([^']+)' \},?/);
  if (fieldMatch) {
    const key = fieldMatch[1];
    const type = fieldMatch[3];
    const fullKey = `${currentPage}.${key}`;
    
    // 使用映射表中的标签，如果没有则使用改进的自动推断标签
    let label = LABEL_MAP[key] || LABEL_MAP[fullKey] || improveLabel(key);
    
    output.push(`    { key:'${key}', label:'${label}', type:'${type}' },`);
    continue;
  }
  
  output.push(line);
}

function improveLabel(key) {
  // 改进标签推断
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
    'name': '名称',
    'phone': '电话',
    'email': '邮箱',
    'address': '地址',
    'intro': '介绍',
    'note': '备注',
    'services': '服务',
    'types': '类型',
    'travel': '出行',
    'trust': '信任',
    'p1': '要点1',
    'p2': '要点2',
    'p3': '要点3',
    'p4': '要点4',
    'p5': '要点5',
  };
  
  return labelMap[lastPart] || lastPart;
}

const outputPath = path.join(__dirname, 'page-fields-improved.js');
fs.writeFileSync(outputPath, output.join('\n'), 'utf8');
console.log(`✅ 改进后的配置已保存到: ${outputPath}`);
