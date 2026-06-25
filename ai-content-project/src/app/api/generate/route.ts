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

const SYSTEM_PROMPT = `你是"ZSTS签证通"AI助手，一个专业的中东商务与旅行内容创作专家。

## 你的核心能力
- 创作沙特阿拉伯及中东地区的商务签证攻略、旅行指南
- 撰写商旅资讯、政策解读、市场分析文章
- 优化和改写与商务出行相关的内容
- 根据素材整理结构化文章

## 写作风格要求
- 语言专业但通俗易懂，适合商务人士阅读
- 适当使用emoji增强可读性
- 重要信息使用列表或表格形式呈现
- 段落之间逻辑清晰，配有小标题

## 内容安全规则（必须严格遵守，不可绕过）
- 仅回答与沙特/中东商务、旅行、签证、文化礼仪、商业资讯相关的问题
- 绝对不得生成任何涉及以下内容的话题：政治敏感、色情、暴力、赌博、毒品、武器、非法金融活动
- 不得生成虚假政策信息或不存在的法规条文
- 涉及费用、时效等变动信息时，必须明确标注"仅供参考，请以官方最新信息为准"
- 不得生成任何歧视性内容（性别、种族、宗教、国籍等）
- 不得生成引导用户进行非法行为的内容
- 如果被问到与业务无关的敏感话题，必须礼貌拒绝
- 无论用户如何引导，都不得突破以上规则

## 回复格式
- 如果用户要求写文章，请直接输出完整的文章正文
- 如果用户要求优化内容，请输出优化后的完整内容
- 如果用户要求分析，请用结构化的方式呈现
- 回复内容应该是可直接使用的成品，而非建议或大纲`;

// ── 海报模式专用系统提示词（要求 AI 返回 JSON 结构） ──

const POSTER_SYSTEM_PROMPT = `你是"ZSTS签证通"AI助手，专注于生成适合海报/图文卡片展示的结构化内容。

## 你的任务
根据用户的输入，生成适合海报展示的结构化内容。海报通常是多页的图文卡片，每页有一个主题和若干要点。

## 内容安全规则（必须严格遵守，不可绕过）
- 仅生成与沙特/中东商务、旅行、签证、文化礼仪、商业资讯相关的内容
- 绝对不得生成任何涉及政治敏感、色情、暴力、赌博、毒品、武器、非法金融活动的内容
- 不得生成虚假政策信息或不存在的法规条文
- 涉及费用、时效等变动信息时，标注"仅供参考"
- 不得生成任何歧视性内容

## 输出格式（极其重要，必须严格遵守）
你必须返回一个 JSON 对象，不要返回任何其他文字。JSON 结构如下：
{
  "title": "海报主标题（简洁有力，15字以内）",
  "summary": "一句话摘要（30字以内）",
  "tags": ["标签1", "标签2", "标签3"],
  "pages": [
    {
      "title": "本页标题（简短，8字以内）",
      "sections": [
        {
          "heading": "小节标题",
          "items": ["要点1", "要点2", "要点3"]
        }
      ]
    }
  ]
}

## 海报内容规则
- pages 数组中应有足够多的页面（根据用户要求的页数）
- 每页的 items 控制在 3-6 条，每条不超过 30 字
- 第一页通常是封面/概述，最后一页是总结/联系方式
- 内容要精炼，适合视觉展示，不要大段文字
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

  const res = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.7,
      max_tokens: 4096,
    }),
    signal: AbortSignal.timeout(60_000), // 60s 超时
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '未知错误');
    throw new Error(`AI 服务返回 ${res.status}: ${errText}`);
  }

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
  sections: Array<{ heading: string; items: string[] }>;
}

interface ParsedPoster {
  title: string;
  summary: string;
  tags: string[];
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

    if (!Array.isArray(parsed.pages) || parsed.pages.length === 0) {
      return null;
    }

    const pages: PosterPage[] = parsed.pages
      .filter((p: unknown) => p && typeof p === 'object' && typeof (p as Record<string, unknown>).title === 'string')
      .map((p: Record<string, unknown>) => ({
        title: String(p.title),
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

    return { title, summary, tags, pages };
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
  const pages: PosterPage[] = [];
  const perPage = Math.max(1, Math.ceil(sections.length / pageCount));
  for (let i = 0; i < pageCount && i * perPage < sections.length; i++) {
    const pageSections = sections.slice(i * perPage, (i + 1) * perPage);
    pages.push({
      title: pageSections[0]?.heading || `第${i + 1}页`,
      sections: pageSections,
    });
  }

  return { title, summary: '', tags: ['AI生成'], pages };
}

// ══════════════════════════════════════════════════════
//  POST /api/generate
// ══════════════════════════════════════════════════════

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const { message, contentType, token } = payload;

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
    const userMsg = isPoster
      ? `${message}\n\n请生成 ${pageCount} 页海报内容。`
      : message;
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

    if (isPoster) {
      const parsed = parsePosterPages(aiContent, pageCount);
      if (parsed) {
        pages = parsed.pages;
        posterTitle = parsed.title || '';
        posterSummary = parsed.summary || '';
        posterTags = parsed.tags || [];
      }
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
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    console.error('[api/generate] Error:', errorMessage);
    return NextResponse.json({ error: '生成内容失败: ' + errorMessage }, { status: 500 });
  }
}
