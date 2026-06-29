import { NextRequest, NextResponse } from 'next/server';

// ══════════════════════════════════════════════════════
//  POST /api/fetch-url — URL 内容抓取与解析
// ══════════════════════════════════════════════════════

interface FetchResult {
  url: string;
  title: string;
  description: string;
  content: string;
  contentType: string;
}

// 从 HTML 中提取正文内容（简化版 readability）
function extractMainContent(html: string): { title: string; description: string; content: string } {
  // 提取 title
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']*)["']/i);
  const title = (ogTitleMatch?.[1] || titleMatch?.[1] || '').trim();

  // 提取 description
  const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i);
  const ogDescMatch = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']*)["']/i);
  const description = (descMatch?.[1] || ogDescMatch?.[1] || '').trim();

  // 移除 script、style、nav、header、footer 等无关内容
  let cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '');

  // 尝试提取 article 或 main 标签内容
  const articleMatch = cleaned.match(/<(?:article|main)[^>]*>([\s\S]*?)<\/(?:article|main)>/i);
  if (articleMatch) {
    cleaned = articleMatch[1];
  }

  // 提取文本内容
  const text = cleaned
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<h[1-6][^>]*>/gi, '\n## ')
    .replace(/<li[^>]*>/gi, '· ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return { title, description, content: text };
}

// ══════════════════════════════════════════════════════
//  JS 渲染网站内容提取（微站/CloudDream 等建站平台）
// ══════════════════════════════════════════════════════

// 解码 JS 文件中的 Unicode 转义序列（\u003c → < 等）
function decodeUnicodeEscapes(str: string): string {
  return str.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

// 从 JS 文件中提取嵌入的 HTML 文本内容
function extractTextFromJs(jsContent: string): string {
  // 解码 Unicode 转义
  let decoded = decodeUnicodeEscapes(jsContent);

  // 移除 script 标签及其内容
  decoded = decoded.replace(/<script[\s\S]*?<\/script>/gi, '');
  // 移除 style 标签及其内容
  decoded = decoded.replace(/<style[\s\S]*?<\/style>/gi, '');
  // 移除 SVG 内容
  decoded = decoded.replace(/<svg[\s\S]*?<\/svg>/gi, '');

  // 提取文本内容
  const text = decoded
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<h[1-6][^>]*>/gi, '\n## ')
    .replace(/<li[^>]*>/gi, '· ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // 过滤掉代码行，只保留有意义的文本
  const codeKeywords = ['function', 'var ', 'const ', 'let ', 'if (', 'return ', 'document.', 'window.', '.css(', '.find(', '.each(', '.on(', '.off(', 'parseInt(', 'typeof ', '$(', '$.', 'jQuery', '.attr(', '.text(', '.html(', '.append(', '.remove(', 'addEventListener', 'querySelector'];
  const lines = text.split('\n').filter(line => {
    const trimmed = line.trim();
    if (trimmed.length < 2) return false;
    // 过滤包含明显代码特征的行
    for (const kw of codeKeywords) {
      if (trimmed.includes(kw)) return false;
    }
    // 过滤纯数字/符号行
    if (/^[\d\s\W]+$/.test(trimmed) && trimmed.length < 5) return false;
    return true;
  });

  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

// 尝试从 JS 渲染页面中提取内容
async function extractFromJsRenderedPage(html: string, baseUrl: string): Promise<string> {
  // 提取 body 中的 script src 链接
  const scriptMatches = html.matchAll(/<script[^>]*src=['"]([^'"]+)['"][^>]*>/gi);
  const scriptUrls: string[] = [];
  for (const match of scriptMatches) {
    const src = match[1];
    // 优先抓取包含 Body/body 的 JS 文件（建站平台通常用这个命名）
    if (src.toLowerCase().includes('body') || src.toLowerCase().includes('content') || src.toLowerCase().includes('page')) {
      const fullUrl = src.startsWith('http') ? src : new URL(src, baseUrl).href;
      scriptUrls.push(fullUrl);
    }
  }

  if (scriptUrls.length === 0) return '';

  const allTexts: string[] = [];
  for (const scriptUrl of scriptUrls.slice(0, 3)) { // 最多抓取 3 个 JS 文件
    try {
      const resp = await fetch(scriptUrl, {
        signal: AbortSignal.timeout(10000),
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; ZSTS-CMS/1.0; +https://zsts.com)',
          'Accept': '*/*',
        },
      });
      if (resp.ok) {
        const jsContent = await resp.text();
        const text = extractTextFromJs(jsContent);
        if (text.length > 30) {
          allTexts.push(text);
        }
      }
    } catch {
      // 忽略单个 JS 文件抓取失败
    }
  }

  return allTexts.join('\n\n');
}

async function fetchUrlContent(url: string): Promise<FetchResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ZSTS-CMS/1.0; +https://zsts.com)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      },
      redirect: 'follow',
    });

    clearTimeout(timeout);

    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
    }

    const contentType = resp.headers.get('content-type') || '';
    const body = await resp.text();

    // HTML 页面：提取正文
    if (contentType.includes('html') || contentType.includes('xhtml')) {
      let { title, description, content } = extractMainContent(body);

      // 如果提取的内容太少，尝试从 JS 渲染页面中提取
      if (content.length < 50) {
        console.log(`[fetch-url] 页面内容较少 (${content.length} 字)，尝试从 JS 文件提取...`);
        const jsContent = await extractFromJsRenderedPage(body, resp.url || url);
        if (jsContent.length > content.length) {
          content = jsContent;
          console.log(`[fetch-url] 从 JS 文件中提取到 ${content.length} 字`);
        }
      }

      return {
        url: resp.url || url,
        title,
        description,
        content: content.substring(0, 20000), // 限制 20K 字符
        contentType: 'html',
      };
    }

    // 纯文本 / JSON / Markdown 等：直接返回
    return {
      url: resp.url || url,
      title: url,
      description: '',
      content: body.substring(0, 20000),
      contentType: contentType.split(';')[0].trim() || 'text',
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: '请提供 URL' }, { status: 400 });
    }

    // 基本 URL 校验
    try {
      new URL(url);
    } catch {
      return NextResponse.json({ error: 'URL 格式不正确' }, { status: 400 });
    }

    // 禁止内网地址（SSRF 防护）
    const hostname = new URL(url).hostname.toLowerCase();
    const blocked = ['localhost', '127.0.0.1', '0.0.0.0', '::1', '10.', '172.16.', '192.168.'];
    for (const b of blocked) {
      if (hostname.startsWith(b) || hostname === b.replace('.', '')) {
        return NextResponse.json({ error: '不允许访问内网地址' }, { status: 400 });
      }
    }

    const result = await fetchUrlContent(url);

    if (!result.content || result.content.trim().length < 10) {
      return NextResponse.json({
        url: result.url,
        title: result.title || url,
        description: result.description,
        content: '',
        contentType: result.contentType,
        warning: '页面内容为空或无法提取有效内容',
      });
    }

    return NextResponse.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '未知错误';
    console.error('[api/fetch-url] Error:', msg);
    return NextResponse.json({ error: 'URL 抓取失败: ' + msg }, { status: 500 });
  }
}
