'use client';

import { useState, useRef, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Send,
  Sparkles,
  Link2,
  FileUp,
  ClipboardPaste,
  Wand2,
  Loader2,
  Copy,
  Check,
  Paperclip,
  FileText,
  ImageIcon,
  X,
  Globe,
  Upload,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

type ContentType = 'article' | 'poster';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  type?: 'text' | 'result';
  contentType?: ContentType;
  resultData?: {
    title: string;
    summary: string;
    tags: string[];
    source: string;
    wordCount: number;
    pageCount?: number;
    ratio?: '9:16' | '16:9';
    slogan?: string;
    pages?: Array<{ title: string; sections: Array<{ heading: string; items: string[] }> }>;
  };
}

const QUICK_PROMPTS = [
  { icon: <Link2 className="size-3.5" />, label: '读取链接内容', prompt: '帮我读取这篇文章的内容并优化成专业攻略风格：https://mp.weixin.qq.com/s/example' },
  { icon: <FileUp className="size-3.5" />, label: '识别文件内容', prompt: '我上传了一份文件图片，请识别内容并整理成结构化清单' },
  { icon: <Wand2 className="size-3.5" />, label: 'AI 生成文章', prompt: '请帮我写一篇关于“2026年沙特商务签证最新办理指南”的攻略文章，1500字左右' },
  { icon: <ClipboardPaste className="size-3.5" />, label: '优化粘贴内容', prompt: '我粘贴了一段内容，请帮我改成更口语化、适合社交媒体发布的风格' },
];

function generateId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function CreateContentInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [contentType, setContentType] = useState<ContentType>('article');
  const [posterPageCount, setPosterPageCount] = useState(6);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 文件上传 & URL 抓取状态
  interface UploadedFile { filename: string; content: string; type: string; preview?: string; }
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [urlContent, setUrlContent] = useState('');
  const [urlFetching, setUrlFetching] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [detectedUrl, setDetectedUrl] = useState<string | null>(null);

  useEffect(() => {
    const tab = searchParams.get('tab');
    const prompts: Record<string, string> = {
      url: '帮我读取这篇文章的内容并优化：https://mp.weixin.qq.com/s/example',
      file: '我上传了一份文件图片，请识别并整理成清单格式',
      ai: '请帮我写一篇关于“2026年沙特商务签证最新办理指南”的攻略文章',
      paste: '我有一段内容需要优化，请帮我改成口语化风格',
    };
    if (tab && prompts[tab]) {
      setInput(prompts[tab]);
    }
  }, [searchParams]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 检测输入中的 URL
  useEffect(() => {
    const urlMatch = input.match(/https?:\/\/[^\s<>"']+/i);
    if (urlMatch && !urlContent) {
      setDetectedUrl(urlMatch[0]);
    } else if (!urlMatch) {
      setDetectedUrl(null);
    }
  }, [input, urlContent]);

  // 文件上传处理
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const token = new URLSearchParams(window.location.search).get('token') || localStorage.getItem('cms_token') || '';
      const res = await fetch('/ai-content/api/upload', {
        method: 'POST',
        body: formData,
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '上传失败');
      setUploadedFiles(prev => [...prev, {
        filename: data.filename,
        content: data.content,
        type: data.type,
        preview: data.preview,
      }]);
    } catch (err) {
      console.error('[fileUpload]', err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // URL 内容抓取
  const handleFetchUrl = async (url: string) => {
    setUrlFetching(true);
    try {
      const res = await fetch('/ai-content/api/fetch-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '抓取失败');
      setUrlContent(data.content || '');
      setDetectedUrl(null);
    } catch (err) {
      console.error('[fetchUrl]', err);
    } finally {
      setUrlFetching(false);
    }
  };

  const generatePosterPages = (
    source: string,
    pageCount: number,
  ): Array<{ title: string; sections: Array<{ heading: string; items: string[] }> }> => {
    let allSections: Array<{ heading: string; items: string[] }> = [];

    if (source === '链接读取') {
      allSections = [
        { heading: '申请条件', items: ['护照有效期不少于6个月', '有沙特公司出具的邀请函', '无以色列入境记录'] },
        { heading: '所需材料', items: ['有效护照原件及复印件', '签证申请表（在线填写）', '近期2寸白底照片2张', '沙特邀请方营业执照复印件', '中方公司派遣信', '往返机票预订单'] },
        { heading: '办理流程', items: ['准备材料 → 在线申请 → 递交使馆 → 等待审批 → 领取签证'] },
        { heading: '办理周期', items: ['普通办理：7-15个工作日', '加急办理：3-5个工作日'] },
        { heading: '注意事项', items: ['所有中文材料需附英文翻译件', '邀请函需经沙特商会认证', '建议提前1个月准备'] },
      ];
    } else if (source === '文件识别') {
      allSections = [
        { heading: '必备材料', items: ['有效护照（有效期≥6个月）', '邀请函（沙特方公司出具）', '营业执照（复印件，需公证）', '银行流水（最近6个月，余额≥5万）', '证件照（2寸白底，2张）'] },
        { heading: '补充材料', items: ['往返机票预订单', '酒店预订确认函', '商务行程安排表', '中方公司派遣信'] },
        { heading: '注意事项', items: ['所有中文材料需附英文翻译件', '邀请函需经沙特商会认证', '建议提前1个月准备材料'] },
      ];
    } else if (source === 'AI生成') {
      allSections = [
        { heading: '申请条件', items: ['护照有效期不少于6个月', '有沙特公司出具的邀请函', '无以色列入境记录'] },
        { heading: '所需材料', items: ['有效护照原件及复印件', '签证申请表（在线填写）', '近期2寸白底照片2张', '沙特邀请方营业执照复印件', '中方公司派遣信', '往返机票预订单'] },
        { heading: '办理流程', items: ['准备材料 → 在线申请 → 递交使馆 → 等待审批 → 领取签证'] },
        { heading: '费用参考', items: ['单次入境：¥1,200（有效期3个月，停留30天）', '多次入境：¥2,500（有效期6个月，停留90天）', '落地签：¥800（即时生效，停留30天）'] },
        { heading: '办理周期', items: ['普通办理：7-15个工作日', '加急办理：3-5个工作日'] },
        { heading: '注意事项', items: ['所有中文材料需附英文翻译件', '邀请函需经沙特商会认证', '女性申请人需额外提供担保信'] },
      ];
    } else {
      allSections = [
        { heading: '申请条件', items: ['持有效护照（有效期6个月以上）', '有沙特公司邀请函'] },
        { heading: '准备材料', items: ['护照（有效期6个月以上）', '沙特公司的邀请函', '2寸白底照片2张', '中方公司的派遣信', '往返机票订单'] },
        { heading: '办理时间', items: ['一般7-15个工作日出签', '建议提前一个月准备'] },
        { heading: '小贴士', items: ['所有中文材料需附英文翻译件', '邀请函需经沙特商会认证', '女性申请者需额外提供担保信'] },
      ];
    }

    const numInner = Math.max(1, pageCount - 1);
    const pages: Array<{ title: string; sections: Array<{ heading: string; items: string[] }> }> = [];

    if (numInner >= allSections.length) {
      for (let i = 0; i < numInner; i++) {
        if (i < allSections.length) {
          pages.push({ title: allSections[i].heading, sections: [allSections[i]] });
        } else {
          pages.push({ title: '补充信息', sections: [{ heading: '补充信息', items: ['更多签证详情请咨询客服'] }] });
        }
      }
    } else {
      // 均匀分配：每页尽量接近 base 个 section，前 extra 页多 1 个
      const base = Math.floor(allSections.length / numInner);
      const extra = allSections.length % numInner;
      let idx = 0;
      for (let i = 0; i < numInner; i++) {
        const count = base + (i < extra ? 1 : 0);
        const slice = allSections.slice(idx, idx + count);
        idx += count;
        const mergedTitle = slice.map((s) => s.heading).join(' & ');
        pages.push({ title: mergedTitle || '补充信息', sections: slice.length > 0 ? slice : [{ heading: '补充信息', items: ['暂无更多内容'] }] });
      }
    }

    return pages;
  };

  const simulateAiResponse = (userMessage: string, type: ContentType, pageCount: number): ChatMessage => {
    const lower = userMessage.toLowerCase();
    let title = '';
    let summary = '';
    let tags: string[] = [];
    let source = 'AI生成';
    let content = '';

    if (lower.includes('http') || lower.includes('链接') || lower.includes('读取')) {
      source = '链接读取';
      title = '2026年沙特商务签证最新办理指南';
      summary = '全面介绍沙特商务签证的申请条件、所需材料、办理流程及注意事项，帮助商务人士高效完成签证申请。';
      tags = ['沙特', '商务签证', '2026', '办理指南'];
      content = `已完成链接解析与内容优化，以下是优化后的内容：

标题：${title}

正文：

沙特阿拉伯作为中东地区最大的经济体，近年来不断优化商务签证政策，以吸引更多国际商务人士。2026年最新政策在申请流程、所需材料和审批时效等方面均有重要调整。

一、申请条件

沙特商务签证面向前往沙特进行商务活动的外国公民，包括商务考察、会议参展、合同签署等短期活动。

基本条件：
· 护照有效期不少于6个月
· 有沙特公司出具的邀请函
· 无以色列入境记录

二、所需材料

1. 有效护照原件及复印件
2. 签证申请表（在线填写）
3. 近期2寸白底照片2张
4. 沙特邀请方营业执照复印件
5. 中方公司派遣信
6. 往返机票预订单

三、办理流程

整个办理周期约7-15个工作日，建议提前一个月准备。

内容已根据提示词优化，去除了原文冗余段落，增加了小标题和结构化排版。`;
    } else if (lower.includes('上传') || lower.includes('识别') || lower.includes('文件') || lower.includes('图片') || lower.includes('ocr')) {
      source = '文件识别';
      title = '沙特商务签证申请材料清单（整理版）';
      summary = '基于上传文件识别整理的沙特商务签证申请所需材料清单，包含材料说明和注意事项。';
      tags = ['沙特', '签证材料', '清单', '2026'];
      content = `已完成文件识别与内容整理，结果如下：

标题：${title}

整理后内容：

📋 沙特商务签证申请材料清单

一、必备材料

1. 有效护照 —— 有效期≥6个月 —— 原件+复印件
2. 邀请函 —— 沙特方公司出具 —— 需盖章
3. 营业执照 —— 复印件 —— 需公证
4. 银行流水 —— 最近6个月 —— 余额≥5万
5. 证件照 —— 2寸白底 —— 2张

二、补充材料（按需提供）

· 往返机票预订单
· 酒店预订确认函
· 商务行程安排表
· 中方公司派遣信

三、注意事项

⚠ 所有中文材料需附英文翻译件
⚠ 邀请函需经沙特商会认证
⚠ 建议提前1个月准备材料`;
    } else if (lower.includes('写') || lower.includes('生成') || lower.includes('文章') || lower.includes('攻略') || lower.includes('指南')) {
      source = 'AI生成';
      title = '2026年沙特商务签证最新办理指南';
      summary = '全面介绍沙特商务签证申请条件、所需材料、办理流程及注意事项，帮助商务人士高效完成签证申请。';
      tags = ['沙特', '商务签证', '2026', '攻略'];
      content = `已根据您的需求生成文章，内容如下：

备选标题（点击选用）：
1. 2026年沙特商务签证最新办理指南
2. 沙特商务签证申请全攻略：2026年新版
3. 一文读懂2026沙特商务签证办理流程
4. 2026沙特签证新政解读与办理实务
5. 中东商旅必读：沙特商务签证办理手册

正文：

2026年沙特商务签证最新办理指南

沙特阿拉伯作为中东地区最大的经济体，近年来不断优化商务签证政策。2026年最新政策在申请流程、所需材料和审批时效等方面均有重要调整。本文将全面解读沙特商务签证的申请条件、办理流程和注意事项。

一、申请条件

沙特商务签证面向前往沙特进行商务活动的外国公民，包括：
· 商务考察与洽谈
· 会议与展览参展
· 合同签署与项目对接

基本条件：
✅ 护照有效期不少于6个月
✅ 有沙特公司出具的邀请函
✅ 无以色列入境记录

二、所需材料

1. 有效护照 —— 原件及复印件
2. 签证申请表 —— 在线填写并打印
3. 近期证件照 —— 2寸白底照片2张
4. 邀请函 —— 沙特方公司出具并盖章
5. 中方公司派遣信 —— 加盖公章
6. 往返机票预订单

三、办理流程

整个办理周期约7-15个工作日，建议提前一个月准备。

四、费用参考

单次入境：¥1,200 | 有效期3个月 | 停留期30天
多次入境：¥2,500 | 有效期6个月 | 停留期90天
落地签：¥800 | 即时生效 | 停留期30天

五、注意事项

⚠ 所有中文材料需附英文翻译件
⚠ 邀请函需经沙特商会认证
⚠ 女性申请人需额外提供担保信

自动摘要：${summary}

建议标签：${tags.join('、')}`;
    } else {
      source = '人工粘贴';
      title = '签证政策说明（优化版）';
      summary = '基于原始内容优化后的签证政策说明，语言更口语化，结构更清晰。';
      tags = ['签证', '政策', '2026'];
      content = `已根据您的要求优化内容，结果如下：

标题：签证政策说明（优化版）

优化后内容：

✨ 好消息！2026年沙特商务签证政策有了新的调整，整体流程更简便了！

📌 谁可以申请？
如果你是去沙特谈生意、开会、参展，都可以申请商务签证。简单来说，只要你持有有效的护照和沙特公司的邀请函，就能申请。

📋 准备什么材料？
· 护照（有效期6个月以上）
· 沙特公司的邀请函
· 2寸白底照片2张
· 中方公司的派遣信
· 往返机票订单

⏰ 多久能办好？
一般7-15个工作日就能出签，建议提前一个月准备哦！

💡 小贴士
· 所有中文材料都要附英文翻译件
· 邀请函要经过沙特商会认证才有效
· 女性申请者需要额外提供担保信

已按口语化、小红书风格优化，增加了emoji和分段标题，保留了核心信息。`;
    }

    if (type === 'poster') {
      const pages = generatePosterPages(source, pageCount);
      content += `

---

🖼️ 已为您准备海报模板（9:16，共 ${pageCount} 页，已自动排版），包含：
· 封面页：${title}
· ${pages.map((p, i) => `第${i + 2}页：${p.title}`).join('\n· ')}

即将进入海报编辑器，您可以编辑每页的标题、内容、背景图等信息。`;

      return {
        id: generateId(),
        role: 'assistant',
        content,
        timestamp: Date.now(),
        type: 'result',
        contentType: type,
        resultData: {
          title,
          summary,
          tags,
          source,
          wordCount: Math.floor(800 + Math.random() * 700),
          pageCount,
          ratio: '9:16',
          pages,
        },
      };
    }

    return {
      id: generateId(),
      role: 'assistant',
      content,
      timestamp: Date.now(),
      type: 'result',
      contentType: type,
      resultData: {
        title,
        summary,
        tags,
        source,
        wordCount: Math.floor(800 + Math.random() * 700),
        pageCount: 6,
        ratio: '9:16' as const,
      },
    };
  };

  // ── 从 AI 回复中解析结构化数据的辅助函数 ──

  function extractTitle(content: string, userInput: string): string {
    // 尝试从内容中提取标题（第一行或# 开头的行）
    const lines = content.split('\n').filter(l => l.trim());
    for (const line of lines.slice(0, 5)) {
      const match = line.match(/^#+\s+(.+)/);
      if (match) return match[1].trim().substring(0, 80);
      if (line.startsWith('标题：') || line.startsWith('标题:')) return line.replace(/^标题[：:]/, '').trim();
    }
    // 回退：用用户输入的前30字符
    return lines[0]?.substring(0, 80) || userInput.substring(0, 30);
  }

  function extractSummary(content: string): string {
    // 取前 150 字符作为摘要
    const clean = content.replace(/^#+ .+\n/, '').replace(/\n{2,}/g, '\n').trim();
    return clean.substring(0, 150) + (clean.length > 150 ? '...' : '');
  }

  function extractTags(content: string): string[] {
    const tags: string[] = [];
    // 尝试从内容中提取标签
    const tagMatch = content.match(/(?:标签|关键字|tags)[：:]/i);
    if (tagMatch) {
      const idx = content.indexOf(tagMatch[0]) + tagMatch[0].length;
      const tagLine = content.substring(idx, idx + 200).split('\n')[0];
      const parsed = tagLine.split(/[,，、;\s]+/).filter(t => t.length > 0 && t.length < 20);
      if (parsed.length > 0) return parsed.slice(0, 5);
    }
    // 回退：从内容中提取关键词
    const keywords = ['沙特', '签证', '商务', '旅行', '攻略', '指南', '政策', '办理', '中东', '材料'];
    for (const kw of keywords) {
      if (content.includes(kw) && tags.length < 4) tags.push(kw);
    }
    return tags.length > 0 ? tags : ['AI生成'];
  }

  function detectSource(userInput: string): string {
    const lower = userInput.toLowerCase();
    if (lower.includes('http') || lower.includes('链接') || lower.includes('读取')) return '链接读取';
    if (lower.includes('上传') || lower.includes('识别') || lower.includes('文件') || lower.includes('图片') || lower.includes('ocr')) return '文件识别';
    if (lower.includes('写') || lower.includes('生成') || lower.includes('文章') || lower.includes('攻略') || lower.includes('指南')) return 'AI生成';
    return '人工粘贴';
  }

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: input.trim(),
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const userInput = input.trim();
    setInput('');
    setIsLoading(true);

    // 收集附件和 URL 上下文
    const currentAttachments = [...uploadedFiles];
    const currentUrlContent = urlContent;
    // 发送后清空附件状态
    setUploadedFiles([]);
    setUrlContent('');
    setDetectedUrl(null);

    try {
      // 从 localStorage 读取用户 CMS token，用于鉴权访问 AI 渠道配置
      // 优先 URL token（iframe 内无 localStorage），兜底 localStorage
      const urlToken = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('token') || '' : '';
      const localToken = typeof window !== 'undefined' ? localStorage.getItem('cms_token') || '' : '';
      const cmsToken = urlToken || localToken;
      const res = await fetch('/ai-content/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userInput,
          contentType,
          pageCount: posterPageCount,
          token: cmsToken,
          attachments: currentAttachments.map(f => ({ filename: f.filename, content: f.content, type: f.type })),
          urlContent: currentUrlContent,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        // 内容安全拦截或接口错误，显示友好提示
        const errorResponse: ChatMessage = {
          id: generateId(),
          role: 'assistant',
          content: data.content || data.error || '生成失败，请重试',
          timestamp: Date.now(),
          type: 'text',
        };
        setMessages((prev) => [...prev, errorResponse]);
        setIsLoading(false);
        return;
      }

      // 从 AI 回复中解析结构化结果
      const aiContent: string = data.content || '';

      // 海报模式：优先使用 API 返回的结构化 pages 数据
      if (contentType === 'poster' && data.pages && Array.isArray(data.pages)) {
        const posterTitle = data.posterTitle || extractTitle(aiContent, userInput);
        const posterSummary = data.posterSummary || extractSummary(aiContent);
        const posterTags = data.posterTags || extractTags(aiContent);
        const posterSlogan = data.posterSlogan || '';
        const posterPages = data.pages;

        // 生成友好的聊天消息内容（不显示原始 JSON）
        const friendlyContent = `🖼️ 海报内容已生成完毕！

📌 标题：${posterTitle}
📝 摘要：${posterSummary}
🏷️ 标签：${posterTags.join('、')}
${posterSlogan ? `💬 标语：${posterSlogan}` : ''}
📄 共 ${posterPages.length} 页海报内容

每页包含标题、分节内容和配图，点击下方「使用内容」进入海报编辑器查看和编辑。`;

        const aiResponse: ChatMessage = {
          id: generateId(),
          role: 'assistant',
          content: friendlyContent,
          timestamp: Date.now(),
          type: 'result',
          contentType: 'poster',
          resultData: {
            title: posterTitle,
            summary: posterSummary,
            tags: posterTags,
            source: detectSource(userInput),
            wordCount: aiContent.length,
            pageCount: posterPages.length,
            ratio: '9:16',
            slogan: posterSlogan,
            pages: posterPages,
          },
        };
        setMessages((prev) => [...prev, aiResponse]);
      } else {
        // 文章模式 或 海报模式无 pages 数据
        const title = extractTitle(aiContent, userInput);
        const summary = extractSummary(aiContent);
        const tags = extractTags(aiContent);
        const source = detectSource(userInput);

        // 海报模式但无结构化数据时，也生成友好消息
        const displayContent = contentType === 'poster'
          ? `🖼️ 海报内容已生成！\n\n📌 标题：${title}\n📝 摘要：${summary}\n🏷️ 标签：${tags.join('、')}\n📄 共 ${posterPageCount} 页\n\n点击下方「使用内容」进入海报编辑器。`
          : aiContent;

        const aiResponse: ChatMessage = {
          id: generateId(),
          role: 'assistant',
          content: displayContent,
          timestamp: Date.now(),
          type: 'result',
          contentType: contentType,
          resultData: {
            title,
            summary,
            tags,
            source,
            wordCount: aiContent.length,
            pageCount: contentType === 'poster' ? posterPageCount : 6,
            ratio: '9:16',
            // 海报模式无 API pages 时，用 mock 数据填充
            ...(contentType === 'poster' ? { pages: generatePosterPages(source, posterPageCount) } : {}),
          },
        };
        setMessages((prev) => [...prev, aiResponse]);
      }
    } catch (err) {
      // 网络错误，回退到模拟响应
      console.warn('[handleSend] API 调用失败，回退到模拟模式', err);
      const fallback = simulateAiResponse(userInput, contentType, posterPageCount);
      setMessages((prev) => [...prev, fallback]);
    }

    setIsLoading(false);
  };

  const handleQuickPrompt = (prompt: string) => {
    setInput(prompt);
    textareaRef.current?.focus();
  };

  const handleCopy = (messageId: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(messageId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleUseContent = (msg: ChatMessage) => {
    if (!msg.resultData) return;
    const type = msg.contentType || 'article';
    // 将完整 AI 结果存入 sessionStorage，供编辑器读取
    sessionStorage.setItem('ai_result', JSON.stringify({
      content: msg.content,
      title: msg.resultData.title,
      summary: msg.resultData.summary,
      tags: msg.resultData.tags,
      source: msg.resultData.source,
      wordCount: msg.resultData.wordCount,
      slogan: msg.resultData.slogan,
    }));
    if (type === 'poster') {
      // 将分页数据存入 sessionStorage 供海报编辑器读取
      if (msg.resultData.pages) {
        sessionStorage.setItem('poster_pages', JSON.stringify(msg.resultData.pages));
      }
      sessionStorage.setItem('poster_title', msg.resultData.title);
      sessionStorage.setItem('poster_source', msg.resultData.source);
      if (msg.resultData.slogan) {
        sessionStorage.setItem('poster_slogan', msg.resultData.slogan);
      }
      router.push(`/poster?contentId=new&source=${encodeURIComponent(msg.resultData.source)}&title=${encodeURIComponent(msg.resultData.title)}&pageCount=${msg.resultData.pageCount || 6}&ratio=9:16`);
    } else {
      router.push(`/article?source=${encodeURIComponent(msg.resultData.source)}&title=${encodeURIComponent(msg.resultData.title)}`);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex h-screen flex-col bg-[#F5F5F7]">
      {/* 顶部导航 */}
      <header className="sticky top-0 z-20 border-b bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600">
              <Sparkles className="size-3.5 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold">AI 创作助手</span>
            </div>
          </div>
          <Link href="/dashboard">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
              <FileText className="size-3" />
              文章管理
            </Button>
          </Link>
        </div>
      </header>

      {/* 聊天区域 */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-4 py-6">
          {messages.length === 0 ? (
            /* 空状态 - 引导区 */
            <div className="flex flex-col items-center pt-12">
              <div className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 shadow-lg">
                <Sparkles className="size-8 text-white" />
              </div>
              <h2 className="mb-8 text-lg font-semibold">AI 创作助手</h2>

              {/* 快捷操作卡片 */}
              <div className="grid w-full max-w-xl grid-cols-2 gap-3">
                {QUICK_PROMPTS.map((item) => (
                  <button
                    key={item.label}
                    onClick={() => handleQuickPrompt(item.prompt)}
                    className="flex items-start gap-3 rounded-xl border bg-white p-4 text-left shadow-sm transition-all hover:shadow-md hover:border-blue-200"
                  >
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                      {item.icon}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{item.label}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                        {item.prompt}
                      </p>
                    </div>
                  </button>
                ))}
              </div>

            </div>
          ) : (
            /* 消息列表 */
            <div className="space-y-5">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] ${msg.role === 'user' ? '' : ''}`}
                  >
                    {/* 角色标签 */}
                    <div
                      className={`mb-1.5 flex items-center gap-1.5 ${msg.role === 'user' ? 'justify-end' : ''}`}
                    >
                      {msg.role === 'assistant' && (
                        <div className="flex size-5 items-center justify-center rounded-md bg-gradient-to-br from-blue-600 to-indigo-600">
                          <Sparkles className="size-3 text-white" />
                        </div>
                      )}
                      <span className="text-[11px] text-muted-foreground">
                        {msg.role === 'user' ? '你' : 'AI 助手'}
                      </span>
                    </div>

                    {/* 消息内容 */}
                    {msg.role === 'user' ? (
                      <div className="rounded-2xl rounded-tr-sm bg-[#1D4ED8] px-4 py-3 text-sm text-white">
                        {msg.content}
                      </div>
                    ) : (
                      <Card className="gap-0 border bg-white shadow-sm">
                        <div className="px-4 py-3">
                          <div className="whitespace-pre-wrap text-sm leading-relaxed">
                            {msg.content}
                          </div>
                        </div>

                        {/* 结果操作区 */}
                        {msg.type === 'result' && msg.resultData && (
                          <>
                            <Separator />
                            <div className="px-4 py-3">
                              {/* 内容元信息 */}
                              <div className="mb-3 flex flex-wrap items-center gap-2">
                                <Badge
                                  variant="secondary"
                                  className={`gap-1 text-[11px] ${msg.contentType === 'poster' ? 'bg-indigo-50 text-indigo-700' : 'bg-emerald-50 text-emerald-700'}`}
                                >
                                  {msg.contentType === 'poster' ? '🖼️ 海报' : '📰 文章'}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  约 {msg.resultData.wordCount} 字
                                </span>
                              </div>

                              {/* 操作按钮 */}
                              <div className="flex items-center gap-2">
                                <Button
                                  onClick={() => handleUseContent(msg)}
                                  className="gap-1.5"
                                  size="sm"
                                >
                                  {msg.contentType === 'poster' ? (
                                    <>
                                      <ImageIcon className="size-3.5" />
                                      进入海报编辑
                                    </>
                                  ) : (
                                    <>
                                      <FileText className="size-3.5" />
                                      使用此内容
                                    </>
                                  )}
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="gap-1.5"
                                  onClick={() => handleCopy(msg.id, msg.content)}
                                >
                                  {copiedId === msg.id ? (
                                    <Check className="size-3.5 text-emerald-600" />
                                  ) : (
                                    <Copy className="size-3.5" />
                                  )}
                                  {copiedId === msg.id ? '已复制' : '复制内容'}
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="gap-1.5"
                                  onClick={() => {
                                    setInput('请帮我进一步优化这段内容，改成更适合小红书发布的风格');
                                    textareaRef.current?.focus();
                                  }}
                                >
                                  继续优化
                                </Button>
                              </div>
                            </div>
                          </>
                        )}
                      </Card>
                    )}
                  </div>
                </div>
              ))}

              {/* 加载中状态 */}
              {isLoading && (
                <div className="flex justify-start">
                  <div>
                    <div className="mb-1.5 flex items-center gap-1.5">
                      <div className="flex size-5 items-center justify-center rounded-md bg-gradient-to-br from-blue-600 to-indigo-600">
                        <Sparkles className="size-3 text-white" />
                      </div>
                      <span className="text-[11px] text-muted-foreground">
                        AI 助手
                      </span>
                    </div>
                    <Card className="border bg-white shadow-sm">
                      <div className="flex items-center gap-2 px-4 py-3">
                        <Loader2 className="size-4 animate-spin text-blue-600" />
                        <span className="text-sm text-muted-foreground">
                          正在处理你的请求...
                        </span>
                      </div>
                    </Card>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </div>

      {/* 底部输入区 */}
      <div className="border-t bg-white">
        <div className="mx-auto max-w-3xl px-4 py-3">
          {/* 快捷提示词（消息为空时显示） */}
          {messages.length === 0 && (
            <div className="mb-3 flex flex-wrap gap-1.5">
              {['读取链接', '识别文件', '生成文章', '优化内容', '口语化', '加emoji', '加小标题', '小红书风格'].map((p) => (
                <button
                  key={p}
                  onClick={() => {
                    const promptMap: Record<string, string> = {
                      '读取链接': '帮我读取这篇文章的内容：https://mp.weixin.qq.com/s/example',
                      '识别文件': '请识别我上传的文件内容并整理成清单',
                      '生成文章': '请帮我写一篇关于沙特商务签证的攻略文章',
                      '优化内容': '请帮我优化这段签证政策说明，改成更口语化的风格',
                      '口语化': '请把以下内容改成口语化风格，方便阅读',
                      '加emoji': '请在以下内容中加入适当的emoji，让文章更生动',
                      '加小标题': '请给以下内容添加小标题，让结构更清晰',
                      '小红书风格': '请把以下内容改成小红书风格，加入emoji和分段标题',
                    };
                    setInput(promptMap[p] || p);
                    textareaRef.current?.focus();
                  }}
                  className="rounded-full border px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600"
                >
                  {p}
                </button>
              ))}
            </div>
          )}

          {/* 附件 & URL 上下文指示器 */}
          {(uploadedFiles.length > 0 || urlContent) && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {uploadedFiles.map((f, i) => (
                <span key={i} className="inline-flex items-center gap-1 rounded-lg border bg-blue-50 px-2 py-1 text-[11px] text-blue-700">
                  {f.type === 'image' ? <ImageIcon className="size-3" /> : <FileText className="size-3" />}
                  {f.filename.length > 20 ? f.filename.substring(0, 17) + '...' : f.filename}
                  <button onClick={() => setUploadedFiles(prev => prev.filter((_, idx) => idx !== i))} className="ml-0.5 text-blue-400 hover:text-red-500">
                    <X className="size-3" />
                  </button>
                </span>
              ))}
              {urlContent && (
                <span className="inline-flex items-center gap-1 rounded-lg border bg-green-50 px-2 py-1 text-[11px] text-green-700">
                  <Globe className="size-3" />
                  已读取 URL 内容 ({urlContent.length} 字)
                  <button onClick={() => setUrlContent('')} className="ml-0.5 text-green-400 hover:text-red-500">
                    <X className="size-3" />
                  </button>
                </span>
              )}
            </div>
          )}

          {/* URL 检测提示 */}
          {detectedUrl && !urlContent && (
            <div className="mb-2 flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
              <Link2 className="size-3.5 shrink-0" />
              <span className="flex-1 truncate">检测到链接: {detectedUrl}</span>
              <button
                onClick={() => handleFetchUrl(detectedUrl)}
                disabled={urlFetching}
                className="shrink-0 rounded-md bg-blue-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {urlFetching ? '抓取中...' : '读取内容'}
              </button>
            </div>
          )}

          {/* 隐藏的文件输入 */}
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.docx,.txt,.md,.csv,.json,.html"
            onChange={handleFileUpload}
          />

          {/* 类型选择 + 输入框 */}
          <div className="flex items-end gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-slate-100 hover:text-blue-600 disabled:opacity-50"
              title="上传文件（图片/PDF/DOCX/TXT等）"
            >
              {uploading ? <Loader2 className="size-4 animate-spin" /> : <Paperclip className="size-4" />}
            </button>

            {/* 输入框容器 */}
            <div className="relative flex-1">
              <Textarea
                ref={textareaRef}
                placeholder="输入提示词，如 帮我写一篇沙特商务签证攻略 或 读取这个链接的内容并优化 ..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                className="min-h-[44px] max-h-[160px] resize-none rounded-xl pb-8 pr-12 text-sm"
                rows={1}
              />

              {/* 类型选择 - 嵌入输入框底部 */}
              <div className="absolute bottom-1.5 left-2 flex items-center gap-1">
                <div className="flex items-center rounded-lg bg-slate-100 p-0.5">
                  <button
                    onClick={() => setContentType('article')}
                    className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-medium transition-all ${
                      contentType === 'article'
                        ? 'bg-white text-emerald-700 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <FileText className="size-3" />
                    文章
                  </button>
                  <button
                    onClick={() => setContentType('poster')}
                    className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-medium transition-all ${
                      contentType === 'poster'
                        ? 'bg-white text-indigo-700 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <ImageIcon className="size-3" />
                    海报
                  </button>
                </div>
                {contentType === 'poster' && (
                  <div className="flex items-center gap-1.5 ml-1">
                    <span className="text-[10px] text-slate-400">页数</span>
                      <button
                        onClick={() => setPosterPageCount(Math.max(1, posterPageCount - 1))}
                        className="flex size-5 items-center justify-center rounded border text-[11px] text-slate-500 hover:bg-slate-50 transition-colors"
                      >
                        −
                      </button>
                      <span className="w-7 text-center text-[11px] font-medium text-indigo-700 tabular-nums">
                        {posterPageCount}
                      </span>
                      <button
                        onClick={() => setPosterPageCount(Math.min(15, posterPageCount + 1))}
                        className="flex size-5 items-center justify-center rounded border text-[11px] text-slate-500 hover:bg-slate-50 transition-colors"
                      >
                        +
                      </button>
                    </div>
                )}
              </div>

              {/* 发送按钮 */}
              <Button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                size="icon"
                className="absolute bottom-1.5 right-1.5 shrink-0 rounded-xl size-8"
              >
                <Send className="size-3.5" />
              </Button>
            </div>
          </div>
          <p className="mt-1.5 text-center text-[11px] text-muted-foreground">
            {contentType === 'poster'
              ? `🖼️ 海报模式：${posterPageCount} 页 · AI 生成内容后自动排版到每页`
              : '📰 文章模式：AI 生成图文内容，适配官网和公众号发布'}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function CreatePage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-[#F5F5F7]">
          <Loader2 className="size-6 animate-spin text-blue-600" />
        </div>
      }
    >
      <CreateContentInner />
    </Suspense>
  );
}
