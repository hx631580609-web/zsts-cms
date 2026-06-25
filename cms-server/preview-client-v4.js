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

  // 拦截 applyTranslations / setLang，防止它们覆盖 CMS 注入的内容
  // 在预览模式下，这些函数应该什么都不做
  const _origApply = window.applyTranslations;
  window.applyTranslations = function() {
    console.log('[CMS] ⚠️ applyTranslations() 被调用，已阻止（预览模式）');
  };
  const _origSetLang = window.setLang;
  window.setLang = function() {
    console.log('[CMS] ⚠️ setLang() 被调用，已阻止（预览模式）');
  };
  console.log('[CMS] ✅ 已拦截 applyTranslations/setLang');

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

  // ── 工具：把取到的值转成字符串 ─────────
  function toString(val) {
    if (val == null) return null;
    if (typeof val === 'string') return val;
    if (typeof val === 'object') {
      // 优先返回 zh（即使为空字符串），否则返回 en
      if ('zh' in val) return val.zh || '';
      if ('en' in val) return val.en || '';
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
      // 跳过全局字段（nav.XXX, footer.XXX, modal.XXX, sidebar.XXX），这些由专门的函数处理
      if (key.startsWith('nav.') || key.startsWith('footer.') || key.startsWith('modal.') || key.startsWith('sidebar.')) return;

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
