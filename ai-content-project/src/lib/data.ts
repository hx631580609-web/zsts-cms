export type ContentSource = '链接读取' | '文件识别' | 'AI生成' | '人工粘贴';
export type ContentType = '文章' | '海报';
export type ContentStatus = '草稿' | '已生成' | '已发布';

export interface ContentItem {
  id: string;
  title: string;
  content: string;
  summary: string;
  coverImage: string;
  images: string[];
  category: string;
  tags: string[];
  source: ContentSource;
  sourceUrl?: string;
  aiOptimized: boolean;
  aiPrompt?: string;
  status: ContentStatus;
  generatedTypes: ContentType[];
  hasVideo: boolean;
  createdAt: string;
  updatedAt: string;
}

export const CONTENT_ITEMS: ContentItem[] = [];

export const SOURCE_COLOR_MAP: Record<ContentSource, string> = {
  '链接读取': 'bg-blue-100 text-blue-700',
  '文件识别': 'bg-violet-100 text-violet-700',
  'AI生成': 'bg-pink-100 text-pink-700',
  '人工粘贴': 'bg-orange-100 text-orange-700',
};

export const STATUS_COLOR_MAP: Record<ContentStatus, string> = {
  '草稿': 'bg-zinc-100 text-zinc-600',
  '已生成': 'bg-emerald-100 text-emerald-700',
  '已发布': 'bg-blue-100 text-blue-700',
};

export const CATEGORY_OPTIONS = [
  '沙特签证',
  '中东商旅',
  '出行指南',
  '政策解读',
];

export const VOICE_OPTIONS = ['温柔女声', '商务男声'];
export const BGM_OPTIONS = [
  '不选择',
  '沙特传统乌德琴',
  '沙漠驼铃',
  '阿拉伯之夜',
  '中东风情',
  '利雅得晨曦',
];
export const VIDEO_RATIO_OPTIONS = ['竖版9:16', '横版16:9'];

// ── 分发平台 ──
export const SHARE_PLATFORMS = [
  {
    id: 'xiaohongshu',
    name: '小红书',
    url: 'https://www.xiaohongshu.com/explore',
    icon: '📕',
    color: '#FF2442',
    desc: '图文笔记/视频笔记',
  },
  {
    id: 'shipinhao',
    name: '视频号',
    url: 'https://channels.weixin.qq.com/',
    icon: '📺',
    color: '#07C160',
    desc: '微信视频号发布',
  },
  {
    id: 'douyin',
    name: '抖音',
    url: 'https://creator.douyin.com/',
    icon: '🎵',
    color: '#000000',
    desc: '抖音创作者平台',
  },
] as const;

// ── 根据海报标题/内容自动生成 tag ──
export function generatePosterTags(title: string, tagline1?: string, tagline2?: string): string[] {
  const tags: Set<string> = new Set();
  const full = `${title} ${tagline1 || ''} ${tagline2 || ''}`.toLowerCase();

  // 国家/地区
  const regionMap: Record<string, string> = {
    沙特: '#沙特', 中东: '#中东', 迪拜: '#迪拜', 阿联酋: '#阿联酋',
    卡塔尔: '#卡塔尔', 阿曼: '#阿曼', 巴林: '#巴林',
  };
  for (const [k, v] of Object.entries(regionMap)) {
    if (full.includes(k)) tags.add(v);
  }

  // 签证类型
  if (full.includes('商务签') || full.includes('商务')) tags.add('#商务签证');
  if (full.includes('工作签')) tags.add('#工作签证');
  if (full.includes('旅游签')) tags.add('#旅游签证');
  if (full.includes('落地签')) tags.add('#落地签');
  if (full.includes('电子签')) tags.add('#电子签证');

  // 年份
  const yearMatch = title.match(/(202\d)/);
  if (yearMatch) tags.add(`#${yearMatch[1]}最新`);

  // 主题
  const topicMap: Record<string, string> = {
    办理指南: '#签证办理', 攻略: '#出行攻略', 政策: '#政策解读',
    清单: '#出行清单', 酒店: '#酒店推荐', 商旅: '#商旅出行',
    费用: '#费用参考', 流程: '#办理流程', 材料: '#材料清单',
  };
  for (const [k, v] of Object.entries(topicMap)) {
    if (full.includes(k)) tags.add(v);
  }

  // 兜底
  if (tags.size < 2) {
    tags.add('#沙特签证');
    tags.add('#商旅出行');
  }

  return Array.from(tags).slice(0, 8);
}
