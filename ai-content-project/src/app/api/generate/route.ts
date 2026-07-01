import { NextRequest, NextResponse } from 'next/server';

// ══════════════════════════════════════════════════════
//  AI 渠道配置（从 Go 后端读取）
// ══════════════════════════════════════════════════════

interface AIChannel {
  id: number;
  name: string;
  api_url: string;
  api_key?: string;
  model_list: string[];
  default_model: string;
  is_default: boolean;
}

const GO_BACKEND_URL = process.env.GO_BACKEND_URL || 'http://localhost:3000';

// 渠道配置缓存（避免每次请求都查后端）
let channelCache: { data: AIChannel[]; ts: number } | null = null;
const CACHE_TTL = 60_000; // 60 秒

async function fetchAIChannels(authToken?: string): Promise<AIChannel[]> {
  const now = Date.now();
  if (channelCache && now - channelCache.ts < CACHE_TTL && channelCache.data.length > 0) {
    return channelCache.data;
  }

  // 优先使用前端传入的用户 token，回退到内部服务 token
  const token = authToken || process.env.CMS_INTERNAL_TOKEN || '';
  const res = await fetch(`${GO_BACKEND_URL}/api/ai-channels`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    next: { revalidate: 30 },
  });

  if (!res.ok) {
    throw new Error(`Go 后端返回 ${res.status}: ${await res.text()}`);
  }

  const channels: AIChannel[] = await res.json();
  if (channels.length === 0) {
    throw new Error('未配置任何 AI 渠道，请先在后台“AI渠道配置”中添加');
  }

  channelCache = { data: channels, ts: now };
  return channels;
}

function pickDefaultChannel(channels: AIChannel[]): AIChannel {
  // 优先返回 is_default=true 的渠道
  const defaultCh = channels.find(c => c.is_default);
  if (defaultCh) return defaultCh;
  // 否则返回第一个
  return channels[0];
}

function getModelForChannel(channel: AIChannel): string {
  // 优先使用渠道配置的 default_model
  if (channel.default_model) return channel.default_model;
  // 回退：取 model_list 第一个
  if (channel.model_list && channel.model_list.length > 0) return channel.model_list[0];
  return 'gpt-4o-mini';
}

// ══════════════════════════════════════════════════════
//  内容安全防护（双层：关键词 + 正则模式）
// ══════════════════════════════════════════════════════

const BLOCKED_KEYWORDS = [
  // 赌博
  '赌博', '博彩', '赌场', '六合彩', '时时彩', '网赌', '外围', '下注',
  // 色情
  '色情', '成人内容', '约炮', '裸聊', '援交', '色情直播',
  // 毒品
  '毒品', '冰毒', '海洛因', '大麻', '摇头丸', 'K粉',
  // 暴力/武器
  '枪支', '军火', '炸药', '暗杀', '炸弹制作',
  // 经济犯罪
  '洗钱', '诈骗', '传销', '非法集资', '庞氏骗局',
  // 政治敏感
  '颠覆政权', '分裂国家', '宗教极端', '恐怖主义', '圣战',
  // 其他违法
  '代孕', '卖卵', '器官买卖',
  '翻墙工具', 'VPN破解',
  '黄赌毒', '制毒',
  // 个人信息泄露引导
  '身份证号码生成', '信用卡套现', '假证',
];

// 正则模式匹配（更灵活的敏感内容识别）
const BLOCKED_PATTERNS: RegExp[] = [
  /(?:开房|约炮|一夜情|找小姐)/i,
  /(?:炸弹|炸药)\s*(?:制作|配方|教程)/i,
  /(?:冰毒|海洛因|大麻)\s*(?:购买|出售|交易)/i,
  /(?:枪[支械]|手枪|步枪)\s*(?:购买|出售|交易|制作)/i,
];

function moderateContent(text: string): { safe: boolean; reason?: string } {
  if (!text) return { safe: true };
  const lower = text.toLowerCase();

  // 关键词检查
  for (const kw of BLOCKED_KEYWORDS) {
    if (lower.includes(kw)) {
      return { safe: false, reason: `内容包含敏感词"${kw}"，已自动拦截` };
    }
  }

  // 正则模式检查
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(text)) {
      return { safe: false, reason: '内容包含敏感信息，已自动拦截' };
    }
  }

  return { safe: true };
}

// ══════════════════════════════════════════════════════
//  系统提示词（约束 AI 回复范围 + 安全防护）
// ══════════════════════════════════════════════════════

const SYSTEM_PROMPT = `你是“ZSTS签证通”AI助手，一个专业的中东商务与旅行内容创作专家。

## 你的核心能力
- 创作沙特阿拉伯及中东地区的商务签证攻略、旅行指南
- 撰写商旅资讯、政策解读、市场分析文章
- 优化和改写与商务出行相关的内容
- 根据素材整理结构化文章

## 文章输出格式（极其重要，必须严格遵守）
你的输出将直接进入文章编辑器，编辑器会将内容解析为结构化模块。请严格按照以下格式输出：

1. 第一行必须是文章标题（简短有力，20字以内）
2. 第二行是摘要（一句话概括，30-80字）
3. 正文部分使用以下结构：
   - 章节标题：使用中文数字编号，如“一、申请条件”“二、所需材料”“三、办理流程”
   - 段落：标题下的说明文字
   - 列表：使用数字编号（1. 2. 3.）或项目符号（·）列出要点
   - 提示：重要注意事项用 ⚠️ 开头
   - 小贴士：实用建议用 💡 开头
4. 不要使用 markdown 格式（如 # ** 等），直接用纯文本
5. 不要输出“标题：”“正文：”等前缀标签，直接输出内容

## 输出示例
2026年沙特商务签证最新办理指南
全面解读沙特商务签证申请条件、材料清单与办理流程，帮助商务人士高效完成签证。

沙特阿拉伯作为中东地区最大经济体，2026年签证政策有重要调整...

一、申请条件
沙特商务签证面向前往沙特进行商务活动的外国公民。

基本条件：
1. 护照有效期不少于6个月
2. 有沙特公司出具的邀请函
3. 无以色列入境记录

二、所需材料
根据最新政策，需准备以下材料：
· 有效护照原件及复印件
· 签证申请表（在线填写）
· 近期2寸白底照片2张

⚠️ 所有中文材料需附英文翻译件，邀请函需经沙特商会认证。

三、办理流程
整个办理周期约7-15个工作日。

💡 建议提前一个月准备，预留充足时间。

## 内容安全规则
- 仅回答与沙特/中东商务、旅行、签证、文化礼仪、商业资讯相关的问题
- 不得生成政治敏感、色情、暴力、赌博、毒品等违法内容
- 不得生成虚假政策信息
- 涉及费用、时效标注“仅供参考”
- 回复内容应该是可直接使用的成品，而非建议或大纲`;

// ── 海报模式专用系统提示词（要求 AI 返回 JSON 结构） ──

const POSTER_SYSTEM_PROMPT = `你是“ZSTS签证通”AI助手，专注于生成适合海报/图文卡片展示的结构化内容。

## 你的任务
根据用户的输入，生成适合海报展示的结构化内容。海报由一个封面和多个内页组成，封面用于吸引眼球，内页用于展示核心信息。每页都需要配图。

## 内容安全规则（必须严格遵守，不可绕过）
- 仅生成与沙特/中东商务、旅行、签证、文化礼仪、商业资讯相关的内容
- 不得生成政治敏感、色情、暴力、赌博、毒品、武器等违法内容
- 不得生成虚假政策信息
- 涉及费用、时效标注“仅供参考”

## 输出格式（极其重要，必须严格遵守）
你必须返回一个 JSON 对象，不要返回任何其他文字。JSON 结构如下：
{
  "title": "海报主标题（简洁有力，10-15字，如：沙特商务签证办理指南）",
  "summary": "一句话摘要（20-30字，将作为封面顶部标语）",
  "tags": ["标签1", "标签2", "标签3"],
  "slogan": "底部标语/口号（15字以内，如：专业签证服务·让商旅更简单）",
  "pages": [
    {
      "title": "本页标题（简短，8字以内）",
      "image_desc": "本页配图描述（用于搜索配图，如：沙特利雅得城市天际线日落全景）",
      "sections": [
        {
          "heading": "小节标题（6字以内）",
          "items": ["要点1（30字以内）", "要点2", "要点3"]
        }
      ]
    }
  ]
}

## 海报内容规则
- pages 数组中应有足够多的页面（根据用户要求的页数，通常 3-6 页）
- 每页必须包含 image_desc 字段，描述该页应配的图片内容（中文描述，10-30字）
- 每页的 sections 包含 1-3 个小节，每个小节 items 控制在 3-6 条
- 每条 item 不超过 30 字，内容要精炼，适合视觉展示
- 第一页通常是概述/简介，最后一页是总结/注意事项
- 主题围绕沙特商务签证、中东商旅、出行指南等
- 只返回 JSON，不要有 markdown 代码块标记，不要有额外说明文字`;

const SAFETY_FALLBACK = `抱歉，您的输入包含不适当的内容，无法为您生成。请调整输入内容后重试。

我是"ZSTS签证通"AI助手，专注于沙特及中东地区的商务旅行内容创作。您可以让我帮您：
- 写签证攻略、旅行指南文章
- 分析商旅政策和市场动态
- 优化和改写已有的内容`;

// ══════════════════════════════════════════════════════
//  调用 OpenAI 兼容 API
// ══════════════════════════════════════════════════════

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

async function callOpenAICompatible(
  apiUrl: string,
  apiKey: string,
  model: string,
  messages: ChatMessage[],
): Promise<string> {
  // 规范化 API URL：如果用户填的是 base URL，补全路径
  let endpoint = apiUrl.trim();
  if (!endpoint.includes('/chat/completions')) {
    endpoint = endpoint.replace(/\/+$/, '') + '/v1/chat/completions';
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  const requestBody = {
    model,
    messages,
    temperature: 0.7,
    max_tokens: 4096,
    stream: true,
  };

  console.log(`[api/generate] 请求 AI: endpoint=${endpoint}, model=${model}`);

  const res = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(requestBody),
    signal: AbortSignal.timeout(120_000), // 120s 超时（流式可能更慢）
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '未知错误');
    throw new Error(`AI 服务返回 ${res.status}: ${errText}`);
  }

  // 流式读取 SSE 响应
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('text/event-stream') && res.body) {
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let fullContent = '';
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // 按行解析 SSE 事件
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // 保留未完成的行

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') continue;
        try {
          const parsed = JSON.parse(data);
          const delta = parsed?.choices?.[0]?.delta?.content;
          if (delta) fullContent += delta;
        } catch {
          // 忽略解析失败的行
        }
      }
    }

    if (!fullContent) {
      throw new Error('AI 流式响应未返回有效内容');
    }
    return fullContent;
  }

  // 回退：非流式响应（JSON）
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('AI 未返回有效内容');
  }
  return content;
}

// ══════════════════════════════════════════════════════
//  解析海报 JSON 结构化数据
// ══════════════════════════════════════════════════════

interface PosterPage {
  title: string;
  image_desc: string;
  sections: Array<{ heading: string; items: string[] }>;
}

interface ParsedPoster {
  title: string;
  summary: string;
  tags: string[];
  slogan: string;
  pages: PosterPage[];
}

function parsePosterPages(raw: string, expectedPageCount: number): ParsedPoster | null {
  // 尝试从 AI 返回中提取 JSON
  let jsonStr = raw.trim();

  // 去除 markdown 代码块包裹
  const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    jsonStr = codeBlockMatch[1].trim();
  }

  // 尝试找到第一个 { 和最后一个 } 之间的内容
  const firstBrace = jsonStr.indexOf('{');
  const lastBrace = jsonStr.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);
  }

  try {
    const parsed = JSON.parse(jsonStr);

    // 验证基本结构
    const title = typeof parsed.title === 'string' ? parsed.title : '';
    const summary = typeof parsed.summary === 'string' ? parsed.summary : '';
    const tags = Array.isArray(parsed.tags) ? parsed.tags.filter((t: unknown) => typeof t === 'string') : [];
    const slogan = typeof parsed.slogan === 'string' ? parsed.slogan : '';

    if (!Array.isArray(parsed.pages) || parsed.pages.length === 0) {
      return null;
    }

    const pages: PosterPage[] = parsed.pages
      .filter((p: unknown) => p && typeof p === 'object' && typeof (p as Record<string, unknown>).title === 'string')
      .map((p: Record<string, unknown>) => ({
        title: String(p.title),
        image_desc: typeof p.image_desc === 'string' ? String(p.image_desc) : '',
        sections: Array.isArray(p.sections)
          ? p.sections
              .filter((s: unknown) => s && typeof s === 'object')
              .map((s: Record<string, unknown>) => ({
                heading: typeof s.heading === 'string' ? s.heading : '',
                items: Array.isArray(s.items) ? s.items.filter((i: unknown) => typeof i === 'string').map(String) : [],
              }))
          : [],
      }));

    if (pages.length === 0) return null;

    return { title, summary, tags, slogan, pages };
  } catch {
    // JSON 解析失败，尝试从纯文本构建默认页面
    console.warn('[parsePosterPages] JSON 解析失败，使用默认结构');
    return buildFallbackPages(raw, expectedPageCount);
  }
}

// AI 未返回有效 JSON 时，从纯文本构建海报页面
function buildFallbackPages(rawText: string, pageCount: number): ParsedPoster | null {
  // 从纯文本中提取标题和内容
  const lines = rawText.split('\n').filter(l => l.trim());
  const title = lines[0]?.replace(/^#+\s*/, '').replace(/^[\u{1F300}-\u{1FAD6}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u, '').trim().substring(0, 30) || '海报内容';

  // 将内容按段落分组为 sections
  const sections: Array<{ heading: string; items: string[] }> = [];
  let currentHeading = '';
  let currentItems: string[] = [];

  for (const line of lines.slice(1)) {
    const cleanLine = line.trim();
    // 检测标题行（# 开头、以数字+点开头、或以emoji+文字开头）
    if (/^#+\s/.test(cleanLine) || /^\d+[.、]\s/.test(cleanLine) || /^[\u{1F300}-\u{1FAD6}\u{2600}-\u{26FF}]/u.test(cleanLine)) {
      if (currentItems.length > 0) {
        sections.push({ heading: currentHeading || '内容', items: currentItems });
        currentItems = [];
      }
      currentHeading = cleanLine.replace(/^#+\s*/, '').replace(/^\d+[.、]\s*/, '').substring(0, 20);
    } else if (cleanLine.length > 0 && cleanLine.length < 80) {
      currentItems.push(cleanLine.replace(/^[·•\-]\s*/, '').substring(0, 50));
    }
  }
  if (currentItems.length > 0) {
    sections.push({ heading: currentHeading || '内容', items: currentItems });
  }

  if (sections.length === 0) return null;

  // 将 sections 均匀分配到 pages
  const fallbackImages = ['沙特利雅得城市天际线', '沙特沙漠骆驼商队', '沙特麦加禁寺全景', '沙特商务会议中心', '沙特传统市场', '中东沙漠日落'];
  const pages: PosterPage[] = [];
  const perPage = Math.max(1, Math.ceil(sections.length / pageCount));
  for (let i = 0; i < pageCount && i * perPage < sections.length; i++) {
    const pageSections = sections.slice(i * perPage, (i + 1) * perPage);
    pages.push({
      title: pageSections[0]?.heading || `第${i + 1}页`,
      image_desc: fallbackImages[i % fallbackImages.length] || '沙特风景',
      sections: pageSections,
    });
  }

  return { title, summary: '', tags: ['AI生成'], slogan: '', pages };
}

// ══════════════════════════════════════════════════════
//  POST /api/generate
// ══════════════════════════════════════════════════════

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const { message, contentType, token } = payload;
    // 可选的附件上下文和 URL 内容
    const attachments: Array<{ filename: string; content: string; type: string }> = payload.attachments || [];
    const urlContent: string = payload.urlContent || '';

    // ── 输入校验 ──
    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: '请输入内容' }, { status: 400 });
    }
    if (message.trim().length < 2) {
      return NextResponse.json({ error: '内容太短，请输入至少2个字符' }, { status: 400 });
    }
    if (message.trim().length > 5000) {
      return NextResponse.json({ error: '输入内容过长，请控制在5000字以内' }, { status: 400 });
    }

    // ── 输入内容安全审核 ──
    const inputCheck = moderateContent(message);
    if (!inputCheck.safe) {
      console.warn(`[api/generate] 输入安全拦截: ${inputCheck.reason}`);
      return NextResponse.json({
        error: inputCheck.reason,
        content: SAFETY_FALLBACK,
      }, { status: 400 });
    }

    // ── 从 Go 后端读取 AI 渠道配置 ──
    let channels: AIChannel[];
    try {
      channels = await fetchAIChannels(token);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '读取渠道失败';
      console.error(`[api/generate] 读取AI渠道失败: ${msg}`);
      return NextResponse.json({
        error: `无法获取 AI 渠道配置: ${msg}`,
      }, { status: 503 });
    }

    // ── 选取默认渠道和模型 ──
    const channel = pickDefaultChannel(channels);
    const model = getModelForChannel(channel);
    console.log(`[api/generate] 使用渠道: ${channel.name} (id=${channel.id}), 模型: ${model}`);

    // ── 判断是否为海报模式 ──
    const isPoster = contentType === 'poster';
    const pageCount: number = Math.max(1, Math.min(15, payload.pageCount || 6));

    // ── 构建消息 ──
    const systemPrompt = isPoster ? POSTER_SYSTEM_PROMPT : SYSTEM_PROMPT;

    // 拼接附件/URL 上下文到用户消息
    let contextPrefix = '';
    if (urlContent) {
      contextPrefix += `\n\n📎 以下是从 URL 中读取到的内容，请基于这些内容进行创作：\n---\n${urlContent.substring(0, 8000)}\n---\n`;
    }
    for (const att of attachments) {
      const label = att.type === 'image' ? '🖼️ 图片' : '📄 文件';
      contextPrefix += `\n\n${label}「${att.filename}」的内容：\n---\n${att.content.substring(0, 5000)}\n---\n`;
    }

    const userMsg = isPoster
      ? `${contextPrefix}${message}\n\n请生成 ${pageCount} 页海报内容。`
      : `${contextPrefix}${message}`;

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMsg },
    ];

    // ── 调用 AI 服务 ──
    let aiContent: string;
    try {
      aiContent = await callOpenAICompatible(
        channel.api_url,
        channel.api_key || '',
        model,
        messages,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : '调用失败';
      console.error(`[api/generate] AI调用失败 [${channel.name}]: ${msg}`);
      return NextResponse.json({ error: `AI 服务调用失败: ${msg}` }, { status: 502 });
    }

    // ── 输出内容安全审核 ──
    const outputCheck = moderateContent(aiContent);
    if (!outputCheck.safe) {
      console.warn(`[api/generate] 输出安全拦截: ${outputCheck.reason}`);
      return NextResponse.json({
        error: '生成的内容包含敏感信息，已自动拦截。请调整您的提示词后重试。',
        content: `很抱歉，AI 生成的内容触发了安全策略（${outputCheck.reason}），已被自动拦截。\n\n请尝试调整您的提问方式，避免涉及敏感话题。如需帮助，请联系管理员。`,
      }, { status: 400 });
    }

    // ── 输出长度限制（防止异常超长内容） ──
    if (aiContent.length > 20000) {
      aiContent = aiContent.substring(0, 20000) + '\n\n[内容因长度限制被截断]';
    }

    // ── 海报模式：解析 JSON 结构化数据 ──
    let pages: Array<{ title: string; sections: Array<{ heading: string; items: string[] }> }> | null = null;
    let posterTitle = '';
    let posterSummary = '';
    let posterTags: string[] = [];
    let posterSlogan = '';

    if (isPoster) {
      const parsed = parsePosterPages(aiContent, pageCount);
      if (parsed) {
        pages = parsed.pages;
        posterTitle = parsed.title || '';
        posterSummary = parsed.summary || '';
        posterTags = parsed.tags || [];
        posterSlogan = parsed.slogan || '';
      }
    }

    // ── 文章模式：清洗 Markdown 格式（AI 可能不遵循纯文本指令） ──
    if (!isPoster) {
      // 去除行首的 # 标记（保留标题文字）
      aiContent = aiContent.replace(/^#{1,6}\s+/gm, '');
      // 去除 **粗体** 和 *斜体* 标记（保留中间文字）
      aiContent = aiContent.replace(/\*\*(.*?)\*\*/g, '$1');
      aiContent = aiContent.replace(/\*(.*?)\*/g, '$1');
      // 去除行内代码 `` 和代码块 ```
      aiContent = aiContent.replace(/`{1,3}[^`]*`{1,3}/g, '');
      // 去除行首的 - 或 * 无序列表标记，替换为中文项目符号
      aiContent = aiContent.replace(/^[-*]\s+/gm, '· ');
    }

    return NextResponse.json({
      content: aiContent,
      message,
      contentType: contentType || 'article',
      channel: channel.name,
      model,
      // 海报模式额外字段
      pages: pages || undefined,
      posterTitle: posterTitle || undefined,
      posterSummary: posterSummary || undefined,
      posterTags: posterTags.length > 0 ? posterTags : undefined,
      posterSlogan: posterSlogan || undefined,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    console.error('[api/generate] Error:', errorMessage);
    return NextResponse.json({ error: '生成内容失败: ' + errorMessage }, { status: 500 });
  }
}
