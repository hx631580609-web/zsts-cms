'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Save,
  Eye,
  Edit3,
  FileText,
  Check,
  Globe,
  MessageCircle,
  Plus,
  Trash2,
  GripVertical,
  ImageIcon,
  List,
  Type,
  AlertTriangle,
  Table,
  Quote,
  Loader2,
  Download,
  Copy,
  Send,
  Upload,
  Search,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

/* ── 内容块类型 ── */
type BlockType = 'heading' | 'paragraph' | 'image' | 'list' | 'table' | 'tip' | 'quote';

interface ContentBlock {
  id: string;
  type: BlockType;
  content: string;
  items?: string[];
  rows?: string[][];
  imageDesc?: string;
}

/* ── 初始模拟数据 ── */
const INITIAL_BLOCKS: ContentBlock[] = [
  {
    id: 'p1',
    type: 'paragraph',
    content: '沙特阿拉伯作为中东地区最大的经济体，近年来不断优化商务签证政策。2026年最新政策在申请流程、所需材料和审批时效等方面均有重要调整。本文将全面解读沙特商务签证的申请条件、办理流程和注意事项。',
  },
  {
    id: 'img1',
    type: 'image',
    content: 'https://images.pexels.com/photos/3727464/pexels-photo-3727464.jpeg?w=800&h=400&fit=crop',
    imageDesc: '沙特利雅得城市天际线',
  },
  {
    id: 'h1',
    type: 'heading',
    content: '一、申请条件',
  },
  {
    id: 'p2',
    type: 'paragraph',
    content: '沙特商务签证面向前往沙特进行商务活动的外国公民，包括商务考察与洽谈、会议与展览参展、合同签署与项目对接等。',
  },
  {
    id: 'list1',
    type: 'list',
    content: '基本条件',
    items: ['护照有效期不少于6个月', '有沙特公司出具的邀请函', '无以色列入境记录（部分情况）', '往返机票预订单'],
  },
  {
    id: 'img2',
    type: 'image',
    content: 'https://images.pexels.com/photos/3184292/pexels-photo-3184292.jpeg?w=800&h=400&fit=crop',
    imageDesc: '签证申请材料',
  },
  {
    id: 'h2',
    type: 'heading',
    content: '二、所需材料',
  },
  {
    id: 'p3',
    type: 'paragraph',
    content: '根据2026年最新政策，申请沙特商务签证需准备以下材料：',
  },
  {
    id: 'list2',
    type: 'list',
    content: '材料清单',
    items: [
      '有效护照 — 原件及复印件',
      '签证申请表 — 在线填写并打印',
      '近期证件照 — 2寸白底照片2张',
      '邀请函 — 沙特方公司出具并盖章',
      '中方公司派遣信 — 加盖公章',
      '往返机票预订单',
    ],
  },
  {
    id: 'tip1',
    type: 'tip',
    content: '所有中文材料需附英文翻译件，邀请函需经沙特商会认证。',
  },
  {
    id: 'h3',
    type: 'heading',
    content: '三、办理流程',
  },
  {
    id: 'p4',
    type: 'paragraph',
    content: '整个办理周期约7-15个工作日，建议提前一个月准备。以下是详细办理步骤：',
  },
  {
    id: 'list3',
    type: 'list',
    content: '办理步骤',
    items: [
      '准备所有必要材料',
      '在线填写签证申请表',
      '预约签证中心递交材料',
      '等待审批（7-15个工作日）',
      '领取签证',
    ],
  },
  {
    id: 'img3',
    type: 'image',
    content: 'https://images.pexels.com/photos/3184418/pexels-photo-3184418.jpeg?w=800&h=400&fit=crop',
    imageDesc: '签证办理流程',
  },
  {
    id: 'h4',
    type: 'heading',
    content: '四、费用参考',
  },
  {
    id: 'table1',
    type: 'table',
    content: '',
    rows: [
      ['签证类型', '办理费用', '有效期', '停留期'],
      ['单次入境', '¥1,200', '3个月', '30天'],
      ['多次入境', '¥2,500', '6个月', '90天'],
      ['落地签', '¥800', '即时', '30天'],
    ],
  },
  {
    id: 'h5',
    type: 'heading',
    content: '五、注意事项',
  },
  {
    id: 'tip2',
    type: 'tip',
    content: '邀请函需经沙特商会认证，否则可能影响审批进度。',
  },
  {
    id: 'list4',
    type: 'list',
    content: '重要提醒',
    items: [
      '所有中文材料需附英文翻译件',
      '邀请函需经沙特商会认证',
      '女性申请人需额外提供担保信',
      '签证有效期以签发日为准，非入境日',
    ],
  },
  {
    id: 'quote1',
    type: 'quote',
    content: '本文仅供参考，具体政策以沙特驻华使馆最新公告为准。建议出行前咨询专业签证机构。',
  },
];

let _idCounter = 100;
const genId = () => `b${++_idCounter}`;

const BLOCK_LABELS: Record<BlockType, string> = {
  heading: '标题',
  paragraph: '段落',
  image: '图片',
  list: '列表',
  table: '表格',
  tip: '提示',
  quote: '引用',
};

function ArticleEditorInner() {
  const searchParams = useSearchParams();

  const sourceTitle = searchParams.get('title') || '';
  const sourceType = searchParams.get('source') || 'AI生成';

  const [title, setTitle] = useState(sourceTitle || '2026年沙特商务签证最新办理指南');
  const [summary, setSummary] = useState('全面介绍沙特商务签证的申请条件、所需材料、办理流程及注意事项，帮助商务人士高效完成签证申请。');
  const [tags, setTags] = useState('沙特、商务签证、2026、攻略');
  const [blocks, setBlocks] = useState<ContentBlock[]>(INITIAL_BLOCKS);
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [published, setPublished] = useState(false);
  const [distribution, setDistribution] = useState<{ cms: boolean; wechat: boolean }>({ cms: false, wechat: false });
  const [coverImage, setCoverImage] = useState('https://images.pexels.com/photos/3727464/pexels-photo-3727464.jpeg?w=800&h=360&fit=crop');
  const [imagePickerTarget, setImagePickerTarget] = useState<{ blockId?: string; isCover?: boolean } | null>(null);
  const [imagePickerTab, setImagePickerTab] = useState<'pexels' | 'upload'>('pexels');
  const [imagePickerQuery, setImagePickerQuery] = useState('');
  const [imagePickerLoading, setImagePickerLoading] = useState(false);
  const [pexelsResults, setPexelsResults] = useState<{ url: string; desc: string }[]>([]);

  const totalWords = blocks.reduce((acc, b) => {
    if (b.type === 'heading' || b.type === 'paragraph' || b.type === 'tip' || b.type === 'quote') return acc + b.content.length;
    if (b.type === 'list') return acc + (b.items?.reduce((s, i) => s + i.length, 0) || 0) + (b.content?.length || 0);
    if (b.type === 'table') return acc + (b.rows?.flat().reduce((s, i) => s + i.length, 0) || 0);
    return acc;
  }, title.length + summary.length);

  /* ── Block 操作 ── */
  const updateBlock = (id: string, updates: Partial<ContentBlock>) => {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, ...updates } : b));
  };

  const removeBlock = (id: string) => {
    setBlocks(prev => prev.filter(b => b.id !== id));
  };

  const addBlock = (type: BlockType, afterId?: string) => {
    const newBlock: ContentBlock = {
      id: genId(),
      type,
      content: type === 'heading' ? '新标题' : type === 'paragraph' ? '新段落内容...' : type === 'tip' ? '提示内容...' : type === 'quote' ? '引用内容...' : '',
      items: type === 'list' ? ['列表项1'] : undefined,
      rows: type === 'table' ? [['列1', '列2'], ['数据1', '数据2']] : undefined,
      imageDesc: type === 'image' ? '图片描述' : undefined,
    };
    if (afterId) {
      const idx = blocks.findIndex(b => b.id === afterId);
      const newBlocks = [...blocks];
      newBlocks.splice(idx + 1, 0, newBlock);
      setBlocks(newBlocks);
    } else {
      setBlocks(prev => [...prev, newBlock]);
    }
  };

  const moveBlock = (id: string, direction: 'up' | 'down') => {
    const idx = blocks.findIndex(b => b.id === id);
    if ((direction === 'up' && idx === 0) || (direction === 'down' && idx === blocks.length - 1)) return;
    const newBlocks = [...blocks];
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    [newBlocks[idx], newBlocks[swapIdx]] = [newBlocks[swapIdx], newBlocks[idx]];
    setBlocks(newBlocks);
  };

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const toggleDistribution = (channel: 'cms' | 'wechat') => {
    setDistribution(prev => ({ ...prev, [channel]: !prev[channel] }));
  };

  /* ── 图片选择器 ── */
  const openImagePicker = (target: { blockId?: string; isCover?: boolean }) => {
    setImagePickerTarget(target);
    setImagePickerTab('pexels');
    setImagePickerQuery('');
    setPexelsResults([]);
  };

  const closeImagePicker = () => {
    setImagePickerTarget(null);
    setImagePickerLoading(false);
  };

  const applyImage = (url: string) => {
    if (imagePickerTarget?.isCover) {
      setCoverImage(url);
    } else if (imagePickerTarget?.blockId) {
      updateBlock(imagePickerTarget.blockId, { content: url });
    }
    closeImagePicker();
  };

  const handlePexelsSearch = async () => {
    setImagePickerLoading(true);
    try {
      const res = await fetch(
        `https://api.pexels.com/v1/search?query=${encodeURIComponent(imagePickerQuery || 'saudi arabia business visa')}&per_page=8`,
        {
          headers: { Authorization: 'brcLaxxFLPDBf7mcvEUtBGQc9DpZznfR9fqRaBjwYwLmCwwxeljifpXJ' },
        }
      );
      const data = await res.json();
      if (data.photos?.length) {
        setPexelsResults(
          data.photos.map((p: { src: { large: string }; alt: string }) => ({
            url: p.src.large,
            desc: p.alt || 'Pexels 图片',
          }))
        );
      } else {
        // fallback: curated results
        setPexelsResults([
          { url: 'https://images.pexels.com/photos/3727464/pexels-photo-3727464.jpeg?w=800&h=400&fit=crop', desc: '利雅得城市天际线' },
          { url: 'https://images.pexels.com/photos/3881104/pexels-photo-3881104.jpeg?w=800&h=400&fit=crop', desc: '沙漠风光' },
          { url: 'https://images.pexels.com/photos/3184292/pexels-photo-3184292.jpeg?w=800&h=400&fit=crop', desc: '商务办公' },
          { url: 'https://images.pexels.com/photos/3184418/pexels-photo-3184418.jpeg?w=800&h=400&fit=crop', desc: '团队协作' },
          { url: 'https://images.pexels.com/photos/17444870/pexels-photo-17444870.jpeg?w=800&h=400&fit=crop', desc: '城市夜景' },
          { url: 'https://images.pexels.com/photos/2104742/pexels-photo-2104742.jpeg?w=800&h=400&fit=crop', desc: '旅行出行' },
          { url: 'https://images.pexels.com/photos/325193/pexels-photo-325193.jpeg?w=800&h=400&fit=crop', desc: '城市建筑' },
          { url: 'https://images.pexels.com/photos/313782/pexels-photo-313782.jpeg?w=800&h=400&fit=crop', desc: '现代都市' },
        ]);
      }
    } catch {
      setPexelsResults([]);
    }
    setImagePickerLoading(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      if (dataUrl) applyImage(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  /* ── 渲染单个预览 Block ── */
  const renderPreviewBlock = (block: ContentBlock) => {
    switch (block.type) {
      case 'heading':
        return <h2 key={block.id} className="mb-3 mt-8 text-xl font-bold text-zinc-900 tracking-tight">{block.content}</h2>;
      case 'paragraph':
        return <p key={block.id} className="mb-4 text-[15px] leading-[1.85] text-zinc-700">{block.content}</p>;
      case 'image':
        return (
          <figure key={block.id} className="my-5">
            <div className="overflow-hidden rounded-xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={block.content} alt={block.imageDesc || ''} className="w-full object-cover" style={{ maxHeight: 360 }} />
            </div>
            {block.imageDesc && (
              <figcaption className="mt-2 text-center text-xs text-zinc-400">{block.imageDesc}</figcaption>
            )}
          </figure>
        );
      case 'list':
        return (
          <div key={block.id} className="my-4 rounded-xl bg-zinc-50 p-4">
            {block.content && <p className="mb-2 text-sm font-semibold text-zinc-800">{block.content}</p>}
            <ul className="space-y-1.5">
              {block.items?.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-[15px] text-zinc-700">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-blue-500" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        );
      case 'table':
        return (
          <div key={block.id} className="my-4 overflow-hidden rounded-xl border border-zinc-200">
            <table className="w-full text-sm">
              <tbody>
                {block.rows?.map((row, ri) => (
                  <tr key={ri} className={ri === 0 ? 'bg-zinc-800 text-white' : 'border-b border-zinc-100 even:bg-zinc-50'}>
                    {row.map((cell, ci) => (
                      <td key={ci} className={`px-4 py-2.5 ${ri === 0 ? 'font-semibold' : ''}`}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      case 'tip':
        return (
          <div key={block.id} className="my-4 flex gap-3 rounded-xl bg-amber-50 border border-amber-200 p-4">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" />
            <p className="text-sm leading-relaxed text-amber-800">{block.content}</p>
          </div>
        );
      case 'quote':
        return (
          <blockquote key={block.id} className="my-5 border-l-4 border-zinc-300 bg-zinc-50 py-3 pl-4 pr-3">
            <p className="text-sm italic leading-relaxed text-zinc-500">{block.content}</p>
          </blockquote>
        );
      default:
        return null;
    }
  };

  /* ── 渲染编辑 Block ── */
  const renderEditBlock = (block: ContentBlock, index: number) => {
    return (
      <div key={block.id} className="group relative rounded-lg border border-zinc-200 bg-white p-3 transition-all hover:border-blue-300 hover:shadow-sm">
        {/* 类型标签 + 操作 */}
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <GripVertical className="size-3.5 text-zinc-300" />
            <Badge variant="secondary" className="gap-1 text-[10px]">
              {block.type === 'heading' && <Type className="size-2.5" />}
              {block.type === 'image' && <ImageIcon className="size-2.5" />}
              {block.type === 'list' && <List className="size-2.5" />}
              {block.type === 'table' && <Table className="size-2.5" />}
              {block.type === 'tip' && <AlertTriangle className="size-2.5" />}
              {block.type === 'quote' && <Quote className="size-2.5" />}
              {BLOCK_LABELS[block.type]}
            </Badge>
          </div>
          <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
            <button onClick={() => moveBlock(block.id, 'up')} disabled={index === 0} className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 disabled:opacity-30">
              <svg className="size-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
            </button>
            <button onClick={() => moveBlock(block.id, 'down')} disabled={index === blocks.length - 1} className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 disabled:opacity-30">
              <svg className="size-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </button>
            <button onClick={() => removeBlock(block.id)} className="rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-500">
              <Trash2 className="size-3.5" />
            </button>
          </div>
        </div>

        {/* 内容编辑区 */}
        {block.type === 'heading' && (
          <Input
            value={block.content}
            onChange={(e) => updateBlock(block.id, { content: e.target.value })}
            className="text-base font-semibold"
            placeholder="输入标题"
          />
        )}

        {block.type === 'paragraph' && (
          <textarea
            value={block.content}
            onChange={(e) => updateBlock(block.id, { content: e.target.value })}
            className="w-full resize-none rounded-md border border-input bg-transparent px-3 py-2 text-sm leading-relaxed ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            rows={3}
            placeholder="输入段落内容"
          />
        )}

        {block.type === 'image' && (
          <div className="space-y-2">
            {block.content ? (
              <div className="group/img relative overflow-hidden rounded-lg border border-zinc-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={block.content} alt={block.imageDesc || ''} className="h-40 w-full object-cover" />
                <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/0 transition-all group-hover/img:bg-black/40">
                  <button
                    onClick={() => openImagePicker({ blockId: block.id })}
                    className="rounded-lg bg-white/90 px-3 py-1.5 text-xs font-medium text-zinc-700 opacity-0 shadow transition-all group-hover/img:opacity-100 hover:bg-white"
                  >
                    更换图片
                  </button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => openImagePicker({ blockId: block.id })}
                className="flex h-32 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-zinc-200 bg-zinc-50 transition-colors hover:border-blue-300 hover:bg-blue-50/30"
              >
                <div className="text-center">
                  <ImageIcon className="mx-auto mb-1.5 size-6 text-zinc-300" />
                  <p className="text-xs text-zinc-400">点击选择图片来源</p>
                </div>
              </div>
            )}
            <Input
              value={block.imageDesc || ''}
              onChange={(e) => updateBlock(block.id, { imageDesc: e.target.value })}
              placeholder="图片描述（选填）"
              className="text-xs"
            />
          </div>
        )}

        {block.type === 'list' && (
          <div className="space-y-2">
            <Input
              value={block.content}
              onChange={(e) => updateBlock(block.id, { content: e.target.value })}
              placeholder="列表标题（选填）"
              className="text-sm"
            />
            {block.items?.map((item, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <span className="size-1.5 shrink-0 rounded-full bg-blue-400" />
                <Input
                  value={item}
                  onChange={(e) => {
                    const newItems = [...(block.items || [])];
                    newItems[i] = e.target.value;
                    updateBlock(block.id, { items: newItems });
                  }}
                  className="text-sm"
                  placeholder={`列表项 ${i + 1}`}
                />
                <button
                  onClick={() => updateBlock(block.id, { items: block.items?.filter((_, idx) => idx !== i) })}
                  className="shrink-0 rounded p-1 text-zinc-300 hover:text-red-400"
                >
                  <Trash2 className="size-3" />
                </button>
              </div>
            ))}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-xs text-blue-600"
              onClick={() => updateBlock(block.id, { items: [...(block.items || []), `列表项${(block.items?.length || 0) + 1}`] })}
            >
              <Plus className="size-3" /> 添加列表项
            </Button>
          </div>
        )}

        {block.type === 'table' && (
          <div className="space-y-2 overflow-x-auto">
            <table className="w-full text-sm">
              <tbody>
                {block.rows?.map((row, ri) => (
                  <tr key={ri} className={ri === 0 ? 'bg-zinc-800 text-white' : 'border-b border-zinc-100'}>
                    {row.map((cell, ci) => (
                      <td key={ci} className="px-1 py-1">
                        <input
                          value={cell}
                          onChange={(e) => {
                            const newRows = block.rows?.map(r => [...r]) || [];
                            newRows[ri][ci] = e.target.value;
                            updateBlock(block.id, { rows: newRows });
                          }}
                          className={`w-full rounded border-0 bg-transparent px-2 py-1 text-sm ${ri === 0 ? 'font-semibold' : ''} focus:outline-none focus:ring-1 focus:ring-blue-400`}
                        />
                      </td>
                    ))}
                    <td className="px-1">
                      <button
                        onClick={() => {
                          const newRows = block.rows?.filter((_, idx) => idx !== ri);
                          updateBlock(block.id, { rows: newRows });
                        }}
                        className="rounded p-0.5 text-zinc-300 hover:text-red-400"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-xs text-blue-600"
              onClick={() => {
                const colCount = block.rows?.[0]?.length || 2;
                updateBlock(block.id, { rows: [...(block.rows || []), Array(colCount).fill('')] });
              }}
            >
              <Plus className="size-3" /> 添加行
            </Button>
          </div>
        )}

        {block.type === 'tip' && (
          <div className="flex items-start gap-2 rounded-lg bg-amber-50 p-3">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" />
            <textarea
              value={block.content}
              onChange={(e) => updateBlock(block.id, { content: e.target.value })}
              className="w-full resize-none border-0 bg-transparent text-sm leading-relaxed text-amber-800 ring-offset-background focus:outline-none focus:ring-1 focus:ring-amber-400"
              rows={2}
              placeholder="输入提示内容"
            />
          </div>
        )}

        {block.type === 'quote' && (
          <div className="border-l-4 border-zinc-300 bg-zinc-50 py-2 pl-3 pr-2">
            <textarea
              value={block.content}
              onChange={(e) => updateBlock(block.id, { content: e.target.value })}
              className="w-full resize-none border-0 bg-transparent text-sm italic leading-relaxed text-zinc-500 ring-offset-background focus:outline-none focus:ring-1 focus:ring-zinc-400"
              rows={2}
              placeholder="输入引用内容"
            />
          </div>
        )}

        {/* 添加 Block 按钮 */}
        <div className="mt-2 flex flex-wrap gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          {(['heading', 'paragraph', 'image', 'list', 'table', 'tip', 'quote'] as BlockType[]).map(bt => (
            <button
              key={bt}
              onClick={() => addBlock(bt, block.id)}
              className="flex items-center gap-1 rounded-md bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-500 hover:bg-blue-50 hover:text-blue-600"
            >
              {BLOCK_LABELS[bt]}
            </button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-screen flex-col bg-[#F5F5F7]">
      {/* 顶部导航 */}
      <header className="sticky top-0 z-20 border-b bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <Link href="/create">
              <Button variant="ghost" size="icon-sm" className="shrink-0">
                <ArrowLeft className="size-4" />
              </Button>
            </Link>
            <Separator orientation="vertical" className="h-5" />
            <div className="flex items-center gap-2">
              <div className="flex size-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
                <FileText className="size-3.5" />
              </div>
              <span className="text-sm font-semibold">文章编辑器</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* 编辑/预览切换 */}
            <div className="flex items-center rounded-lg bg-slate-100 p-0.5">
              <button
                onClick={() => setMode('edit')}
                className={`flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                  mode === 'edit' ? 'bg-white text-zinc-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Edit3 className="size-3" />
                编辑
              </button>
              <button
                onClick={() => setMode('preview')}
                className={`flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                  mode === 'preview' ? 'bg-white text-zinc-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Eye className="size-3" />
                预览
              </button>
            </div>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={handleSave}>
              {saved ? (
                <><Check className="size-3.5 text-emerald-600" />已保存</>
              ) : (
                <><Save className="size-3.5" />保存</>
              )}
            </Button>
          </div>
        </div>
      </header>

      {/* 主内容区 */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-4 py-6">
          {/* 来源信息 */}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="gap-1 text-[11px] bg-emerald-50 text-emerald-700">📰 文章</Badge>
            <span className="text-xs text-muted-foreground">约 {totalWords} 字</span>
          </div>

          {mode === 'edit' ? (
            /* ═══ 编辑模式 ═══ */
            <div className="space-y-4">
              {/* 封面图 */}
              <div className="group/cover relative overflow-hidden rounded-xl">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={coverImage}
                  alt="封面"
                  className="h-48 w-full object-cover"
                />
                <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/0 transition-all group-hover/cover:bg-black/40">
                  <button
                    onClick={() => openImagePicker({ isCover: true })}
                    className="rounded-lg bg-white/90 px-4 py-2 text-sm font-medium text-zinc-700 opacity-0 shadow transition-all group-hover/cover:opacity-100 hover:bg-white"
                  >
                    更换封面图
                  </button>
                </div>
              </div>

              {/* 标题 */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">文章标题</label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="text-xl font-semibold"
                  placeholder="输入文章标题"
                />
              </div>

              {/* 摘要 */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">摘要（150字以内）</label>
                <textarea
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  className="w-full resize-none rounded-md border border-input bg-transparent px-3 py-2 text-sm leading-relaxed ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  rows={2}
                  placeholder="输入文章摘要"
                  maxLength={150}
                />
                <div className="mt-0.5 text-right text-[10px] text-muted-foreground">{summary.length}/150</div>
              </div>

              {/* 标签 */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">标签（用顿号分隔）</label>
                <Input
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="沙特、商务签证、2026"
                />
              </div>

              <Separator className="my-2" />

              {/* 内容块列表 */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">正文内容</h3>
                  <span className="text-[10px] text-muted-foreground">{blocks.length} 个内容块</span>
                </div>
                {blocks.map((block, index) => renderEditBlock(block, index))}
              </div>

              {/* 底部添加 Block */}
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-zinc-300 bg-white p-3">
                <span className="text-xs text-muted-foreground">添加内容块：</span>
                {(['heading', 'paragraph', 'image', 'list', 'table', 'tip', 'quote'] as BlockType[]).map(bt => (
                  <button
                    key={bt}
                    onClick={() => addBlock(bt)}
                    className="flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600 transition-colors hover:bg-blue-100 hover:text-blue-700"
                  >
                    {bt === 'heading' && <Type className="size-3" />}
                    {bt === 'paragraph' && <Edit3 className="size-3" />}
                    {bt === 'image' && <ImageIcon className="size-3" />}
                    {bt === 'list' && <List className="size-3" />}
                    {bt === 'table' && <Table className="size-3" />}
                    {bt === 'tip' && <AlertTriangle className="size-3" />}
                    {bt === 'quote' && <Quote className="size-3" />}
                    {BLOCK_LABELS[bt]}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* ═══ 预览模式 — C 端图文混排 ═══ */
            <Card className="bg-white shadow-sm overflow-hidden">
              {/* 封面图 */}
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={coverImage}
                  alt="封面"
                  className="h-52 w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-6">
                  <h1 className="text-2xl font-bold text-white leading-snug">{title || '未命名文章'}</h1>
                </div>
              </div>

              <div className="px-6 py-5 md:px-8 md:py-6">
                {/* 元信息 */}
                <div className="mb-5 flex items-center gap-3 text-xs text-zinc-400">
                  <span className="flex items-center gap-1">
                    <div className="size-5 rounded-full bg-blue-100 flex items-center justify-center text-[10px]">Z</div>
                    ZSTS签证通
                  </span>
                  <span>·</span>
                  <span>约 {totalWords} 字</span>
                </div>

                {/* 摘要 */}
                {summary && (
                  <div className="mb-6 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 px-5 py-4 text-sm leading-relaxed text-zinc-600">
                    <span className="mr-1.5 text-blue-500 font-bold">摘要</span>{summary}
                  </div>
                )}

                <Separator className="mb-6" />

                {/* 正文块 */}
                <div className="pb-4">
                  {blocks.map(block => renderPreviewBlock(block))}
                </div>

                {/* 底部版权 */}
                <div className="mt-6 rounded-xl bg-zinc-50 px-5 py-4 text-center text-xs text-zinc-400">
                  <p className="font-medium text-zinc-500">ZSTS签证通 · 专业沙特签证服务</p>
                  <p className="mt-1">本文内容仅供参考，具体政策以官方公告为准</p>
                </div>
              </div>
            </Card>
          )}

          {/* 底部分发区域 */}
          <div className="mt-6 rounded-xl border bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold">分发渠道</h3>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => toggleDistribution('cms')}
                className={`flex items-center gap-3 rounded-lg border p-4 text-left transition-all ${
                  distribution.cms
                    ? 'border-blue-400 bg-blue-50 shadow-sm'
                    : 'border-blue-100 bg-blue-50/50 hover:border-blue-300 hover:shadow-sm'
                }`}
              >
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#1D4ED8] text-white">
                  {distribution.cms ? <Check className="size-5" /> : <Globe className="size-5" />}
                </div>
                <div>
                  <p className="text-sm font-medium text-zinc-800">CMS 官网</p>
                  <p className="text-xs text-muted-foreground">沙特资讯</p>
                </div>
              </button>
              <button
                onClick={() => toggleDistribution('wechat')}
                className={`flex items-center gap-3 rounded-lg border p-4 text-left transition-all ${
                  distribution.wechat
                    ? 'border-green-400 bg-green-50 shadow-sm'
                    : 'border-green-100 bg-green-50/50 hover:border-green-300 hover:shadow-sm'
                }`}
              >
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#07C160] text-white">
                  {distribution.wechat ? <Check className="size-5" /> : <MessageCircle className="size-5" />}
                </div>
                <div>
                  <p className="text-sm font-medium text-zinc-800">公众号</p>
                  <p className="text-xs text-muted-foreground">推送到草稿箱</p>
                </div>
              </button>
            </div>
          </div>

          {/* 底部操作 */}
          <div className="mt-4 flex items-center justify-between">
            <Link href="/create">
              <Button variant="ghost" size="sm" className="gap-1.5">
                <ArrowLeft className="size-3.5" />
                返回 AI 助手
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => {
                  const plainText = `${title}\n\n${summary}\n\n${blocks.map(b => {
                    if (b.type === 'heading') return `\n【${b.content}】\n`;
                    if (b.type === 'paragraph') return `${b.content}\n`;
                    if (b.type === 'image') return `[图片${b.imageDesc ? `：${b.imageDesc}` : ''}]\n`;
                    if (b.type === 'list') return `${b.content}\n${b.items?.map(i => `• ${i}`).join('\n') || ''}\n`;
                    if (b.type === 'tip') return `💡 ${b.content}\n`;
                    if (b.type === 'quote') return `💬 ${b.content}\n`;
                    if (b.type === 'table') return `${b.rows?.map(r => r.join(' | ')).join('\n') || ''}\n`;
                    return '';
                  }).join('\n')}`;
                  navigator.clipboard.writeText(plainText).then(() => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  });
                }}
              >
                {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                {copied ? '已复制' : '复制图文'}
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={handleSave}>
                {saved ? (
                  <><Check className="size-3.5" />已保存</>
                ) : (
                  <><Save className="size-3.5" />保存文章</>
                )}
              </Button>
              <Button size="sm" className="gap-1.5" onClick={() => { handleSave(); setPublished(true); }}>
                {published ? (
                  <><Check className="size-3.5" />已发布</>
                ) : (
                  <><Send className="size-3.5" />保存并发布</>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* ── 图片选择器弹窗 ── */}
      {imagePickerTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={closeImagePicker}>
          <div className="mx-4 max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">选择图片</h3>
              <button onClick={closeImagePicker} className="rounded-full p-1 hover:bg-zinc-100">
                <X className="size-5 text-zinc-400" />
              </button>
            </div>

            {/* Tab 切换 */}
            <div className="mb-4 flex gap-1 rounded-lg bg-zinc-100 p-1">
              {[
                { key: 'pexels' as const, label: 'Pexels 图库', icon: Search },
                { key: 'upload' as const, label: '上传图片', icon: Upload },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setImagePickerTab(tab.key)}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-all ${
                    imagePickerTab === tab.key
                      ? 'bg-white text-zinc-900 shadow-sm'
                      : 'text-zinc-500 hover:text-zinc-700'
                  }`}
                >
                  <tab.icon className="size-3.5" />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Pexels 搜索 */}
            {imagePickerTab === 'pexels' && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">搜索免费高质量图片</p>
                <div className="flex gap-2">
                  <Input
                    value={imagePickerQuery}
                    onChange={(e) => setImagePickerQuery(e.target.value)}
                    placeholder="搜索关键词，如：saudi arabia, business, visa..."
                    onKeyDown={(e) => { if (e.key === 'Enter') handlePexelsSearch(); }}
                  />
                  <Button onClick={handlePexelsSearch} disabled={imagePickerLoading} variant="outline" className="shrink-0">
                    {imagePickerLoading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
                  </Button>
                </div>
                {pexelsResults.length > 0 && (
                  <div className="grid grid-cols-2 gap-2">
                    {pexelsResults.map((img, idx) => (
                      <button
                        key={idx}
                        onClick={() => applyImage(img.url)}
                        className="group/pexels relative overflow-hidden rounded-lg border border-zinc-100 transition-all hover:border-blue-300 hover:shadow-md"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={img.url} alt={img.desc} className="h-28 w-full object-cover" />
                        <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/50 to-transparent opacity-0 transition-opacity group-hover/pexels:opacity-100">
                          <span className="px-2 pb-2 text-xs text-white">{img.desc}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {!imagePickerLoading && pexelsResults.length === 0 && (
                  <div className="flex flex-col items-center py-8 text-zinc-400">
                    <Search className="mb-2 size-8" />
                    <p className="text-sm">输入关键词搜索图片</p>
                  </div>
                )}
              </div>
            )}

            {/* 上传图片 */}
            {imagePickerTab === 'upload' && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">上传本地图片文件</p>
                <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-zinc-200 bg-zinc-50 py-10 transition-colors hover:border-blue-300 hover:bg-blue-50/30">
                  <Upload className="mb-2 size-8 text-zinc-300" />
                  <p className="text-sm font-medium text-zinc-500">点击选择文件</p>
                  <p className="mt-1 text-xs text-zinc-400">支持 JPG / PNG / WebP，建议宽度 800px 以上</p>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </label>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ArticlePage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-[#F5F5F7]">
          <Loader2 className="size-6 animate-spin text-blue-600" />
        </div>
      }
    >
      <ArticleEditorInner />
    </Suspense>
  );
}
