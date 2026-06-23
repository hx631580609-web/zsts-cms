// ZSTS CMS 主应用逻辑
// 配置式编辑器：基于固定页面结构，只编辑文案/图片/链接

// ── Toast 提示 ──────────────────────────────────
function showToast(msg, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// ══════════════════════════════════════════════
//  图片上传组件（返回 HTML 字符串）
// ══════════════════════════════════════════════
function imgUploadField(id, currentSrc, label, hint) {
  const displaySrc = currentSrc || '';
  return `
    <div class="img-upload-wrap" id="${id}-wrap">
      <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">${label}</label>
      <div class="flex items-center gap-4">
        <div class="img-preview w-20 h-20 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden bg-gray-50 flex-shrink-0" id="${id}-preview">
          ${displaySrc ? `<img src="${resolveImgUrl(displaySrc)}" alt="" class="w-full h-full object-contain">` : '<span class="text-xs text-gray-300">无图片</span>'}
        </div>
        <div class="flex-1 space-y-2">
          <input type="hidden" id="${id}" value="${displaySrc}">
          <label class="inline-flex items-center gap-2 px-4 py-2 bg-white border border-zsts-green text-zsts-green rounded-lg text-sm cursor-pointer hover:bg-zsts-green-light transition-colors shadow-sm">
            📤 点击上传图片
            <input type="file" accept=".jpg,.jpeg,.png,.gif,.webp,.svg"
              onchange="handleImageUpload(this, '${id}')"
              class="hidden">
          </label>
          ${hint ? `<p class="text-xs text-gray-400">${hint}</p>` : ''}
          <p class="text-xs text-gray-400 truncate max-w-xs" id="${id}-path">${displaySrc || '未设置'}</p>
        </div>
      </div>
    </div>
  `;
}

function resolveImgUrl(src) {
  if (!src) return '';
  if (src.startsWith('/')) return src;
  if (src.startsWith('http')) return src;
  return `/cms-images/${src.replace(/^images\//, '')}`;
}

window.handleImageUpload = async function(input, fieldId) {
  const file = input.files[0];
  if (!file) return;
  const preview = document.getElementById(`${fieldId}-preview`);
  preview.innerHTML = '<span class="text-xs text-zsts-green animate-pulse">上传中...</span>';
  const formData = new FormData();
  formData.append('file', file);
  try {
    const res = await fetch(`${API}/upload`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('cms_token')}` },
      body: formData,
    });
    if (!res.ok) throw new Error('上传失败');
    const data = await res.json();
    document.getElementById(fieldId).value = data.url;
    preview.innerHTML = `<img src="${data.url}" alt="" class="w-full h-full object-contain">`;
    document.getElementById(`${fieldId}-path`).textContent = data.url;
    showToast(`✅ 图片已上传`);
  } catch (e) {
    preview.innerHTML = '<span class="text-xs text-red-500">❌ 上传失败</span>';
    showToast('❌ 图片上传失败', 'error');
  }
};

// ══════════════════════════════════════════════
//  保存按钮区 CSS（hover 时显示）
// ══════════════════════════════════════════════
const SAVE_BAR_CSS = `
.editor-panel {
  position: relative;
}
.editor-panel .save-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 24px;
  margin-top: 8px;
  border-top: 1px solid #e5e7eb;
  background: #f9fafb;
  border-radius: 0 0 12px 12px;
  opacity: 0;
  transform: translateY(8px);
  transition: opacity .25s, transform .25s;
  pointer-events: none;
}
.editor-panel:hover .save-bar {
  opacity: 1;
  transform: translateY(0);
  pointer-events: auto;
}
.save-bar .save-hint {
  font-size: 12px;
  color: #9ca3af;
}
.save-bar .btn-save {
  background: #006341;
  color: #fff;
  border: none;
  padding: 10px 28px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background .2s;
  box-shadow: 0 2px 8px rgba(0,99,65,.25);
}
.save-bar .btn-save:hover {
  background: #004d33;
}
.save-bar .btn-reset {
  background: #fff;
  color: #6b7280;
  border: 1px solid #d1d5db;
  padding: 9px 18px;
  border-radius: 8px;
  font-size: 13px;
  cursor: pointer;
  transition: all .2s;
  margin-right: 10px;
}
.save-bar .btn-reset:hover {
  background: #f3f4f6;
  border-color: #9ca3af;
}
`;

(function() {
  const style = document.createElement('style');
  style.textContent = SAVE_BAR_CSS + `
    .img-preview img { transition: opacity .2s; }
    .img-upload-wrap:hover .img-preview img { opacity: .8; }
  `;
  document.head.appendChild(style);
})();

// ══════════════════════════════════════════════
//  固定导航项定义
// ══════════════════════════════════════════════
const FIXED_NAV_ITEMS = [
  { key:'home',       defaultZh:'首页',        defaultHref:'index.html' },
  { key:'saudiVisa', defaultZh:'沙特签证',     defaultHref:'saudi-visa.html' },
  { key:'visa',       defaultZh:'全球签证',     defaultHref:'visa.html' },
  { key:'transport',   defaultZh:'境外交通住宿',  defaultHref:'transport.html' },
  { key:'insurance',   defaultZh:'境外保险',     defaultHref:'insurance.html' },
  { key:'enterprise',  defaultZh:'企业出海',     defaultHref:'enterprise.html' },
  { key:'inspection',  defaultZh:'企业考察',     defaultHref:'inspection.html' },
  { key:'about',       defaultZh:'关于我们',     defaultHref:'about.html' },
];

// ══════════════════════════════════════════════
//  全局配置编辑器
// ══════════════════════════════════════════════
async function renderGlobalEditor(container, tab) {
  const titles = { nav:'导航菜单', footer:'页脚', consultation:'咨询弹窗' };
  const tabs = ['nav','footer','consultation'];
  
  container.innerHTML = `
    <div class="max-w-5xl mx-auto editor-panel" data-tab="${tab}">
      <div class="mb-6">
        <h1 class="text-2xl font-bold text-gray-900">全局配置</h1>
        <p class="text-gray-500 text-sm mt-1">编辑网站全局导航、页脚和咨询弹窗内容</p>
      </div>
      <div class="flex space-x-1 bg-gray-100 p-1 rounded-lg mb-6 w-fit">
        ${tabs.map(t => `
          <button onclick="renderGlobalEditor(document.getElementById('pageContent'), '${t}')"
            class="px-5 py-2 rounded-md text-sm font-medium transition-all ${t===tab ? 'bg-white text-zsts-green shadow-sm' : 'text-gray-600 hover:text-gray-900'}">
            ${titles[t]}
          </button>
        `).join('')}
      </div>
      <div id="globalEditorContent"></div>
    </div>
  `;
  
  const contentDiv = container.querySelector('#globalEditorContent');
  if (tab === 'nav') await renderNavEditor(contentDiv);
  else if (tab === 'footer') await renderFooterEditor(contentDiv);
  else if (tab === 'consultation') await renderConsultationEditor(contentDiv);
}

async function renderNavEditor(container) {
  let data = {};
  try {
    const r = await fetch(`${API}/content/nav`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('cms_token')}` }
    });
    if (r.ok) data = await r.json();
  } catch(e) { console.error(e); }

  let itemsHTML = '';
  FIXED_NAV_ITEMS.forEach((item, idx) => {
    const zhVal = data.items?.find(i => i.key === item.key)?.label_zh || item.defaultZh;
    const hrefVal = data.items?.find(i => i.key === item.key)?.url || item.defaultHref;

    itemsHTML += `
      <div class="bg-gray-50 rounded-lg p-4 mb-3">
        <div class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">${idx + 1}. ${item.defaultZh}</div>
        <div class="grid grid-cols-2 gap-4">
          <div><label class="text-xs text-gray-500">标签文字</label>
            <input type="text" id="nav-${item.key}-zh" value="${esc(zhVal)}" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"></div>
          <div><label class="text-xs text-gray-500">链接地址</label>
            <input type="text" id="nav-${item.key}-href" value="${esc(hrefVal)}" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"></div>
        </div>
      </div>
    `;
  });

  container.innerHTML = `
    <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
      <p class="text-sm text-gray-500 mb-6">固定 9 个导航项，可修改标签文字和链接地址</p>
      ${itemsHTML}
      <div class="save-bar">
        <span class="save-hint">编辑完成后点击保存</span>
        <div class="flex gap-2">
          <button onclick="saveNavConfig()" class="btn-save">💾 保存导航配置</button>
        </div>
      </div>
    </div>
  `;
}

async function saveNavConfig() {
  const items = FIXED_NAV_ITEMS.map(item => ({
    key: item.key,
    label_zh: document.getElementById(`nav-${item.key}-zh`)?.value || '',
    url: document.getElementById(`nav-${item.key}-href`)?.value || '',
  }));

  await doSave('nav', { items });
}

async function renderFooterEditor(container) {
  let data = {};
  try {
    const r = await fetch(`${API}/content/footer`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('cms_token')}` }
    });
    if (r.ok) data = await r.json();
  } catch(e) { console.error(e); }
  
  container.innerHTML = `
    <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
      <div class="grid grid-cols-2 gap-6">
        <div>
          <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">公司描述（中文）</label>
          <textarea id="footer-desc-zh" rows="3" class="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm">${esc(data.description?.zh || '')}</textarea>
        </div>
        <div>
          <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">公司描述（英文）</label>
          <textarea id="footer-desc-en" rows="3" class="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm">${esc(data.description?.en || '')}</textarea>
        </div>
        <div>
          <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">电话</label>
          <input type="text" id="footer-phone" value="${esc(data.phone || '')}" class="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm">
        </div>
        <div>
          <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">邮箱</label>
          <input type="text" id="footer-email" value="${esc(data.email || '')}" class="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm">
        </div>
      </div>
      <div class="save-bar">
        <span class="save-hint">编辑完成后点击保存</span>
        <div class="flex gap-2">
          <button onclick="saveFooterConfig()" class="btn-save">💾 保存页脚配置</button>
        </div>
      </div>
    </div>
  `;
}

async function saveFooterConfig() {
  const payload = {
    description: {
      zh: document.getElementById('footer-desc-zh')?.value || '',
      en: document.getElementById('footer-desc-en')?.value || ''
    },
    phone: document.getElementById('footer-phone')?.value || '',
    email: document.getElementById('footer-email')?.value || '',
  };
  await doSave('footer', payload);
}

async function renderConsultationEditor(container) {
  let data = {};
  try {
    const r = await fetch(`${API}/content/consultation`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('cms_token')}` }
    });
    if (r.ok) data = await r.json();
  } catch(e) { console.error(e); }
  
  container.innerHTML = `
    <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
      <div class="grid grid-cols-2 gap-6 mb-6">
        <div>
          <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">弹窗标题（中文）</label>
          <input type="text" id="consult-title-zh" value="${esc(data.title?.zh || '')}" class="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm">
        </div>
        <div>
          <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">弹窗标题（英文）</label>
          <input type="text" id="consult-title-en" value="${esc(data.title?.en || '')}" class="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm">
        </div>
      </div>
      <div class="grid grid-cols-2 gap-6 mb-6">
        <div>
          <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">弹窗描述（中文）</label>
          <input type="text" id="consult-desc-zh" value="${esc(data.desc?.zh || '')}" class="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm" placeholder="选择您方便的方式联系我们">
        </div>
        <div>
          <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">弹窗描述（英文）</label>
          <input type="text" id="consult-desc-en" value="${esc(data.desc?.en || '')}" class="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm" placeholder="Choose your preferred contact method">
        </div>
      </div>
      <div class="mb-6">
        <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">弹窗底部电话</label>
        <input type="text" id="consult-phone" value="${esc(data.contact_phone || '')}" class="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm" placeholder="客服电话：010-85656995 / ...">
      </div>
      <div>
        ${imgUploadField('consult-qr-wechat1', data.qr_codes?.wechat1?.src || '', '微信二维码1', '建议尺寸 200x200')}
      </div>
      <div class="mt-4">
        ${imgUploadField('consult-qr-wechat2', data.qr_codes?.wechat2?.src || '', '微信二维码2', '建议尺寸 200x200')}
      </div>
      <div class="mt-4">
        ${imgUploadField('consult-qr-whatsapp', data.qr_codes?.whatsapp?.src || '', 'WhatsApp二维码', '建议尺寸 200x200')}
      </div>
      <div class="save-bar">
        <span class="save-hint">编辑完成后点击保存</span>
        <div class="flex gap-2">
          <button onclick="saveConsultationConfig()" class="btn-save">💾 保存咨询配置</button>
        </div>
      </div>
    </div>
  `;
}

async function saveConsultationConfig() {
  const payload = {
    title: {
      zh: document.getElementById('consult-title-zh')?.value || '',
      en: document.getElementById('consult-title-en')?.value || ''
    },
    desc: {
      zh: document.getElementById('consult-desc-zh')?.value || '',
      en: document.getElementById('consult-desc-en')?.value || ''
    },
    contact_phone: document.getElementById('consult-phone')?.value || '',
    qr_codes: {
      wechat1:  { src: document.getElementById('consult-qr-wechat1')?.value || '' },
      wechat2:  { src: document.getElementById('consult-qr-wechat2')?.value || '' },
      whatsapp: { src: document.getElementById('consult-qr-whatsapp')?.value || '' },
    }
  };
  await doSave('consultation', payload);
}

async function doSave(type, payload) {
  try {
    const res = await fetch(`${API}/content/${type}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('cms_token')}` },
      body: JSON.stringify(payload),
    });
    if (!res.ok) { const t = await res.text(); throw new Error(`HTTP ${res.status}: ${t}`); }
    showToast('✅ 已保存', 'success');
  } catch(e) { showToast('❌ 保存失败: ' + e.message, 'error'); }
}

function resetGlobalEditor(type) { if (confirm('确定要重置？')) loadGlobalConfig(type); }

// ══════════════════════════════════════════════
//  页面内容编辑器（基于 PAGE_FIELDS 配置）
// ══════════════════════════════════════════════
// ══════════════════════════════════════════════
//  页面内容编辑器字段配置（自动生成）
//  包含所有文本字段 + 图片上传字段
//  生成时间: 2026-06-21T11:24:47.836Z
// ══════════════════════════════════════════════
const PAGE_FIELDS = {
  // ════════════════════════════════════════════
  //  首页
  // ════════════════════════════════════════════
  'home': [
    { key:'hero.title1', label:'大图标题（行1）', type:'text' },
    { key:'hero.title2', label:'大图标题（行2）', type:'text' },
    { key:'hero.subtitle', label:'大图副标题', type:'text' },
    { key:'hero.services', label:'服务/业务标签', type:'text' },
    { key:'hero.bgImage', label:'大图背景图片', type:'image' },
    { key:'hero.cta1', label:'按钮一文案', type:'text' },
    { key:'hero.cta1_url', label:'按钮一链接', type:'url' },
    { key:'hero.cta2', label:'按钮二文案', type:'text' },
    { key:'hero.cta2_url', label:'按钮二链接', type:'url' },
    { key:'stats.countries.value', label:'统计-办理国家（数字）', type:'text' },
    { key:'stats.countries.unit', label:'统计-办理国家（单位）', type:'text' },
    { key:'stats.rate.value', label:'统计-出签成功率（数字）', type:'text' },
    { key:'stats.rate.unit', label:'统计-出签成功率（单位）', type:'text' },
    { key:'stats.clients.value', label:'统计-服务客户（数字）', type:'text' },
    { key:'stats.clients.unit', label:'统计-服务客户（单位）', type:'text' },
    { key:'stats.experience.value', label:'统计-行业经验（数字）', type:'text' },
    { key:'stats.experience.unit', label:'统计-行业经验（单位）', type:'text' },
    { key:'coreService.tag', label:'核心服务-顶部标签', type:'text' },
    { key:'coreService.title', label:'核心服务-主标题', type:'text' },
    { key:'coreService.subtitle', label:'核心服务-副标题', type:'text' },
    { key:'coreService.card1.title', label:'核心服务-卡片1-标题', type:'text' },
    { key:'coreService.card1.desc', label:'核心服务-卡片1-描述', type:'textarea' },
    { key:'coreService.card1.cta', label:'核心服务-卡片1-按钮', type:'text' },
    { key:'coreService.card1.url', label:'核心服务-卡片1-链接', type:'url' },
    { key:'coreService.card2.title', label:'核心服务-卡片2-标题', type:'text' },
    { key:'coreService.card2.desc', label:'核心服务-卡片2-描述', type:'textarea' },
    { key:'coreService.card2.cta', label:'核心服务-卡片2-按钮', type:'text' },
    { key:'coreService.card2.url', label:'核心服务-卡片2-链接', type:'url' },
    { key:'coreService.card3.title', label:'核心服务-卡片3-标题', type:'text' },
    { key:'coreService.card3.desc', label:'核心服务-卡片3-描述', type:'textarea' },
    { key:'coreService.card3.cta', label:'核心服务-卡片3-按钮', type:'text' },
    { key:'coreService.card3.url', label:'核心服务-卡片3-链接', type:'url' },
    { key:'coreService.card4.title', label:'核心服务-卡片4-标题', type:'text' },
    { key:'coreService.card4.desc', label:'核心服务-卡片4-描述', type:'textarea' },
    { key:'coreService.card4.cta', label:'核心服务-卡片4-按钮', type:'text' },
    { key:'coreService.card4.url', label:'核心服务-卡片4-链接', type:'url' },
    { key:'coreService.card5.title', label:'核心服务-卡片5-标题', type:'text' },
    { key:'coreService.card5.desc', label:'核心服务-卡片5-描述', type:'textarea' },
    { key:'coreService.card5.cta', label:'核心服务-卡片5-按钮', type:'text' },
    { key:'coreService.card5.url', label:'核心服务-卡片5-链接', type:'url' }
  ],

  // ════════════════════════════════════════════
  //  沙特签证
  // ════════════════════════════════════════════
  'saudi-visa': [
    { key:'hero.badge', label:'大图徽章标签', type:'text' },
    { key:'hero.title', label:'大图主标题', type:'text' },
    { key:'hero.subtitle', label:'大图副标题', type:'text' },
    { key:'hero.desc', label:'大图描述', type:'text' },
    { key:'hero.bgImage', label:'大图背景图片', type:'image' },
    { key:'section.materials.tag', label:'申请材料-区域标签', type:'text' },
    { key:'section.materials.title', label:'申请材料-标题', type:'text' },
    { key:'section.materials.subtitle', label:'申请材料-副标题', type:'text' },
    { key:'mat.business.label', label:'材料Tab-商务签证-按钮', type:'text' },
    { key:'mat.business.title', label:'材料Tab-商务签证-标题', type:'text' },
    { key:'mat.business.content', label:'材料Tab-商务签证-内容（结构化：分组+材料项）', type:'json' },
    { key:'mat.work.label', label:'材料Tab-工作签证-按钮', type:'text' },
    { key:'mat.work.title', label:'材料Tab-工作签证-标题', type:'text' },
    { key:'mat.work.content', label:'材料Tab-工作签证-内容（结构化：分组+材料项）', type:'json' },
    { key:'mat.family.label', label:'材料Tab-探亲签证-按钮', type:'text' },
    { key:'mat.family.title', label:'材料Tab-探亲签证-标题', type:'text' },
    { key:'mat.family.content', label:'材料Tab-探亲签证-内容（结构化：分组+材料项）', type:'json' },
    { key:'mat.tourist.label', label:'材料Tab-旅游签证-按钮', type:'text' },
    { key:'mat.tourist.title', label:'材料Tab-旅游签证-标题', type:'text' },
    { key:'mat.tourist.content', label:'材料Tab-旅游签证-内容（结构化：分组+材料项）', type:'json' },
    { key:'mat.student.label', label:'材料Tab-留学签证-按钮', type:'text' },
    { key:'mat.student.title', label:'材料Tab-留学签证-标题', type:'text' },
    { key:'mat.student.content', label:'材料Tab-留学签证-内容（结构化：分组+材料项）', type:'json' },
    { key:'mat.residence.label', label:'材料Tab-居住签证-按钮', type:'text' },
    { key:'mat.residence.title', label:'材料Tab-居住签证-标题', type:'text' },
    { key:'mat.residence.content', label:'材料Tab-居住签证-内容（结构化：分组+材料项）', type:'json' },
    { key:'section.faq.tag', label:'常见问题-区域标签', type:'text' },
    { key:'section.faq.title', label:'常见问题-标题', type:'text' },
    { key:'faq.q1', label:'问题1', type:'text' },
    { key:'faq.a1', label:'答案1', type:'textarea' },
    { key:'faq.q2', label:'问题2', type:'text' },
    { key:'faq.a2', label:'答案2', type:'textarea' },
    { key:'faq.q3', label:'问题3', type:'text' },
    { key:'faq.a3', label:'答案3', type:'textarea' },
    { key:'faq.q4', label:'问题4', type:'text' },
    { key:'faq.a4', label:'答案4', type:'textarea' },
    { key:'faq.q5', label:'问题5', type:'text' },
    { key:'faq.a5', label:'答案5', type:'textarea' },
    { key:'faq.q6', label:'问题6', type:'text' },
    { key:'faq.a6', label:'答案6', type:'textarea' },
    { key:'faq.q7', label:'问题7', type:'text' },
    { key:'faq.a7', label:'答案7', type:'textarea' },
    { key:'sidebar.contact.title', label:'侧边栏-联系标题', type:'text' },
    { key:'sidebar.contact.sub', label:'侧边栏-联系副标题', type:'text' },
    { key:'sidebar.phone.label', label:'侧边栏-电话标签', type:'text' },
    { key:'sidebar.phone.value', label:'侧边栏-电话号码', type:'text' },
    { key:'sidebar.email.label', label:'侧边栏-邮箱标签', type:'text' },
    { key:'sidebar.email.value', label:'侧边栏-邮箱地址', type:'text' },
    { key:'sidebar.qr.personal', label:'侧边栏-个人微信二维码', type:'image' },
    { key:'sidebar.qr.enterprise', label:'侧边栏-企业微信二维码', type:'image' },
    { key:'sidebar.qr.whatsapp', label:'侧边栏-WhatsApp二维码', type:'image' },
    { key:'sidebar.trust.title', label:'侧边栏-信任标题', type:'text' },
    { key:'sidebar.trust.p1', label:'侧边栏-信任点1', type:'text' },
    { key:'sidebar.trust.p2', label:'侧边栏-信任点2', type:'text' },
    { key:'sidebar.trust.p3', label:'侧边栏-信任点3', type:'text' },
    { key:'sidebar.trust.p4', label:'侧边栏-信任点4', type:'text' },
    { key:'sidebar.trust.p5', label:'侧边栏-信任点5', type:'text' }
  ],

  // ════════════════════════════════════════════
  //  全球签证
  // ════════════════════════════════════════════
  'visa': [
    { key:'page.title', label:'浏览器页面标题', type:'text', hidden:true },
    { key:'hero.badge', label:'大图徽章标签', type:'text' },
    { key:'hero.title', label:'大图主标题', type:'text' },
    { key:'hero.subtitle', label:'大图副标题', type:'text' },
    { key:'hero.desc', label:'大图描述', type:'text' },
    { key:'hero.bgImage', label:'大图背景图片', type:'image' },
    { key:'section.process.tag', label:'办理流程-区域标签', type:'text' },
    { key:'section.process.title', label:'办理流程-标题', type:'text' },
    { key:'section.process.subtitle', label:'办理流程-副标题', type:'text' },
    { key:'section.regions.tag', label:'热门国家-区域标签', type:'text' },
    { key:'section.regions.title', label:'热门国家-标题', type:'text' },
    { key:'section.regions.subtitle', label:'热门国家-副标题', type:'text' },
    { key:'section.faq.tag', label:'常见问题-区域标签', type:'text' },
    { key:'section.faq.title', label:'常见问题-标题', type:'text' },
    { key:'step.items', label:'办理流程列表（5步，可增删）', type:'repeater', subFields:[
      { key:'title', label:'步骤标题', type:'text' },
      { key:'desc',  label:'步骤描述', type:'textarea' }
    ]},
    { key:'region.tabs', label:'区域Tab列表（可增删tab，每个含 key 和双语 label）', type:'repeater' },
    { key:'region.panels.mea.title', label:'中东非-标题', type:'text' },
    { key:'region.panels.mea.intro', label:'中东非-介绍', type:'textarea' },
    { key:'region.panels.mea.types.title', label:'中东非-签证种类-标题', type:'text' },
    { key:'region.panels.mea.types.items', label:'中东非-签证种类-条目（结构化数组）', type:'json' },
    { key:'region.panels.mea.travel.title', label:'中东非-旅游特色-标题', type:'text' },
    { key:'region.panels.mea.travel.items', label:'中东非-旅游特色-条目（结构化数组）', type:'json' },
    { key:'region.panels.mea.services.title', label:'中东非-可办理业务-标题', type:'text' },
    { key:'region.panels.mea.services.items', label:'中东非-可办理业务-条目（结构化数组）', type:'json' },
    { key:'region.panels.mea.note', label:'中东非-底部说明', type:'textarea' },
    { key:'region.panels.eu.title', label:'欧洲-标题', type:'text' },
    { key:'region.panels.eu.intro', label:'欧洲-介绍', type:'textarea' },
    { key:'region.panels.eu.types.title', label:'欧洲-签证种类-标题', type:'text' },
    { key:'region.panels.eu.types.items', label:'欧洲-签证种类-条目（结构化数组）', type:'json' },
    { key:'region.panels.eu.travel.title', label:'欧洲-旅游特色-标题', type:'text' },
    { key:'region.panels.eu.travel.items', label:'欧洲-旅游特色-条目（结构化数组）', type:'json' },
    { key:'region.panels.eu.services.title', label:'欧洲-可办理业务-标题', type:'text' },
    { key:'region.panels.eu.services.items', label:'欧洲-可办理业务-条目（结构化数组）', type:'json' },
    { key:'region.panels.eu.note', label:'欧洲-底部说明', type:'textarea' },
    { key:'region.panels.na.title', label:'北美洲-标题', type:'text' },
    { key:'region.panels.na.intro', label:'北美洲-介绍', type:'textarea' },
    { key:'region.panels.na.types.title', label:'北美洲-签证种类-标题', type:'text' },
    { key:'region.panels.na.types.items', label:'北美洲-签证种类-条目（结构化数组）', type:'json' },
    { key:'region.panels.na.travel.title', label:'北美洲-旅游特色-标题', type:'text' },
    { key:'region.panels.na.travel.items', label:'北美洲-旅游特色-条目（结构化数组）', type:'json' },
    { key:'region.panels.na.services.title', label:'北美洲-可办理业务-标题', type:'text' },
    { key:'region.panels.na.services.items', label:'北美洲-可办理业务-条目（结构化数组）', type:'json' },
    { key:'region.panels.na.note', label:'北美洲-底部说明', type:'textarea' },
    { key:'region.panels.sa.title', label:'南美洲-标题', type:'text' },
    { key:'region.panels.sa.intro', label:'南美洲-介绍', type:'textarea' },
    { key:'region.panels.sa.types.title', label:'南美洲-签证种类-标题', type:'text' },
    { key:'region.panels.sa.types.items', label:'南美洲-签证种类-条目（结构化数组）', type:'json' },
    { key:'region.panels.sa.travel.title', label:'南美洲-旅游特色-标题', type:'text' },
    { key:'region.panels.sa.travel.items', label:'南美洲-旅游特色-条目（结构化数组）', type:'json' },
    { key:'region.panels.sa.services.title', label:'南美洲-可办理业务-标题', type:'text' },
    { key:'region.panels.sa.services.items', label:'南美洲-可办理业务-条目（结构化数组）', type:'json' },
    { key:'region.panels.sa.note', label:'南美洲-底部说明', type:'textarea' },
    { key:'region.panels.jpkr.title', label:'日韩-标题', type:'text' },
    { key:'region.panels.jpkr.intro', label:'日韩-介绍', type:'textarea' },
    { key:'region.panels.jpkr.types.title', label:'日韩-签证种类-标题', type:'text' },
    { key:'region.panels.jpkr.types.items', label:'日韩-签证种类-条目（结构化数组）', type:'json' },
    { key:'region.panels.jpkr.travel.title', label:'日韩-旅游特色-标题', type:'text' },
    { key:'region.panels.jpkr.travel.items', label:'日韩-旅游特色-条目（结构化数组）', type:'json' },
    { key:'region.panels.jpkr.services.title', label:'日韩-可办理业务-标题', type:'text' },
    { key:'region.panels.jpkr.services.items', label:'日韩-可办理业务-条目（结构化数组）', type:'json' },
    { key:'region.panels.jpkr.note', label:'日韩-底部说明', type:'textarea' },
    { key:'region.panels.aunz.title', label:'澳新-标题', type:'text' },
    { key:'region.panels.aunz.intro', label:'澳新-介绍', type:'textarea' },
    { key:'region.panels.aunz.types.title', label:'澳新-签证种类-标题', type:'text' },
    { key:'region.panels.aunz.types.items', label:'澳新-签证种类-条目（结构化数组）', type:'json' },
    { key:'region.panels.aunz.travel.title', label:'澳新-旅游特色-标题', type:'text' },
    { key:'region.panels.aunz.travel.items', label:'澳新-旅游特色-条目（结构化数组）', type:'json' },
    { key:'region.panels.aunz.services.title', label:'澳新-可办理业务-标题', type:'text' },
    { key:'region.panels.aunz.services.items', label:'澳新-可办理业务-条目（结构化数组）', type:'json' },
    { key:'region.panels.aunz.note', label:'澳新-底部说明', type:'textarea' },
    { key:'faq.items', label:'常见问题列表（可增删）', type:'repeater', subFields:[
      { key:'q', label:'问题', type:'text' },
      { key:'a', label:'答案', type:'textarea' }
    ]},
    // CTA 模块：当前页面已通过 cta.enabled:false 在前端隐藏整个区域，
    // 后台同步隐藏以防运营误改。如需恢复显示，直接编辑 visa.json 的 cta.enabled=true
    { key:'cta.enabled', label:'CTA区域-是否显示（true=显示，false=隐藏）', type:'text', hidden:true },
    { key:'cta.title', label:'CTA区域-标题', type:'text', hidden:true },
    { key:'cta.subtitle', label:'CTA区域-副标题', type:'text', hidden:true },
    { key:'cta.btn1', label:'CTA按钮一文案', type:'text', hidden:true },
    { key:'cta.btn1_url', label:'CTA按钮一链接', type:'url', hidden:true },
    { key:'cta.btn2', label:'CTA按钮二文案', type:'text', hidden:true },
    { key:'cta.btn2_url', label:'CTA按钮二链接', type:'url', hidden:true },
    { key:'sidebar.contact.title', label:'侧边栏-联系标题', type:'text' },
    { key:'sidebar.contact.sub', label:'侧边栏-联系副标题', type:'text' },
    { key:'sidebar.phone.label', label:'侧边栏-电话标签', type:'text' },
    { key:'sidebar.phone.value', label:'侧边栏-电话号码', type:'text' },
    { key:'sidebar.email.label', label:'侧边栏-邮箱标签', type:'text' },
    { key:'sidebar.email.value', label:'侧边栏-邮箱地址', type:'text' },
    { key:'sidebar.qr.personal', label:'侧边栏-个人微信二维码', type:'image' },
    { key:'sidebar.qr.enterprise', label:'侧边栏-企业微信二维码', type:'image' },
    { key:'sidebar.qr.whatsapp', label:'侧边栏-WhatsApp二维码', type:'image' },
    { key:'sidebar.trust.title', label:'侧边栏-信任标题', type:'text' },
    { key:'sidebar.trust.items', label:'侧边栏-信任点列表（可增删）', type:'repeater', subFields:[
      { key:'text', label:'信任点文字', type:'text' }
    ]}
  ],

  // ════════════════════════════════════════════
  //  境外保险
  // ════════════════════════════════════════════
  'insurance': [
    { key:'hero.badge', label:'大图-徽章标签', type:'text' },
    { key:'hero.title', label:'大图-主标题', type:'text' },
    { key:'hero.subtitle', label:'大图-副标题', type:'text' },
    { key:'hero.desc', label:'大图-描述', type:'text' },
    { key:'hero.bgImage', label:'大图-背景图片', type:'image' },
    { key:'section.types.tag', label:'保险类型-区域标签', type:'text' },
    { key:'section.types.title', label:'保险类型-标题', type:'text' },
    { key:'section.types.subtitle', label:'保险类型-副标题', type:'text' },
    { key:'ins.types.items', label:'保险类型-卡片列表（每条：title + desc + cta；icon 由前端自动选择）', type:'repeater', subFields:[
      { key:'title', label:'标题', type:'text' },
      { key:'desc',  label:'描述', type:'textarea' },
      { key:'cta',   label:'按钮文案', type:'text' }
    ]},
    { key:'section.faq.tag', label:'常见问题-区域标签', type:'text' },
    { key:'section.faq.title', label:'常见问题-标题', type:'text' },
    { key:'faq.items', label:'常见问题-问答列表（每条：q 问题 + a 答案）', type:'repeater' },
    { key:'sidebar.contact.title', label:'侧边栏-联系标题', type:'text' },
    { key:'sidebar.contact.sub', label:'侧边栏-联系副标题', type:'text' },
    { key:'sidebar.phone.label', label:'侧边栏-电话标签', type:'text' },
    { key:'sidebar.phone.value', label:'侧边栏-电话号码', type:'text' },
    { key:'sidebar.email.label', label:'侧边栏-邮箱标签', type:'text' },
    { key:'sidebar.email.value', label:'侧边栏-邮箱地址', type:'text' },
    { key:'sidebar.qr.personal', label:'侧边栏-个人微信二维码', type:'image' },
    { key:'sidebar.qr.enterprise', label:'侧边栏-企业微信二维码', type:'image' },
    { key:'sidebar.qr.whatsapp', label:'侧边栏-WhatsApp二维码', type:'image' },
    { key:'sidebar.trust.title', label:'侧边栏-信任标题', type:'text' },
    { key:'sidebar.trust.p1', label:'侧边栏-信任点1', type:'text' },
    { key:'sidebar.trust.p2', label:'侧边栏-信任点2', type:'text' },
    { key:'sidebar.trust.p3', label:'侧边栏-信任点3', type:'text' },
    { key:'sidebar.trust.p4', label:'侧边栏-信任点4', type:'text' },
    { key:'sidebar.trust.p5', label:'侧边栏-信任点5', type:'text' },
    // 页面基础信息：当前由前端代码从 nav/footer 读取，无需后台编辑
    { key:'page.title', label:'浏览器页面标题', type:'text', hidden:true },
    // CTA 模块：当前页面已通过 cta.enabled:false 在前端隐藏整个区域
    { key:'cta.enabled', label:'CTA区域-是否显示（true=显示，false=隐藏）', type:'text', hidden:true },
    { key:'cta.title', label:'CTA区域-标题', type:'text', hidden:true },
    { key:'cta.subtitle', label:'CTA区域-副标题', type:'text', hidden:true },
    { key:'cta.btn1', label:'CTA按钮一文案', type:'text', hidden:true },
    { key:'cta.btn1_url', label:'CTA按钮一链接', type:'url', hidden:true },
    { key:'cta.btn2', label:'CTA按钮二文案', type:'text', hidden:true },
    { key:'cta.btn2_url', label:'CTA按钮二链接', type:'url', hidden:true }
  ],

  // ════════════════════════════════════════════
  //  境外交通住宿
  // ════════════════════════════════════════════
  'transport': [
    { key:'hero.badge', label:'大图-徽章标签', type:'text' },
    { key:'hero.title', label:'大图-主标题', type:'text' },
    { key:'hero.subtitle', label:'大图-副标题', type:'text' },
    { key:'hero.desc', label:'大图-描述', type:'text' },
    { key:'hero.bgImage', label:'大图-背景图片', type:'image' },
    { key:'transport.services.tag', label:'服务类型-区域标签', type:'text' },
    { key:'transport.services.title', label:'服务类型-标题', type:'text' },
    { key:'transport.services.subtitle', label:'服务类型-副标题', type:'text' },
    { key:'transport.services.items', label:'服务类型-卡片列表（每条：title + desc；icon 由前端自动选择）', type:'repeater', subFields:[
      { key:'title', label:'标题', type:'text' },
      { key:'desc',  label:'描述', type:'textarea' }
    ]},
    { key:'transport.steps.tag', label:'预订流程-区域标签', type:'text' },
    { key:'transport.steps.title', label:'预订流程-标题', type:'text' },
    { key:'transport.steps.subtitle', label:'预订流程-副标题', type:'text' },
    { key:'transport.steps.items', label:'预订流程-步骤列表（每条：title + desc）', type:'json' },
    { key:'transport.faqs.tag', label:'FAQ-区域标签', type:'text' },
    { key:'transport.faqs.title', label:'FAQ-标题', type:'text' },
    { key:'transport.faqs.items', label:'FAQ-问答列表（每条：q 问题 + a 答案）', type:'repeater' },
    { key:'sidebar.trust.title', label:'侧边栏-信任点标题', type:'text' },
    { key:'sidebar.trust.points.items', label:'侧边栏-信任点列表（每条：text；icon 由前端自动选择）', type:'repeater', subFields:[
      { key:'text', label:'信任点文案', type:'text' }
    ]},
    { key:'sidebar.contact.title', label:'侧边栏-联系标题', type:'text' },
    { key:'sidebar.contact.sub', label:'侧边栏-联系副标题', type:'text' },
    { key:'sidebar.phone.label', label:'侧边栏-电话标签', type:'text' },
    { key:'sidebar.phone.value', label:'侧边栏-电话号码', type:'text' },
    { key:'sidebar.email.label', label:'侧边栏-邮箱标签', type:'text' },
    { key:'sidebar.email.value', label:'侧边栏-邮箱地址', type:'text' },
    { key:'sidebar.qr.personal', label:'侧边栏-个人微信二维码', type:'image' },
    { key:'sidebar.qr.enterprise', label:'侧边栏-企业微信二维码', type:'image' },
    { key:'sidebar.qr.whatsapp', label:'侧边栏-WhatsApp二维码', type:'image' },
    // 页面基础信息：当前由前端代码从 nav/footer 读取，无需后台编辑
    { key:'page.title', label:'浏览器页面标题', type:'text', hidden:true },
    // CTA 模块：当前页面已通过 cta.enabled:false 在前端隐藏整个区域
    { key:'cta.enabled', label:'CTA区域-是否显示（true=显示，false=隐藏）', type:'text', hidden:true },
    { key:'cta.title', label:'CTA区域-标题', type:'text', hidden:true },
    { key:'cta.subtitle', label:'CTA区域-副标题', type:'text', hidden:true },
    { key:'cta.btn1', label:'CTA按钮一文案', type:'text', hidden:true },
    { key:'cta.btn1_url', label:'CTA按钮一链接', type:'url', hidden:true },
    { key:'cta.btn2', label:'CTA按钮二文案', type:'text', hidden:true },
    { key:'cta.btn2_url', label:'CTA按钮二链接', type:'url', hidden:true }
  ],

  // ════════════════════════════════════════════
  //  企业出海
  // ════════════════════════════════════════════
  'enterprise': [
    { key:'section.services.tag', label:'服务类型-区域标签', type:'text' },
    { key:'section.services.title', label:'服务类型-标题', type:'text' },
    { key:'section.services.subtitle', label:'服务类型-副标题', type:'text' },
    { key:'enterprise.services.items', label:'企业出海核心服务-卡片列表（每条：title + desc + points[3]；icon 由前端自动选择）', type:'repeater', subFields:[
      { key:'title',  label:'标题', type:'text' },
      { key:'desc',   label:'描述', type:'textarea' },
      { key:'points', label:'要点（字符串数组）', type:'json' }
    ]},
    { key:'section.faq.tag', label:'常见问题-区域标签', type:'text' },
    { key:'section.faq.title', label:'常见问题-标题', type:'text' },
    { key:'enterprise.faq.items', label:'FAQ-问答列表（每条：q 问题 + a 答案）', type:'repeater' },
    // 页面基础信息：当前由前端代码从 nav/footer 读取，无需后台编辑
    { key:'page.title', label:'浏览器页面标题', type:'text', hidden:true },
    { key:'hero.badge', label:'大图徽章标签', type:'text' },
    { key:'hero.title', label:'大图主标题', type:'text' },
    { key:'hero.subtitle', label:'大图副标题', type:'text' },
    { key:'hero.desc', label:'大图描述', type:'text' },
    { key:'hero.bgImage', label:'大图背景图片', type:'image' },
    // CTA 模块：当前页面已通过 cta.enabled:false 在前端隐藏整个区域
    { key:'cta.enabled', label:'CTA区域-是否显示（true=显示，false=隐藏）', type:'text', hidden:true },
    { key:'cta.title', label:'CTA区域-标题', type:'text', hidden:true },
    { key:'cta.subtitle', label:'CTA区域-副标题', type:'text', hidden:true },
    { key:'cta.btn1', label:'CTA按钮一文案', type:'text', hidden:true },
    { key:'cta.btn1_url', label:'CTA按钮一链接', type:'url', hidden:true },
    { key:'cta.btn2', label:'CTA按钮二文案', type:'text', hidden:true },
    { key:'cta.btn2_url', label:'CTA按钮二链接', type:'url', hidden:true },
    { key:'sidebar.contact.title', label:'侧边栏-联系标题', type:'text' },
    { key:'sidebar.contact.sub', label:'侧边栏-联系副标题', type:'text' },
    { key:'sidebar.phone.label', label:'侧边栏-电话标签', type:'text' },
    { key:'sidebar.phone.value', label:'侧边栏-电话号码', type:'text' },
    { key:'sidebar.email.label', label:'侧边栏-邮箱标签', type:'text' },
    { key:'sidebar.email.value', label:'侧边栏-邮箱地址', type:'text' },
    { key:'sidebar.qr.personal', label:'侧边栏-个人微信二维码', type:'image' },
    { key:'sidebar.qr.enterprise', label:'侧边栏-企业微信二维码', type:'image' },
    { key:'sidebar.qr.whatsapp', label:'侧边栏-WhatsApp二维码', type:'image' },
    { key:'sidebar.trust.title', label:'侧边栏-信任标题', type:'text' },
    { key:'sidebar.trust.p1', label:'侧边栏-信任点1', type:'text' },
    { key:'sidebar.trust.p2', label:'侧边栏-信任点2', type:'text' },
    { key:'sidebar.trust.p3', label:'侧边栏-信任点3', type:'text' },
    { key:'sidebar.trust.p4', label:'侧边栏-信任点4', type:'text' },
    { key:'sidebar.trust.p5', label:'侧边栏-信任点5', type:'text' }
  ],

  // ════════════════════════════════════════════
  //  企业考察
  // ════════════════════════════════════════════
  'inspection': [
    { key:'section.services.tag', label:'服务类型-区域标签', type:'text' },
    { key:'section.services.title', label:'服务类型-标题', type:'text' },
    { key:'section.services.subtitle', label:'服务类型-副标题', type:'text' },
    { key:'inspection.services.items', label:'考察服务-卡片列表（每条：title + desc；icon 由前端自动选择）', type:'repeater', subFields:[
      { key:'title', label:'标题', type:'text' },
      { key:'desc',  label:'描述', type:'textarea' }
    ]},
    { key:'section.faq.tag', label:'常见问题-区域标签', type:'text' },
    { key:'section.faq.title', label:'常见问题-标题', type:'text' },
    { key:'inspection.faq.items', label:'FAQ-问答列表（每条：q 问题 + a 答案）', type:'repeater' },
    // 页面基础信息：当前由前端代码从 nav/footer 读取，无需后台编辑
    { key:'page.title', label:'浏览器页面标题', type:'text', hidden:true },
    { key:'hero.badge', label:'大图徽章标签', type:'text' },
    { key:'hero.title', label:'大图主标题', type:'text' },
    { key:'hero.subtitle', label:'大图副标题', type:'text' },
    { key:'hero.desc', label:'大图描述', type:'text' },
    { key:'hero.bgImage', label:'大图背景图片', type:'image' },
    // CTA 模块：当前页面已通过 cta.enabled:false 在前端隐藏整个区域
    { key:'cta.enabled', label:'CTA区域-是否显示（true=显示，false=隐藏）', type:'text', hidden:true },
    { key:'cta.title', label:'CTA区域-标题', type:'text', hidden:true },
    { key:'cta.subtitle', label:'CTA区域-副标题', type:'text', hidden:true },
    { key:'cta.btn1', label:'CTA按钮一文案', type:'text', hidden:true },
    { key:'cta.btn1_url', label:'CTA按钮一链接', type:'url', hidden:true },
    { key:'cta.btn2', label:'CTA按钮二文案', type:'text', hidden:true },
    { key:'cta.btn2_url', label:'CTA按钮二链接', type:'url', hidden:true },
    { key:'sidebar.contact.title', label:'侧边栏-联系标题', type:'text' },
    { key:'sidebar.contact.sub', label:'侧边栏-联系副标题', type:'text' },
    { key:'sidebar.phone.label', label:'侧边栏-电话标签', type:'text' },
    { key:'sidebar.phone.value', label:'侧边栏-电话号码', type:'text' },
    { key:'sidebar.email.label', label:'侧边栏-邮箱标签', type:'text' },
    { key:'sidebar.email.value', label:'侧边栏-邮箱地址', type:'text' },
    { key:'sidebar.qr.personal', label:'侧边栏-个人微信二维码', type:'image' },
    { key:'sidebar.qr.enterprise', label:'侧边栏-企业微信二维码', type:'image' },
    { key:'sidebar.qr.whatsapp', label:'侧边栏-WhatsApp二维码', type:'image' },
    { key:'sidebar.trust.title', label:'侧边栏-信任标题', type:'text' },
    { key:'sidebar.trust.p1', label:'侧边栏-信任点1', type:'text' },
    { key:'sidebar.trust.p2', label:'侧边栏-信任点2', type:'text' },
    { key:'sidebar.trust.p3', label:'侧边栏-信任点3', type:'text' },
    { key:'sidebar.trust.p4', label:'侧边栏-信任点4', type:'text' },
    { key:'sidebar.trust.p5', label:'侧边栏-信任点5', type:'text' }
  ],

  // ════════════════════════════════════════════
  //  关于我们
  // ════════════════════════════════════════════
  'about': [
    { key:'hero.badge', label:'大图徽章标签', type:'text' },
    { key:'hero.title', label:'大图主标题', type:'text' },
    { key:'hero.subtitle', label:'大图副标题', type:'text' },
    { key:'profile.tag', label:'公司简介-标签', type:'text' },
    { key:'profile.title', label:'公司简介-标题', type:'text' },
    { key:'profile.p1', label:'公司简介-段落1', type:'textarea' },
    { key:'profile.p3', label:'公司简介-段落2', type:'textarea' },
    { key:'profile.image', label:'公司简介-右侧图片', type:'image' },
    { key:'stats.items', label:'数据统计列表', type:'repeater', subFields:[
      { key:'number', label:'数字', type:'text' },
      { key:'label',  label:'单位/标签', type:'text' }
    ]},
    { key:'advantages.tag', label:'核心优势-区域标签', type:'text' },
    { key:'advantages.title', label:'核心优势-标题', type:'text' },
    { key:'advantages.subtitle', label:'核心优势-副标题', type:'text' },
    { key:'adv.items', label:'核心优势列表（每条：title + desc；icon 由前端根据 title 自动选择）', type:'repeater', subFields:[
      { key:'title', label:'标题', type:'text' },
      { key:'desc',  label:'描述', type:'textarea' }
    ]},
    { key:'page.title', label:'浏览器页面标题', type:'text', hidden:true },
    { key:'cta.enabled', label:'CTA启用', type:'text', hidden:true },
    { key:'cta.title', label:'CTA区域-标题', type:'text', hidden:true },
    { key:'cta.subtitle', label:'CTA区域-副标题', type:'text', hidden:true },
    { key:'cta.btn1', label:'CTA按钮一文案', type:'text', hidden:true },
    { key:'cta.btn1_url', label:'CTA按钮一链接', type:'url', hidden:true },
    { key:'cta.btn2', label:'CTA按钮二文案', type:'text', hidden:true },
    { key:'cta.btn2_url', label:'CTA按钮二链接', type:'url', hidden:true }
  ],
};

function getPageFields(pageKey) { return PAGE_FIELDS[pageKey] || []; }

// 合并 snapshot 到现有 data：扁平 key (如 hero.title) → 嵌套路径
// snapshot 值是字符串时 → 转成 {zh:..., en:''}
// snapshot 值是对象时 → 保持
function mergeSnapshot(data, snapshot) {
  const out = JSON.parse(JSON.stringify(data || {}));
  Object.keys(snapshot).forEach(flatKey => {
    const val = snapshot[flatKey];
    const parts = flatKey.split('.');
    let cur = out;
    for (let i = 0; i < parts.length; i++) {
      if (i === parts.length - 1) {
        // 只有目标位置为空才写入（避免覆盖已有内容）
        if (cur[parts[i]] == null) {
          cur[parts[i]] = (val && typeof val === 'object') ? val : { zh: String(val || ''), en: '' };
        }
      } else {
        cur[parts[i]] = cur[parts[i]] || {};
        cur = cur[parts[i]];
      }
    }
  });
  return out;
}

function getNested(obj, key) {
  const parts = key.split('.');
  let cur = obj;
  for (const p of parts) { if (cur == null) return null; cur = cur[p]; }
  if (cur && typeof cur === 'object' && cur.zh) return cur.zh;
  if (typeof cur === 'string') return cur;
  return null;
}

const PAGE_LABELS = {home:'首页',about:'关于我们',visa:'全球签证','saudi-visa':'沙特签证',enterprise:'企业出海',transport:'境外交通住宿',insurance:'境外保险',inspection:'企业考察'};
function getPageLabel(k) { return PAGE_LABELS[k] || k; }
function esc(s) { if (!s) return ''; return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// 模块名 + 图标 映射（key 第一段 → 中文显示名 + emoji）
const MODULE_META = {
  page:            { name: '页面基础信息',    icon: '📄' },
  hero:            { name: '顶部大图 Hero',    icon: '🎯' },
  visa:            { name: '签证服务板块',     icon: '✈️' },
  services:        { name: '核心服务卡片',     icon: '🛠️' },
  stats:           { name: '数据统计',        icon: '📊' },
  cta:             { name: '行动召唤 CTA',     icon: '📣' },
  testimonial:     { name: '客户评价',        icon: '💬' },
  section:         { name: '内容板块',        icon: '📑' },
  step:            { name: '办理步骤',        icon: '👣' },
  steps:           { name: '办理步骤',        icon: '👣' },
  faq:             { name: '常见问题 FAQ',     icon: '❓' },
  process:         { name: '业务流程',        icon: '⚙️' },
  region:          { name: '地区分类',        icon: '🌍' },
  countries:       { name: '国家/热门签证',    icon: '🗺️' },
  types:           { name: '签证类型',        icon: '📋' },
  features:        { name: '产品特点',        icon: '✨' },
  advantage:       { name: '核心优势',        icon: '🏆' },
  advantages:      { name: '核心优势',        icon: '🏆' },
  service:         { name: '服务内容',        icon: '🎁' },
  services_:       { name: '服务内容',        icon: '🎁' },
  plan:            { name: '方案/套餐',        icon: '📦' },
  team:            { name: '团队介绍',        icon: '👥' },
  company:         { name: '公司信息',        icon: '🏢' },
  about:           { name: '关于我们',        icon: 'ℹ️' },
  contact:         { name: '联系方式',        icon: '📞' },
  sidebar:         { name: '侧边栏',         icon: '📌' },
  form:            { name: '表单/输入',       icon: '📝' },
  modal:           { name: '弹窗',          icon: '💭' },
  consult:         { name: '咨询表单',       icon: '💬' },
  intro:           { name: '简介/概述',       icon: '📖' },
  introSection:    { name: '简介/概述',       icon: '📖' },
  culture:         { name: '企业文化',       icon: '🎨' },
  history:         { name: '发展历程',       icon: '⏳' },
  honor:           { name: '荣誉资质',       icon: '🏅' },
  partner:         { name: '合作伙伴',       icon: '🤝' },
  price:           { name: '价格/费用',       icon: '💰' },
  material:        { name: '所需材料',       icon: '📂' },
  materials:       { name: '所需材料',       icon: '📂' },
  notice:          { name: '注意事项',       icon: '⚠️' },
  flow:            { name: '流程介绍',       icon: '🔁' },
  coverage:        { name: '保障范围',       icon: '🛡️' },
  claim:           { name: '理赔说明',       icon: '📑' },
  vehicle:         { name: '车辆/交通',       icon: '🚗' },
  hotel:           { name: '酒店住宿',       icon: '🏨' },
  itinerary:       { name: '行程安排',       icon: '🗓️' },
  travel:          { name: '旅游信息',       icon: '🌴' },
  route:           { name: '路线/航线',       icon: '🧭' },
  area:            { name: '地区板块',       icon: '🌏' },
  card:            { name: '卡片',          icon: '🃏' },
  highlight:       { name: '亮点/推荐',       icon: '⭐' },
  strategy:        { name: '战略板块',       icon: '🎯' },
  solution:        { name: '解决方案',       icon: '💡' },
  case_:           { name: '案例展示',       icon: '📚' },
  footer:          { name: '页脚',          icon: '⬇️' },
  nav:             { name: '导航菜单',       icon: '🧭' },
  meta:            { name: 'Meta/SEO',      icon: '🔎' },
  banner:          { name: '横幅 Banner',    icon: '🖼️' },
};
function getModuleName(key) {
  // 兼容 region.jpkr.types → 取第一段；带前缀的（如 section.process）取第二段
  const firstSeg = key.split('.')[0];
  if (MODULE_META[firstSeg]) return MODULE_META[firstSeg].name;
  // 兜底：自动生成中文名
  const fallback = { hero:'Hero', faq:'FAQ', cta:'CTA' };
  return fallback[firstSeg] || (firstSeg.charAt(0).toUpperCase() + firstSeg.slice(1) + ' 模块');
}
function getModuleIcon(key) {
  const firstSeg = key.split('.')[0];
  return (MODULE_META[firstSeg] || {}).icon || '📦';
}

async function renderPageEditor(container, pageKey) {
  const fields = getPageFields(pageKey);
  // 过滤掉 hidden:true 的字段（如前端已通过代码隐藏的模块，避免后台误改）
  const visibleFields = fields.filter(f => !f.hidden);
  let data = {};
  try {
    const r = await fetch(`${API}/content/${pageKey}`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('cms_token')}` }
    });
    if (r.ok) data = await r.json();
  } catch(e) { console.error(e); }

  // 如果服务端没有数据（或字段全空），从 HTML 抓取当前默认值回显
  const allEmpty = visibleFields.every(f => !getNested(data, f.key));
  if (allEmpty && visibleFields.length > 0) {
    try {
      const snapR = await fetch(`${API}/page-snapshot/${pageKey}`);
      if (snapR.ok) {
        const { snapshot } = await snapR.json();
        if (snapshot && Object.keys(snapshot).length) {
          data = mergeSnapshot(data, snapshot);
          console.log('[CMS] 从 HTML 抓取默认值:', Object.keys(snapshot).length, '个字段');
        }
      }
    } catch(e) { console.warn('[CMS] 抓取默认值失败:', e); }
  }

  // 按模块（key 第一段，如 hero/section.process/step/faq/cta）分组
  const groups = {};
  visibleFields.forEach(f => {
    const moduleKey = f.key.split('.')[0];
    if (!groups[moduleKey]) groups[moduleKey] = [];
    groups[moduleKey].push(f);
  });
  // 保持字段在原始数组中的顺序
  const orderedKeys = [];
  visibleFields.forEach(f => {
    const k = f.key.split('.')[0];
    if (!orderedKeys.includes(k)) orderedKeys.push(k);
  });

  const groupsHTML = orderedKeys.map(modKey => {
    const modFields = groups[modKey];
    // 如果整个模块的字段都标记为 hidden:true（不显示），则跳过该模块
    if (!modFields || modFields.length === 0) return '';
    const fieldsHTML = modFields.map(f => {
      const val = getNested(data, f.key) || '';
      if (f.type === 'image') {
        return imgUploadField(`field-${f.key}`, val, f.label, '建议尺寸 800x600px，支持 JPG/PNG/WebP');
      } else if (f.type === 'url') {
        return `
        <div class="mb-3">
          <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">${f.label} <span class="text-gray-400 font-normal normal-case">（链接地址）</span></label>
          <input type="url" id="field-${f.key}" value="${esc(val)}" placeholder="https:// 或 /page.html 或 tel:..." class="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-zsts-green/30 focus:border-zsts-green">
        </div>`;
      } else if (f.type === 'textarea') {
        return `
        <div class="mb-3">
          <label class="block text-xs font-semibold text-gray-500 mb-1.5">${f.label}</label>
          <textarea id="field-${f.key}" rows="3" class="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-zsts-green/30 focus:border-zsts-green">${esc(val)}</textarea>
        </div>`;
      } else if (f.type === 'json' || f.type === 'repeater') {
        // 结构化数组字段（如：材料清单的分组+材料项）
        // val 形如 {zh: [...], en: [...]}，如不存在则初始化为空数组
        const jsonVal = (val && typeof val === 'object') ? val : { zh: [], en: [] };
        return `
        <div class="mb-3 json-field-wrap" data-field-key="${f.key}">
          <label class="block text-xs font-semibold text-gray-500 mb-1.5">${f.label} <span class="text-gray-400 font-normal">（结构化数组，可增/删/拖拽）</span></label>
          <div id="field-${f.key}" class="json-field-container bg-gray-50 border border-gray-200 rounded-lg p-3"></div>
        </div>`;
      } else {
        return `
        <div class="mb-3">
          <label class="block text-xs font-semibold text-gray-500 mb-1.5">${f.label}</label>
          <input type="text" id="field-${f.key}" value="${esc(val)}" class="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-zsts-green/30 focus:border-zsts-green">
        </div>`;
      }
    }).join('');

    return `
      <div class="module-group" data-module="${modKey}">
        <div class="module-header">
          <div class="module-icon">${getModuleIcon(modKey)}</div>
          <div>
            <h3 class="module-title">${getModuleName(modKey)}</h3>
            <div class="module-meta">${modFields.length} 个字段 · 命名空间 <code>${modKey}.*</code></div>
          </div>
          <button type="button" class="module-toggle" onclick="this.closest('.module-group').classList.toggle('collapsed')">
            <span class="toggle-icon">▾</span>
          </button>
        </div>
        <div class="module-body">${fieldsHTML}</div>
      </div>`;
  }).join('');

  container.innerHTML = `
    <div class="max-w-5xl mx-auto editor-panel">
      <div class="mb-6 flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">页面内容 — ${getPageLabel(pageKey)}</h1>
          <p class="text-gray-500 text-sm mt-1">按模块分组展示，方便定位要编辑的字段。编辑完成后点击右下角保存。</p>
        </div>
        <div class="flex gap-2 text-xs">
          <button type="button" onclick="document.querySelectorAll('.module-group').forEach(g=>g.classList.remove('collapsed'))" class="px-3 py-1.5 bg-white border border-gray-200 rounded-md hover:bg-gray-50">全部展开</button>
          <button type="button" onclick="document.querySelectorAll('.module-group').forEach(g=>g.classList.add('collapsed'))" class="px-3 py-1.5 bg-white border border-gray-200 rounded-md hover:bg-gray-50">全部折叠</button>
        </div>
      </div>
      <div class="space-y-4">
        ${groupsHTML || '<p class="text-gray-400 py-8 text-center bg-white rounded-xl border">该页面暂未配置可编辑字段。</p>'}
      </div>
      ${fields.length ? `
      <div class="save-bar">
        <span class="save-hint">编辑完成后点击保存</span>
        <div class="flex gap-2">
          <button onclick="openPreview('${pageKey}')" class="btn-reset">👁 预览前台</button>
          <button onclick="savePageContent('${pageKey}')" class="btn-save">💾 保存页面内容</button>
        </div>
      </div>` : ''}
    </div>`;

  // 初始化 json 类型字段（调用 json-editor.js）
  window._jsonFieldStore = window._jsonFieldStore || {};
  visibleFields.forEach(f => {
    if (f.type === 'json' || f.type === 'repeater') {
      const container = document.getElementById(`field-${f.key}`);
      if (!container || !window.JsonEditor) return;
      const initVal = (data && getNested(data, f.key)) || { zh: [], en: [] };
      window._jsonFieldStore[f.key] = JSON.parse(JSON.stringify(initVal));
      window.JsonEditor.render(`field-${f.key}`, initVal, '', (path, val) => {
        // onchange: path 形如 "zh[0].items[1].title"，val 是新值
        if (!path) {
          window._jsonFieldStore[f.key] = val;
        } else {
          window.JsonEditor.setValueByPath(window._jsonFieldStore[f.key], path, val);
        }
      });
    }
  });
}

async function savePageContent(pageKey) {
  const fields = getPageFields(pageKey);
  const payload = {};
  fields.forEach(f => {
    const keys = f.key.split('.');
    let cur = payload;
    for (let i = 0; i < keys.length; i++) {
      if (i === keys.length - 1) {
        if (f.type === 'image' || f.type === 'url') {
          // 图片/链接字段：直接存储URL字符串
          cur[keys[i]] = document.getElementById(`field-${f.key}`)?.value || '';
        } else if (f.type === 'json' || f.type === 'repeater') {
          // 结构化数组字段：从全局 registry 读取（如未注册则取空）
          const stored = (window._jsonFieldStore && window._jsonFieldStore[f.key]) || { zh: [], en: [] };
          cur[keys[i]] = stored;
        } else {
          // 文本字段：存储为 {zh, en} 对象
          cur[keys[i]] = { zh: document.getElementById(`field-${f.key}`)?.value || '', en: '' };
        }
      } else {
        cur[keys[i]] = cur[keys[i]] || {};
        cur = cur[keys[i]];
      }
    }
  });

  // 合并 hidden:true 字段：从服务端读取原数据，保留这些字段的值
  const hiddenFields = fields.filter(f => f.hidden);
  if (hiddenFields.length > 0) {
    try {
      const r = await fetch(`${API}/content/${pageKey}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('cms_token')}` }
      });
      if (r.ok) {
        const existing = await r.json();
        hiddenFields.forEach(f => {
          const v = getNested(existing, f.key);
          if (v !== undefined && v !== null) {
            const keys = f.key.split('.');
            let cur = payload;
            for (let i = 0; i < keys.length; i++) {
              if (i === keys.length - 1) {
                cur[keys[i]] = v;
              } else {
                cur[keys[i]] = cur[keys[i]] || {};
                cur = cur[keys[i]];
              }
            }
          }
        });
      }
    } catch(e) { console.warn('[CMS] 合并隐藏字段失败:', e); }
  }

  await doSave(pageKey, payload);
}

// ── 预览前台页面 ───────────────────────────────
window.openPreview = function(pageKey) {
  const pageMap = {
    'home':'index.html',
    'about':'about.html',
    'visa':'visa.html',
    'saudi-visa':'saudi-visa.html',
    'enterprise':'enterprise.html',
    'transport':'transport.html',
    'insurance':'insurance.html',
    'inspection':'inspection.html',
  };
  const htmlFile = pageMap[pageKey] || `${pageKey}.html`;
  const previewUrl = `/preview/${htmlFile}?preview=1&t=${Date.now()}`;
  window.open(previewUrl, '_blank', 'width=1280,height=900');
};

// ── 快速预览（从顶部按钮调用）───────────────────────
window.openPreviewDirect = function() {
  if (typeof window.openPreview === 'function') {
    window.openPreview('home');
  } else {
    window.open('/preview/index.html?preview=1&t=' + Date.now(), '_blank', 'width=1280,height=900');
  }
};

// ══════════════════════════════════════════════
//  占位页面
// ══════════════════════════════════════════════
async function renderAiChannelsPageOld(container) {
  container.innerHTML = `<div class="max-w-5xl mx-auto"><div class="bg-white rounded-xl p-10 text-center text-gray-400">🤖 AI 渠道配置（接入 Coze 后开发）</div></div>`;
}

async function renderLogsPage(container) {
  const API = window.API || '/api';
  const token = localStorage.getItem('cms_token');
  const headers = { 'Authorization': 'Bearer ' + token };
  let currentPage = 1;
  const pageSize = 20;

  async function loadLogs(page) {
    const params = new URLSearchParams({ page, limit: pageSize });
    const action = document.getElementById('logFilterAction')?.value || '';
    const username = document.getElementById('logFilterUser')?.value || '';
    const startDate = document.getElementById('logFilterStart')?.value || '';
    const endDate = document.getElementById('logFilterEnd')?.value || '';
    if (action) params.set('action', action);
    if (username) params.set('username', username);
    if (startDate) params.set('start_date', startDate);
    if (endDate) params.set('end_date', endDate);
    const r = await fetch(API + '/logs?' + params, { headers });
    if (!r.ok) throw new Error('加载失败');
    return await r.json();
  }

  async function clearAllLogs() {
    if (!confirm('确定清空所有操作日志？此操作不可恢复！')) return;
    const r = await fetch(API + '/logs', { method: 'DELETE', headers });
    if (!r.ok) { const err = await r.json().catch(()=>({})); alert(err.error || '清空失败'); return; }
    showToast('日志已清空');
    renderList(1);
  }

  function actionLabel(action) {
    const map = {
      'login': '登录', 'create_user': '创建用户', 'update_permissions': '更新权限',
      'reset_password': '重置密码', 'delete_user': '删除用户', 'update_content': '更新内容',
      'create_channel': '创建渠道', 'update_channel': '更新渠道', 'delete_channel': '删除渠道',
      'set_default_channel': '设置默认渠道', 'upload_image': '上传图片', 'clear_logs': '清空日志'
    };
    return map[action] || action;
  }

  function formatTime(ts) {
    if (!ts) return '-';
    const d = new Date(ts);
    const pad = n => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + pad(d.getMonth()+1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
  }

  async function renderList(page) {
    currentPage = page || currentPage;
    let data;
    try { data = await loadLogs(currentPage); } catch(e) { container.innerHTML = '<div style="background:#fef2f2;padding:16px;border-radius:8px;color:#dc2626;">加载失败：' + e.message + '</div>'; return; }
    const rows = data.rows || [];
    const totalPages = Math.ceil(data.total / pageSize) || 1;

    let html = '<div class="max-w-5xl mx-auto">' +
      '<div class="flex items-center justify-between mb-6">' +
        '<h2 class="text-2xl font-bold text-gray-900">📋 操作日志</h2>' +
        '<button onclick="window._clearLogs()" style="padding:8px 16px;background:#fff;color:#dc2626;border:1px solid #fca5a5;border-radius:8px;cursor:pointer;font-size:13px;font-weight:500;" onmouseover="this.style.background=\'#fef2f2\'" onmouseout="this.style.background=\'#fff\'">清空日志</button>' +
      '</div>' +
      '<div class="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100">' +
      '<div style="padding:16px 24px;border-bottom:1px solid #f3f4f6;display:flex;gap:12px;flex-wrap:wrap;align-items:center;">' +
        '<input id="logFilterUser" type="text" placeholder="用户名" style="padding:6px 12px;border:1px solid #d1d5db;border-radius:6px;font-size:13px;width:120px;outline:none;">' +
        '<input id="logFilterAction" type="text" placeholder="操作类型" style="padding:6px 12px;border:1px solid #d1d5db;border-radius:6px;font-size:13px;width:120px;outline:none;">' +
        '<input id="logFilterStart" type="date" style="padding:6px 12px;border:1px solid #d1d5db;border-radius:6px;font-size:13px;outline:none;">' +
        '<span style="color:#9ca3af;font-size:13px;">至</span>' +
        '<input id="logFilterEnd" type="date" style="padding:6px 12px;border:1px solid #d1d5db;border-radius:6px;font-size:13px;outline:none;">' +
        '<button onclick="window._searchLogs()" style="padding:6px 16px;background:#006341;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px;font-weight:500;" onmouseover="this.style.background=\'#004d33\'" onmouseout="this.style.background=\'#006341\'">查询</button>' +
        '<button onclick="window._resetLogFilter()" style="padding:6px 16px;background:#f3f4f6;color:#374151;border:none;border-radius:6px;cursor:pointer;font-size:13px;">重置</button>' +
      '</div>';

    if (rows.length === 0) {
      html += '<div class="p-12 text-center text-gray-400">暂无日志记录</div>';
    } else {
      html += '<table class="w-full text-sm"><thead class="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider"><tr>' +
        '<th class="px-6 py-4">时间</th><th class="px-6 py-4">用户</th><th class="px-6 py-4">操作</th><th class="px-6 py-4">目标</th><th class="px-6 py-4">详情</th>' +
        '</tr></thead><tbody class="divide-y divide-gray-100">';
      for (const row of rows) {
        html += '<tr class="hover:bg-gray-50/50">' +
          '<td class="px-6 py-3 text-gray-500 text-xs whitespace-nowrap">' + formatTime(row.timestamp) + '</td>' +
          '<td class="px-6 py-3 font-medium text-gray-900">' + esc(row.username) + '</td>' +
          '<td class="px-6 py-3"><span style="display:inline-block;padding:2px 10px;border-radius:9999px;font-size:12px;font-weight:500;background:#e6f4ec;color:#006341;">' + esc(actionLabel(row.action)) + '</span></td>' +
          '<td class="px-6 py-3 text-gray-600 text-xs">' + esc(row.target || '-') + '</td>' +
          '<td class="px-6 py-3 text-gray-400 text-xs max-w-xs truncate">' + esc(row.detail || '-') + '</td>' +
        '</tr>';
      }
      html += '</tbody></table>';
    }

    // 分页
    html += '<div style="padding:12px 24px;border-top:1px solid #f3f4f6;display:flex;align-items:center;justify-content:space-between;">' +
      '<span style="font-size:13px;color:#9ca3af;">共 ' + data.total + ' 条</span>' +
      '<div style="display:flex;gap:6px;align-items:center;">' +
        '<button onclick="window._goLogPage(' + (currentPage - 1) + ')" ' + (currentPage <= 1 ? 'disabled' : '') + ' style="padding:4px 12px;border:1px solid #d1d5db;border-radius:6px;font-size:13px;cursor:' + (currentPage <= 1 ? 'not-allowed' : 'pointer') + ';background:#fff;color:' + (currentPage <= 1 ? '#d1d5db' : '#374151') + ';">上一页</button>' +
        '<span style="font-size:13px;color:#6b7280;">' + currentPage + ' / ' + totalPages + '</span>' +
        '<button onclick="window._goLogPage(' + (currentPage + 1) + ')" ' + (currentPage >= totalPages ? 'disabled' : '') + ' style="padding:4px 12px;border:1px solid #d1d5db;border-radius:6px;font-size:13px;cursor:' + (currentPage >= totalPages ? 'not-allowed' : 'pointer') + ';background:#fff;color:' + (currentPage >= totalPages ? '#d1d5db' : '#374151') + ';">下一页</button>' +
      '</div></div>';

    html += '</div></div>';
    container.innerHTML = html;
  }

  await renderList(1);
  window._goLogPage = (p) => { if (p >= 1) renderList(p); };
  window._searchLogs = () => renderList(1);
  window._resetLogFilter = () => {
    const ids = ['logFilterUser','logFilterAction','logFilterStart','logFilterEnd'];
    ids.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    renderList(1);
  };
  window._clearLogs = clearAllLogs;
}

// ── AI 渠道配置页面 ─────────────────────────────
async function renderAiChannelsPage(container) {
  const API = window.API || '/api';

  async function loadChannels() {
    const r = await fetch(API + '/ai-channels', {
      headers: { 'Authorization': 'Bearer ' + localStorage.getItem('cms_token') }
    });
    if (!r.ok) throw new Error('加载失败');
    return await r.json();
  }

  async function saveChannel(data, id) {
    const method = id ? 'PUT' : 'POST';
    const url = id ? API + '/ai-channels/' + id : API + '/ai-channels';
    const r = await fetch(url, {
      method, headers: { 'Authorization': 'Bearer ' + localStorage.getItem('cms_token'), 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!r.ok) { const err = await r.json().catch(()=>({})); throw new Error(err.error || '保存失败'); }
    return await r.json();
  }

  async function deleteChannel(id) {
    if (!confirm('确定删除此渠道？')) return;
    const r = await fetch(API + '/ai-channels/' + id, {
      method: 'DELETE', headers: { 'Authorization': 'Bearer ' + localStorage.getItem('cms_token') }
    });
    if (!r.ok) { const err = await r.json().catch(()=>({})); throw new Error(err.error || '删除失败'); }
    await renderList();
  }

  async function setDefault(id) {
    const r = await fetch(API + '/ai-channels/' + id + '/set-default', {
      method: 'PUT', headers: { 'Authorization': 'Bearer ' + localStorage.getItem('cms_token') }
    });
    if (!r.ok) { const err = await r.json().catch(()=>({})); throw new Error(err.error || '设置失败'); }
    await renderList();
  }

  async function renderList() {
    let channels = [];
    try { channels = await loadChannels(); } catch(e) { container.innerHTML = '<div class="bg-red-50 p-4 rounded text-red-600">加载失败：' + e.message + '</div>'; return; }

    let html = '<div class="max-w-5xl mx-auto">' +
      '<div class="flex items-center justify-between mb-6">' +
        '<h2 class="text-2xl font-bold text-gray-900">🤖 AI 渠道配置</h2>' +
        '<button onclick="window._aiChAdd()" style="padding:10px 22px;background:#006341;color:#fff;border:none;border-radius:10px;cursor:pointer;font-size:14px;font-weight:600;box-shadow:0 2px 8px rgba(0,99,65,.2);" onmouseover="this.style.background=\'#004d33\'" onmouseout="this.style.background=\'#006341\'">+ 添加渠道</button>' +
      '</div>' +
      '<div class="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100">';

    if (channels.length === 0) {
      html += '<div class="p-12 text-center text-gray-400">暂无渠道，点击"添加渠道"创建第一个</div>';
    } else {
      html += '<table class="w-full text-sm"><thead class="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider"><tr>' +
        '<th class="px-6 py-4">渠道名称</th><th class="px-6 py-4">API 地址</th><th class="px-6 py-4">模型数量</th><th class="px-6 py-4">状态</th><th class="px-6 py-4 text-right">操作</th>' +
        '</tr></thead><tbody class="divide-y divide-gray-100">';
      for (const ch of channels) {
        const models = ch.model_list || [];
        const defBadge = ch.is_default
          ? '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">默认渠道</span>'
          : '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">普通</span>';
        html += '<tr class="hover:bg-gray-50/50 transition-colors">' +
          '<td class="px-6 py-4 font-semibold text-gray-900">' + esc(ch.name) + '</td>' +
          '<td class="px-6 py-4 text-gray-600 max-w-xs truncate font-mono text-xs">' + esc(ch.api_url) + '</td>' +
          '<td class="px-6 py-4 text-gray-600">' + models.length + ' 个</td>' +
          '<td class="px-6 py-4">' + defBadge + '</td>' +
          '<td class="px-6 py-4 text-right space-x-3">' +
            (!ch.is_default ? '<a href="javascript:void(0)" onclick="window._aiChSetDefault(' + ch.id + ')" class="text-xs text-blue-600 hover:underline font-medium">设为默认</a> ' : '') +
            '<a href="javascript:void(0)" onclick="window._aiChEdit(' + ch.id + ')" class="text-xs text-zsts-green hover:underline font-medium">编辑</a> ' +
            '<a href="javascript:void(0)" onclick="window._aiChDelete(' + ch.id + ')" class="text-xs text-red-500 hover:underline font-medium">删除</a>' +
          '</td>' +
        '</tr>';
      }
      html += '</tbody></table>';
    }
    html += '</div></div>';
    container.innerHTML = html;

    window._aiChAdd = () => showChannelModal();
    window._aiChEdit = (id) => { const ch = channels.find(c => c.id === id); if (ch) showChannelModal(id, ch); };
    window._aiChDelete = (id) => { deleteChannel(id).catch(e => alert(e.message)); };
    window._aiChSetDefault = (id) => { setDefault(id).catch(e => alert(e.message)); };
  }

  function showChannelModal(id, channel) {
    const isEdit = !!id;
    const ch = channel || { name:'', api_url:'', api_key:'', model_list:[], is_default:0 };
    let models = [...(ch.model_list || [])];

    function renderModelTags() {
      if (models.length === 0) return '<span class="text-xs text-gray-400">暂无模型，请在下方添加</span>';
      let s = '';
      for (const m of models) {
        s += '<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">' +
          esc(m) +
          '<a href="javascript:void(0)" onclick="window._aiChRemoveModel(\'' + m.replace(/'/g, "\'") + '\')" class="text-blue-500 hover:text-red-500 ml-0.5 text-sm leading-none">&times;</a>' +
        '</span> ';
      }
      return s;
    }

    const modal = document.createElement('div');
    modal.id = 'aiChModal';
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm';
    modal.innerHTML = '<div class="bg-white rounded-2xl max-w-lg w-full mx-4 p-6 shadow-2xl max-h-[90vh] overflow-y-auto" onclick="event.stopPropagation()">' +
      '<div class="flex items-center justify-between mb-6">' +
        '<h3 class="text-lg font-bold text-gray-900">' + (isEdit ? '编辑渠道' : '添加渠道') + '</h3>' +
        '<button onclick="document.getElementById(\'aiChModal\').remove()" class="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 text-xl leading-none">&times;</button>' +
      '</div>' +
      '<div class="space-y-5">' +
        '<div><label class="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">渠道名称</label>' +
          '<input type="text" id="aiChName" value="' + esc(ch.name) + '" placeholder="如：OpenRouter / OpenAI / 私服" class="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-zsts-green/30 focus:border-zsts-green outline-none transition"></div>' +
        '<div><label class="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">API 地址（Base URL）</label>' +
          '<input type="url" id="aiChUrl" value="' + esc(ch.api_url) + '" placeholder="https://openrouter.ai/api/v1" class="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-zsts-green/30 focus:border-zsts-green outline-none transition font-mono">' +
          '<p class="mt-1.5 text-xs text-gray-400">模仿 OpenRouter，填写完整的 Base URL（需包含 /v1 或对应路径）</p></div>' +
        '<div><label class="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">API 密钥</label>' +
          '<div class="relative"><input type="' + (window._aiChShowKey ? 'text' : 'password') + '" id="aiChKey" value="' + esc(ch.api_key || '') + '" placeholder="sk-or-v1-..." class="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-zsts-green/30 focus:border-zsts-green outline-none transition pr-16 font-mono">' +
          '<button type="button" onclick="window._aiChToggleKey()" class="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded">' + (window._aiChShowKey ? '隐藏' : '显示') + '</button></div></div>' +
        '<div><label class="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">模型列表</label>' +
          '<div id="modelTags" class="flex flex-wrap gap-1.5 mb-3 p-3 bg-gray-50 rounded-xl min-h-[42px]">' + renderModelTags() + '</div>' +
          '<div class="flex gap-2"><input type="text" id="newModelInput" placeholder="输入模型名称，如 gpt-4o" class="flex-1 px-4 py-2 border border-gray-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-zsts-green/30 focus:border-zsts-green">' +
          '<button onclick="window._aiChAddModel()" class="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 text-sm font-medium transition">添加</button></div>' +
          '<p class="mt-1.5 text-xs text-gray-400">添加此渠道支持的模型，AI 内容生成时可选择指定模型</p></div>' +
        '<div class="flex items-center gap-3 pt-2"><input type="checkbox" id="aiChDefault" ' + (ch.is_default ? 'checked' : '') + ' class="w-4 h-4 text-zsts-green border-gray-300 rounded focus:ring-zsts-green accent-zsts-green">' +
          '<label for="aiChDefault" class="text-sm text-gray-700 font-medium">设为默认渠道</label></div>' +
      '</div>' +
      '<div class="flex justify-end gap-3 mt-8 pt-5 border-t border-gray-100">' +
        '<button onclick="document.getElementById(\'aiChModal\').remove()" class="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 text-sm font-medium transition">取消</button>' +
        '<button onclick="window._aiChSave(' + (id || 'null') + ')" class="px-5 py-2.5 bg-zsts-green text-white rounded-xl hover:bg-green-700 text-sm font-semibold shadow-sm transition">保存</button>' +
      '</div></div>';

    document.querySelectorAll('.fixed.inset-0.z-50').forEach(el => el.remove());
    document.body.appendChild(modal);

    window._aiChToggleKey = () => { window._aiChShowKey = !window._aiChShowKey; showChannelModal(id, Object.assign({}, ch, { model_list: models })); };
    window._aiChAddModel = () => {
      const input = document.getElementById('newModelInput');
      const val = input.value.trim();
      if (!val) return;
      if (models.includes(val)) { alert('模型已存在'); return; }
      models.push(val);
      document.getElementById('modelTags').innerHTML = renderModelTags();
      input.value = '';
      input.focus();
    };
    window._aiChRemoveModel = (modelName) => {
      models = models.filter(m => m !== modelName);
      document.getElementById('modelTags').innerHTML = renderModelTags();
    };
    window._aiChSave = async (saveId) => {
      const name = document.getElementById('aiChName').value.trim();
      const api_url = document.getElementById('aiChUrl').value.trim();
      const api_key = document.getElementById('aiChKey').value.trim();
      const is_default = document.getElementById('aiChDefault').checked;
      if (!name || !api_url) { alert('渠道名称和 API 地址不能为空'); return; }
      try {
        if (saveId) {
          await saveChannel({ name, api_url, api_key, model_list: models }, saveId);
          if (is_default) await setDefault(saveId);
        } else {
          const result = await saveChannel({ name, api_url, api_key, model_list: models });
          if (is_default) await setDefault(result.id);
        }
        modal.remove();
        await renderList();
      } catch(e) { alert('保存失败：' + e.message); }
    };
    document.getElementById('newModelInput').addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); window._aiChAddModel(); }
    });
  }

  await renderList();
}
