/**
 * CMS 预览客户端
 * 注入到 /preview/*.html 页面，从 JSON 加载内容并替换 DOM
 *
 * 调试方法：打开浏览器开发者工具 → Console 标签页，查看以 [CMS] 开头的日志
 */
(function () {
  // 从 URL 路径解析 pageKey（更可靠，不依赖服务器注入变量）
  // /preview/visa.html → visa
  // /preview/index.html → home
  // /preview/saudi-visa.html → saudi-visa
  function getPageKeyFromURL() {
    const pathname = window.location.pathname; // e.g. /preview/visa.html
    const match = pathname.match(/\/preview\/([^/]+)\.html$/);
    if (!match) return 'home';
    const file = match[1]; // e.g. visa, index, saudi-visa
    const FILE_TO_KEY = {
      'index': 'home',
      'saudi-visa': 'saudi-visa',
      'visa': 'visa',
      'about': 'about',
      'enterprise': 'enterprise',
      'transport': 'transport',
      'insurance': 'insurance',
      'inspection': 'inspection',
      'news': 'saudi-news',
    };
    return FILE_TO_KEY[file] || file;
  }

  const pageKey = getPageKeyFromURL();
  console.log('[CMS Preview] 启动，URL:', window.location.pathname, '→ pageKey:', pageKey);

  // 拦截 applyTranslations，防止原始页面的 i18n 覆盖 CMS 注入的内容
  // 但允许 setLang 正常工作，并在语言切换后重新应用 CMS 内容
  const _origApply = window.applyTranslations;
  window.applyTranslations = function() {
    console.log('[CMS] ⚠️ applyTranslations() 被调用，已阻止（预览模式，由 CMS 内容接管）');
  };
  // 包装 setLang：允许语言切换，切换后重新应用 CMS 内容（使用已缓存数据，不重复请求）
  const _origSetLang = window.setLang;
  if (typeof _origSetLang === 'function') {
    window.setLang = function(lang) {
      _origSetLang(lang);
      // 语言切换后，用已缓存的 CMS 数据重新渲染（toString 会根据新语言取值）
      console.log('[CMS] 语言切换为:', lang, '，重新渲染 CMS 内容');
      if (window.CMS_PAGE_DATA) {
        setTimeout(function() {
          applyPageContent(window.CMS_PAGE_DATA);
          // 切英文时自动翻译缺失字段（云端 LLM）
          if (lang === 'en') {
            autoTranslateMissingEn(pageKey, window.CMS_PAGE_DATA);
          }
        }, 50);
      }
    };
  }
  console.log('[CMS] ✅ 已拦截 applyTranslations，setLang 已包装支持语言切换');

  // ── 自动翻译缺失字段（云端 LLM）────────────
  // 切英文时调用，扫描 visa.json 中所有 {zh,en} 字段，en 为空时调 /api/ai-channels/call
  async function autoTranslateMissingEn(pageKey, data) {
    if (!data || typeof data !== 'object') return;
    const missingFields = [];
    function collect(obj, path) {
      if (!obj || typeof obj !== 'object') return;
      if (Array.isArray(obj)) {
        obj.forEach((item, i) => collect(item, `${path}[${i}]`));
        return;
      }
      if ('zh' in obj && 'en' in obj) {
        const zh = obj.zh;
        const en = obj.en;
        if ((zh || typeof zh === 'string') && (!en || en === '')) {
          missingFields.push({ path, zh });
        }
        return;
      }
      // 裸字符串字段：检测中文且不是 URL/电话/邮箱
      Object.entries(obj).forEach(([k, v]) => {
        if (typeof v === 'string' && /[\u4e00-\u9fa5]/.test(v)) {
          if (k === 'src' || k === 'url' || k === 'href' || k === 'qr' || k === 'image' || k === 'icon') return;
          if (path.endsWith('.src') || path.endsWith('.url') || path.endsWith('.href') || path.endsWith('.icon')) return;
          if (/^(https?:|\/|\.\/|\.\.\/)/.test(v) || /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(v)) return;
          if (/^[\d\-\+\s\(\)]+$/.test(v) && v.length < 30) return;
          if (/@/.test(v) && v.length < 50) return;
          missingFields.push({ path: path ? `${path}.${k}` : k, zh: v });
        } else if (typeof v === 'object' && v !== null) {
          collect(v, path ? `${path}.${k}` : k);
        }
      });
    }
    collect(data, '');

    if (missingFields.length === 0) {
      console.log('[CMS Auto-Translate] 没有需要翻译的字段');
      return;
    }
    console.log(`[CMS Auto-Translate] 发现 ${missingFields.length} 个待翻译字段`);

    // toast
    showTranslateToast(`🔄 正在 AI 翻译 ${missingFields.length} 个字段...`);

    try {
      const fieldsToTranslate = missingFields.slice(0, 50);
      const r = await fetch('/api/ai-channels/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: 'You are a professional translator specializing in Simplified Chinese to English translation for business websites. Maintain the original tone, technical terms, and formatting. Output a JSON array with the same order as input, each element has the English translation only (no extra text, no markdown).' },
            { role: 'user', content: 'Translate the following texts to English. Output a JSON array, one translation per element, in the same order:\n\n' + JSON.stringify(fieldsToTranslate.map((f, i) => ({ id: i, zh: f.zh }))) + '\n\nOutput format: [{"id": 0, "en": "..."}, {"id": 1, "en": "..."}, ...]' }
          ],
          temperature: 0.3,
        }),
      });
      const result = await r.json();
      if (!r.ok) {
        console.error('[CMS Auto-Translate] 后端失败', result);
        showTranslateToast('⚠️ 翻译失败：' + (result.error || '未知'), 'error');
        return;
      }
      // 解析 LLM 返回
      let translations = [];
      try {
        const content = (result.content || '').trim();
        const m = content.match(/\[[\s\S]*\]/);
        translations = JSON.parse(m ? m[0] : content);
        if (!Array.isArray(translations)) throw new Error('返回不是数组');
      } catch (e) {
        console.error('[CMS Auto-Translate] 解析失败', e, result.content);
        showTranslateToast('⚠️ 翻译结果解析失败', 'error');
        return;
      }
      const updates = {};
      fieldsToTranslate.forEach((f, i) => {
        const t = translations[i];
        if (t && t.en && t.en.trim()) updates[f.path] = t.en.trim();
      });
      if (Object.keys(updates).length === 0) {
        showTranslateToast('⚠️ 翻译结果为空', 'error');
        return;
      }
      // 落库
      const saveR = await fetch(`/api/content/${pageKey}/translate-bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates }),
      });
      if (saveR.ok) {
        console.log(`[CMS Auto-Translate] ✅ 落库 ${Object.keys(updates).length} 个`);
        showTranslateToast(`✅ 已翻译 ${Object.keys(updates).length} 个字段`);
        setTimeout(() => window.location.reload(), 1500);
      } else {
        const err = await saveR.json();
        showTranslateToast('⚠️ 落库失败：' + (err.error || '未知'), 'error');
      }
    } catch (e) {
      console.error('[CMS Auto-Translate] 异常', e);
      showTranslateToast('⚠️ 异常：' + e.message, 'error');
    }
  }

  function showTranslateToast(message, type) {
    let t = document.getElementById('cms-translate-toast');
    if (t) t.remove();
    t = document.createElement('div');
    t.id = 'cms-translate-toast';
    t.style.cssText = 'position:fixed;top:20px;right:20px;padding:12px 20px;background:rgba(0,0,0,0.9);color:white;border-radius:8px;font-size:14px;z-index:99999;box-shadow:0 4px 12px rgba(0,0,0,0.3);max-width:400px;';
    if (type === 'error') t.style.background = 'rgba(220,38,38,0.95)';
    t.textContent = message;
    document.body.appendChild(t);
    setTimeout(() => { if (t && t.parentNode) t.remove(); }, 4000);
  }

  // ── 工具：从嵌套对象取值 ──────────────────
  function getVal(obj, path) {
    if (!obj) return null;
    const parts = path.split('.');
    let cur = obj;
    for (const p of parts) {
      if (cur == null) return null;
      cur = cur[p];
    }
    return cur;
  }

  // ── 工具：获取当前语言 ─────────────
  function getCurrentLang() {
    return (typeof localStorage !== 'undefined' && localStorage.getItem('zsts-lang')) || 'zh';
  }

  // ── 工具：把取到的值转成字符串（根据当前语言） ─────────
  function toString(val) {
    if (val == null) return null;
    if (typeof val === 'string') return val;
    if (typeof val === 'object') {
      const lang = getCurrentLang();
      // 根据当前语言返回对应字段，优先当前语言，其次 zh，最后 en
      if (lang in val && val[lang]) return val[lang];
      if ('zh' in val && val.zh) return val.zh;
      if ('en' in val && val.en) return val.en;
      // 兜底：返回第一个非空值
      for (const k of Object.keys(val)) { if (val[k]) return val[k]; }
    }
    return null;
  }

  // ── 1. 应用导航 nav.json ─────────────────
  // nav.json: { items: [{ key, label_zh, url }] }
  // HTML: <a data-i18n="nav.home">首页</a>
  async function applyNav() {
    try {
      const res = await fetch('/api/content/nav');
      if (!res.ok) { console.warn('[CMS] nav 加载失败', res.status); return; }
      const data = await res.json();
      console.log('[CMS] nav 数据:', data);

      if (!data.items || !Array.isArray(data.items)) return;

      data.items.forEach(item => {
        const attr = `nav.${item.key}`;
        const els = document.querySelectorAll(`[data-i18n="${attr}"]`);
        console.log(`[CMS] nav "${attr}": ${els.length} 个元素, label_zh="${item.label_zh}", url="${item.url}"`);

        els.forEach(el => {
          // 更新文字
          if (item.label_zh) el.textContent = item.label_zh;
          // 更新链接（仅 <a> 标签）
          if (el.tagName === 'A' && item.url) {
            // 预览模式下，把相对路径改成 /preview/xxx.html
            let newUrl = item.url;
            if (window.CMS_PREVIEW && newUrl && !newUrl.startsWith('/') && !newUrl.startsWith('http') && !newUrl.startsWith('#')) {
              newUrl = '/preview/' + newUrl;
            }
            el.setAttribute('href', newUrl);
            console.log(`[CMS] 更新 ${attr} href → ${newUrl}`);
          }
        });
      });
      console.log('[CMS] ✅ 导航更新完成');
    } catch (e) {
      console.error('[CMS] 导航更新失败:', e);
    }
  }

  // ── 2. 应用页脚 footer.json ─────────────
  // footer.json 结构（扁平）:
  //   { description, phone, email, address, bottom_text, qr_codes:{wechat1, wechat2, whatsapp} }
  // HTML: <span data-i18n="footer.phone">...</span>
  //       <img data-i18n="footer.qrWechat1">
  async function applyFooter() {
    try {
      const res = await fetch('/api/content/footer');
      if (!res.ok) { console.warn('[CMS] footer 加载失败', res.status); return; }
      const data = await res.json();
      console.log('[CMS] footer 数据:', data);

      // 页脚字段映射表：data-i18n 值 → footer.json 中的取值路径
      const FIELD_MAP = {
        'footer.desc':        (d) => toString(d.description),
        'footer.phone':        (d) => d.phone || null,
        'footer.email':        (d) => d.email || null,
        'footer.address':      (d) => toString(d.address),
        'footer.copyright':    (d) => d.bottom_text || null,
        'footer.qrWechat1':   (d) => toString(getVal(d, 'qr_codes.wechat1')) || getVal(d, 'qr_codes.wechat1'),
        'footer.qrWechat2':   (d) => toString(getVal(d, 'qr_codes.wechat2')) || getVal(d, 'qr_codes.wechat2'),
        'footer.qrWhatsapp':  (d) => toString(getVal(d, 'qr_codes.whatsapp')) || getVal(d, 'qr_codes.whatsapp'),
      };

      // 先处理已知字段
      for (const [attr, getter] of Object.entries(FIELD_MAP)) {
        const els = document.querySelectorAll(`[data-i18n="${attr}"]`);
        if (els.length === 0) continue;
        const val = getter(data);
        console.log(`[CMS] footer "${attr}": ${els.length} 个元素, 值="${val}"`);
        if (val == null) continue;
        els.forEach(el => {
          if (el.tagName === 'IMG') {
            const src = (typeof val === 'object' && val.src) ? val.src : String(val);
            el.src = src;
            console.log(`[CMS] 更新 ${attr} img.src → ${src}`);
          } else {
            el.textContent = String(val);
          }
        });
      }

      // 再处理页脚快速导航链接（复用 nav items）
      const navRes = await fetch('/api/content/nav');
      if (navRes.ok) {
        const navData = await navRes.json();
        if (navData.items && Array.isArray(navData.items)) {
          navData.items.forEach(item => {
            const attr = `nav.${item.key}`;
            const els = document.querySelectorAll(`[data-i18n="${attr}"]`);
            els.forEach(el => {
              if (item.label_zh) el.textContent = item.label_zh;
              if (el.tagName === 'A' && item.url) el.setAttribute('href', item.url);
            });
          });
        }
      }

      console.log('[CMS] ✅ 页脚更新完成');
    } catch (e) {
      console.error('[CMS] 页脚更新失败:', e);
    }
  }

  // ── 3. 应用咨询弹窗 consultation.json ───────
  // consultation.json: { title:{zh,en}, desc:{zh,en}, contact_phone, qr_codes:{wechat1, wechat2, whatsapp} }
  // HTML: <h3 data-i18n="modal.title">...</h3>
  //       <img data-i18n="modal.qrWechat1">
  //       <p data-i18n="modal.phone">...</p>
  async function applyConsultation() {
    try {
      const res = await fetch('/api/content/consultation');
      if (!res.ok) { console.warn('[CMS] consultation 加载失败', res.status); return; }
      const data = await res.json();
      console.log('[CMS] consultation 数据:', data);

      // 弹窗字段映射
      const FIELD_MAP = {
        'modal.title':       (d) => toString(d.title),
        'modal.desc':       (d) => toString(d.desc),
        'modal.phone':       (d) => d.contact_phone || null,
        'modal.qrWechat1':  (d) => { const v = getVal(d, 'qr_codes.wechat1'); return (v && typeof v === 'object') ? v.src : v; },
        'modal.qrWechat2':  (d) => { const v = getVal(d, 'qr_codes.wechat2'); return (v && typeof v === 'object') ? v.src : v; },
        'modal.qrWhatsapp': (d) => { const v = getVal(d, 'qr_codes.whatsapp'); return (v && typeof v === 'object') ? v.src : v; },
      };

      for (const [attr, getter] of Object.entries(FIELD_MAP)) {
        const els = document.querySelectorAll(`[data-i18n="${attr}"]`);
        if (els.length === 0) { console.log(`[CMS] modal "${attr}": 未找到元素`); continue; }
        const val = getter(data);
        console.log(`[CMS] modal "${attr}": ${els.length} 个元素, 值="${val}"`);
        if (val == null) continue;
        const str = String(val);
        const isUrl = (v) => typeof v === 'string' && (v.startsWith('/') || v.startsWith('http') || v.includes('.png') || v.includes('.jpg') || v.includes('.jpeg') || v.includes('.gif') || v.includes('.webp') || v.includes('.svg'));
        els.forEach(el => {
          if (el.tagName === 'IMG') {
            if (!isUrl(str)) {
              console.warn(`[CMS] ⚠️ 跳过 ${attr}: 值不是有效图片URL "${str.substring(0,30)}..."`);
              return;
            }
            el.src = str;
            console.log(`[CMS] 更新 ${attr} img.src → ${str}`);
          } else {
            el.textContent = String(val);
          }
        });
      }

      console.log('[CMS] ✅ 咨询弹窗更新完成');
    } catch (e) {
      console.error('[CMS] 咨询弹窗更新失败:', e);
    }
  }

  // ── 4. 应用页面内容（home.json 等）───────────────
  // home.json: { hero:{ title1:{zh,en}, ... }, ... }
  // HTML: <elem data-i18n="hero.title1">...</elem>
  //       <a href="..." data-i18n-href="hero.cta1_url">...</a>
  function applyPageContent(data) {
    let updated = 0, skipped = 0;
    
    // 首先处理所有 data-i18n 属性（文本内容）
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      // 跳过全局字段（nav.XXX, footer.XXX, modal.XXX），这些由专门的函数处理
      // 但 sidebar.qr.* 是图片字段，需要直接更新 img.src，不跳过
      if ((key.startsWith('nav.') || key.startsWith('footer.') || key.startsWith('modal.') || key.startsWith('sidebar.')) && !key.startsWith('sidebar.qr.')) return;

      const val = getVal(data, key);
      const str = toString(val);
      if (!str) { skipped++; return; }

      // 图片字段：只设置看起来像 URL 的值
      const isUrl = (v) => typeof v === 'string' && (v.startsWith('/') || v.startsWith('http') || v.startsWith('./') || v.startsWith('../') || v.includes('.png') || v.includes('.jpg') || v.includes('.jpeg') || v.includes('.gif') || v.includes('.webp') || v.includes('.svg'));
      updated++;
      if (el.tagName === 'IMG') {
        const imgSrc = String(str);
        if (!isUrl(imgSrc)) {
          console.warn(`[CMS] ⚠️ 跳过 ${key}: 值不是有效图片URL "${imgSrc.substring(0,30)}..."`);
          return;
        }
        let newSrc = imgSrc;
        // 确保图片路径是绝对路径
        if (!newSrc.startsWith('/') && !newSrc.startsWith('http')) {
          newSrc = '/' + newSrc;
        }
        if (el.src !== newSrc) {
          el.src = newSrc;
          el.onerror = () => console.warn(`[CMS] ⚠️ 图片加载失败: ${newSrc}`);
          console.log(`[CMS] ✅ [IMG] ${key}: src → ${newSrc}`);
        }
      } else if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        el.value = String(str);
      } else {
        const newText = String(str);
        if (el.textContent !== newText) {
          el.textContent = newText;
          console.log(`[CMS] ✅ [TEXT] ${key}: "${newText.substring(0, 30)}..."`);
        }
      }
    });
    
    // 处理 data-i18n-href 属性（更新链接的 href）
    document.querySelectorAll('[data-i18n-href]').forEach(el => {
      const hrefKey = el.getAttribute('data-i18n-href');
      const urlValue = getVal(data, hrefKey);
      if (!urlValue) return;
      
      const urlStr = typeof urlValue === 'string' ? urlValue : String(urlValue);
      el.setAttribute('href', urlStr);
      console.log(`[CMS] ✅ [HREF] ${hrefKey} → href="${urlStr}"`);
    });
    
    console.log(`[CMS] 页面内容更新: ${updated} 个字段已更新, ${skipped} 个字段跳过(无数据)`);
  }

  async function applyPage() {
    try {
      const res = await fetch(`/api/content/${pageKey}`);
      if (!res.ok) { console.warn('[CMS] 页面内容加载失败', pageKey, res.status); return; }
      const data = await res.json();
      console.log('[CMS] 页面内容', pageKey, ':', JSON.stringify(data).substring(0, 500) + '...');

      // 暴露给业务脚本（如 saudi-visa.html 的 renderMatContent）使用结构化数组
      window.CMS_PAGE_DATA = data;
      // 渲染完成后通知业务脚本重新渲染结构化字段
      if (typeof window.onCmsPageData === 'function') window.onCmsPageData(data);

      applyPageContent(data);
      // 延迟重试：防止其他脚本在 DOMContentLoaded 后覆盖内容
      setTimeout(() => {
        console.log('[CMS] 延迟重试：再次应用页面内容...');
        applyPageContent(data);
        if (typeof window.onCmsPageData === 'function') window.onCmsPageData(data);
      }, 800);
      console.log('[CMS] ✅ 页面内容更新完成');
    } catch (e) {
      console.error('[CMS] 页面内容更新失败:', e);
    }
  }

  // ── 启动 ────────────────────────────────
  async function main() {
    console.log('[CMS Preview] 开始加载内容...');
    await applyNav();
    await applyFooter();
    await applyConsultation();
    await applyPage();
    console.log('[CMS Preview] ✅ 所有内容加载完成');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main);
  } else {
    main();
  }

  // ── 实时预览：监听来自后台编辑器的消息 ──────────
  window.addEventListener('message', function(event) {
    if (event.data && event.data.type === 'cms-live-preview') {
      const data = event.data.content;
      if (data) {
        console.log('[CMS Live] 收到实时预览数据');
        window.CMS_PAGE_DATA = data;
        applyPageContent(data);
        if (typeof window.onCmsPageData === 'function') window.onCmsPageData(data);
        // 通知编辑器：预览已就绪
        if (window.parent && window.parent !== window) {
          window.parent.postMessage({ type: 'cms-preview-ack' }, '*');
        }
      }
    }
  });
})();
