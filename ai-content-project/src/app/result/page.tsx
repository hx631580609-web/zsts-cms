'use client';

import { useState, useCallback, useRef, Suspense } from 'react';
import html2canvas from 'html2canvas-pro';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Download,
  Pencil,
  RefreshCw,
  Image,
  Film,
  CheckCircle2,
  ExternalLink,
  Share2,
  FileText,
  Globe,
  MessageCircle,
  Video,
  Smartphone,
  Copy,
  Check,
  Hash,
  Type,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Loader2,
  Phone,
  Music,
  Upload,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { CONTENT_ITEMS } from '@/lib/data';

type VideoPlatform = 'weixin' | 'douyin' | 'xiaohongshu' | null;

// ── 海报内页数据结构 ──
interface PosterSection {
  heading: string;
  items: string[];
}

interface PosterData {
  // 封面
  topTagline: string;
  mainTitle: string;
  subTitleTag1: string;
  subTitleTag2: string;
  bgImageId: string;
  bgImageUrl: string;
  accent: string;
  overlay: string;
  tagBg: string;
  tagText: string;
  prices: Array<{ amount: string; label: string; badge: string }>;
  bottomSlogan: string;
  // 内页
  innerTitle: string;
  innerSections: PosterSection[];
  contactPhone: string;
}

// ── 海报内容（模拟从编辑器传来的数据） ──
const POSTER_DATA: PosterData = {
  topTagline: '探索无界 商旅无忧',
  mainTitle: '沙特商务签证',
  subTitleTag1: '2026最新政策',
  subTitleTag2: '专业办理',
  bgImageId: 'desert-dunes',
  bgImageUrl: '',
  accent: '#D4A843',
  overlay: 'linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.3) 50%, rgba(0,0,0,0.65) 100%)',
  tagBg: '#1a5c2a',
  tagText: '#FFFFFF',
  prices: [
    { amount: '1280', label: '标准办理', badge: '真纯玩' },
    { amount: '1980', label: '加急办理', badge: '极速签' },
    { amount: '880', label: '落地签', badge: '说走就走' },
  ],
  bottomSlogan: '专业签证服务 · 让商旅更简单',
  innerTitle: '办理流程 & 材料清单',
  innerSections: [
    {
      heading: '所需材料',
      items: [
        '有效护照（6个月以上有效期）',
        '2寸白底照片2张',
        '沙特方邀请函原件',
        '公司营业执照复印件加盖公章',
        '在职证明信（中英文）',
        '往返机票预订单',
        '酒店预订确认函',
      ],
    },
    {
      heading: '办理流程',
      items: [
        '1. 准备并提交材料',
        '2. 材料审核与整理（1-2个工作日）',
        '3. 递交沙特驻华使馆',
        '4. 等待使馆审核出签',
        '5. 签证送达，确认签发',
      ],
    },
    {
      heading: '办理周期',
      items: [
        '普通办理：7-15个工作日',
        '加急办理：3-5个工作日',
        '落地签：即时办理',
      ],
    },
    {
      heading: '注意事项',
      items: [
        '签证有效期以使馆审批为准',
        '入境后需在规定时间内办理居住证',
        '商务签证不可转为工作签证',
        '需遵守沙特当地法律法规',
      ],
    },
  ],
  contactPhone: '400-888-6666',
};

// ── 将内页内容自动分页 ──
function paginateInnerSections(
  sections: PosterSection[],
  maxItemsPerPage: number = 8
): PosterSection[][] {
  const pages: PosterSection[][] = [];
  let currentPage: PosterSection[] = [];
  let currentItemCount = 0;

  for (const section of sections) {
    const sectionItems = section.items.length;

    if (currentItemCount + sectionItems > maxItemsPerPage && currentPage.length > 0) {
      pages.push(currentPage);
      currentPage = [];
      currentItemCount = 0;
    }

    // 如果单个板块就超过一页容量，拆分该板块
    if (sectionItems > maxItemsPerPage) {
      let remaining = [...section.items];
      while (remaining.length > 0) {
        const chunk = remaining.slice(0, maxItemsPerPage);
        currentPage.push({ heading: section.heading, items: chunk });
        currentItemCount += chunk.length;
        remaining = remaining.slice(maxItemsPerPage);
        if (remaining.length > 0 || currentItemCount >= maxItemsPerPage) {
          pages.push(currentPage);
          currentPage = [];
          currentItemCount = 0;
        }
      }
    } else {
      currentPage.push(section);
      currentItemCount += sectionItems;
    }
  }

  if (currentPage.length > 0) {
    pages.push(currentPage);
  }

  return pages;
}

const PLATFORM_CONFIG: Record<string, {
  name: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  borderColor: string;
  title: string;
  hashtags: string[];
  description: string;
  publishUrl: string;
}> = {
  weixin: {
    name: '视频号',
    icon: <Video className="size-5" />,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
    title: '2026年沙特商务签证最新办理指南',
    hashtags: ['#沙特签证', '#商务签证', '#沙特商务', '#签证攻略', '#出国签证'],
    description: '一分钟了解沙特商务签证办理全流程，材料清单+办理周期+注意事项，建议收藏！',
    publishUrl: 'https://channels.weixin.qq.com/platform/video/create',
  },
  douyin: {
    name: '抖音',
    icon: <Smartphone className="size-5" />,
    color: 'text-gray-800',
    bgColor: 'bg-gray-50',
    borderColor: 'border-gray-200',
    title: '沙特商务签证怎么办？2026最新攻略来了！',
    hashtags: ['#沙特签证', '#商务签证', '#签证办理', '#沙特', '#出国'],
    description: '2026年沙特商务签证办理全攻略，所需材料+办理流程+注意事项一网打尽！',
    publishUrl: 'https://creator.douyin.com/creator-micro/content/upload',
  },
  xiaohongshu: {
    name: '小红书',
    icon: <Share2 className="size-5" />,
    color: 'text-red-500',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    title: '沙特商务签证2026最新办理指南｜超详细攻略',
    hashtags: ['#沙特签证', '#商务签证', '#沙特商务', '#签证攻略', '#出国准备', '#小红书签证'],
    description: '2026年沙特商务签证办理全流程分享！从准备材料到出签，手把手教你搞定沙特商务签证～',
    publishUrl: 'https://creator.xiaohongshu.com/publish/publish',
  },
};

// ── 视频生成状态 ──
type VideoGenStatus = 'idle' | 'generating' | 'success' | 'error';

function ResultPageInner() {
  const searchParams = useSearchParams();
  const contentId = searchParams.get('contentId') || '1';

  const contentItem = CONTENT_ITEMS.find((c) => c.id === contentId) ?? CONTENT_ITEMS[0];

  const [posterDistType, setPosterDistType] = useState('original');
  const [expandedPlatforms, setExpandedPlatforms] = useState<Set<VideoPlatform>>(new Set());
  const [copiedStates, setCopiedStates] = useState<Record<string, boolean>>({});
  const [posterDownloaded, setPosterDownloaded] = useState(false);
  const [videoDownloaded, setVideoDownloaded] = useState(false);

  // 海报翻页
  const [currentPosterPage, setCurrentPosterPage] = useState(0);
  const poster = POSTER_DATA;
  const innerPages = paginateInnerSections(poster.innerSections);
  const totalPages = 1 + innerPages.length; // 封面 + 内页

  // 视频生成
  const [videoStatus, setVideoStatus] = useState<VideoGenStatus>('idle');
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);

  // BGM 选项
  const [bgmMode, setBgmMode] = useState<'ai' | 'upload'>('ai');
  const [uploadedBgmName, setUploadedBgmName] = useState<string | null>(null);

  const handleCopy = async (text: string, setCopied: (v: boolean) => void) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCopyByKey = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopiedStates((prev) => ({ ...prev, [key]: true }));
    setTimeout(() => setCopiedStates((prev) => ({ ...prev, [key]: false })), 2000);
  };

  // 海报页面 ref（用于截图合成视频）
  const posterPageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [videoProgress, setVideoProgress] = useState(0);
  const [isExportingPng, setIsExportingPng] = useState(false);

  // ── 导出所有海报页面为 PNG ──
  const handleExportAllPng = useCallback(async () => {
    setIsExportingPng(true);
    try {
      for (let i = 0; i < totalPages; i++) {
        const el = fullSizeRefs.current[i];
        if (!el) continue;
        const canvas = await html2canvas(el, {
          scale: 1,
          useCORS: true,
          allowTaint: true,
          backgroundColor: null,
          width: 1080,
          height: 1920,
        });
        const link = document.createElement('a');
        link.download = i === 0 ? 'poster-cover.png' : `poster-page-${i}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
      }
    } catch (err) {
      console.error('导出 PNG 失败', err);
    }
    setIsExportingPng(false);
  }, [totalPages]);

  // 生成视频 — 先将海报每页导出为 PNG，再用 PNG 合成视频
  const handleGenerateVideo = useCallback(async () => {
    setVideoStatus('generating');
    setVideoError(null);
    setVideoUrl(null);
    setVideoProgress(0);

    try {
      // 1. 逐页截图隐藏的全尺寸海报区域，导出为高清 PNG 图片
      const pngImages: HTMLImageElement[] = [];

      for (let i = 0; i < totalPages; i++) {
        setVideoProgress(Math.round(((i + 0.5) / totalPages) * 40));

        const el = fullSizeRefs.current[i];
        if (!el) throw new Error(`海报第 ${i + 1} 页未渲染`);

        const canvas = await html2canvas(el, {
          scale: 1,
          useCORS: true,
          allowTaint: true,
          backgroundColor: null,
          width: 1080,
          height: 1920,
        });
        // 转为高清 PNG Image
        const dataUrl = canvas.toDataURL('image/png');
        const img = new window.Image();
        img.src = dataUrl;
        await new Promise<void>((resolve) => { img.onload = () => resolve(); });
        pngImages.push(img);
      }

      setVideoProgress(40);

      // 2. 在 Canvas 上逐页播放 PNG 图片，录制为视频
      const canvasEl = document.createElement('canvas');
      canvasEl.width = 1080;
      canvasEl.height = 1920;
      const ctx = canvasEl.getContext('2d');
      if (!ctx) throw new Error('Canvas 2D 上下文创建失败');

      // 3. 设置音频源（如果有 BGM）
      let audioCtx: AudioContext | null = null;
      let audioSource: MediaElementAudioSourceNode | null = null;
      let audioDestination: MediaStreamAudioDestinationNode | null = null;
      let bgmElement: HTMLAudioElement | null = null;

      if (bgmMode === 'upload' && uploadedBgmName) {
        // 查找隐藏的 audio 元素
        const audioEl = document.getElementById('bgm-audio-upload') as HTMLAudioElement | null;
        if (audioEl && audioEl.src) {
          audioCtx = new AudioContext();
          const source = audioCtx.createMediaElementSource(audioEl);
          audioSource = source;
          audioDestination = audioCtx.createMediaStreamDestination();
          source.connect(audioDestination);
          source.connect(audioCtx.destination); // 也输出到扬声器
          bgmElement = audioEl;
        }
      }

      // 4. 创建 MediaRecorder
      const canvasStream = canvasEl.captureStream(30);
      const combinedStream = new MediaStream([
        ...canvasStream.getVideoTracks(),
        ...(audioDestination ? audioDestination.stream.getAudioTracks() : []),
      ]);

      const mimeTypes = [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm;codecs=vp9',
        'video/webm;codecs=vp8',
        'video/webm',
      ];
      const mimeType = mimeTypes.find((mt) => MediaRecorder.isTypeSupported(mt)) || 'video/webm';

      const recorder = new MediaRecorder(combinedStream, {
        mimeType,
        videoBitsPerSecond: 5_000_000,
      });

      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      const recordingDone = new Promise<Blob>((resolve) => {
        recorder.onstop = () => {
          const blob = new Blob(chunks, { type: mimeType });
          resolve(blob);
        };
      });

      // 5. 开始录制
      recorder.start(100);

      // 播放 BGM
      if (bgmElement) {
        bgmElement.currentTime = 0;
        bgmElement.play().catch(() => {});
      }

      // 6. 逐页绘制
      const secondsPerPage = 3; // 每页显示 3 秒
      const fps = 30;
      const framesPerPage = secondsPerPage * fps;
      const totalFrames = framesPerPage * pngImages.length;
      let frameIndex = 0;

      const drawNextFrame = () => {
        if (frameIndex >= totalFrames) {
          recorder.stop();
          if (bgmElement) bgmElement.pause();
          if (audioCtx) audioCtx.close().catch(() => {});
          return;
        }

        const pageIndex = Math.floor(frameIndex / framesPerPage);
        const frameInPage = frameIndex % framesPerPage;
        const img = pngImages[pageIndex];

        if (img) {
          // 淡入淡出效果：前 0.3s 淡入，后 0.3s 淡出
          ctx!.clearRect(0, 0, canvasEl.width, canvasEl.height);
          const fadeInFrames = Math.round(0.3 * fps);
          const fadeOutFrames = Math.round(0.3 * fps);

          let alpha = 1;
          if (frameInPage < fadeInFrames) {
            alpha = frameInPage / fadeInFrames;
          } else if (frameInPage > framesPerPage - fadeOutFrames) {
            alpha = (framesPerPage - frameInPage) / fadeOutFrames;
          }

          ctx!.globalAlpha = alpha;
          // 将 PNG 图片等比缩放绘制到 1080×1920 Canvas
          const scale = Math.min(canvasEl.width / img.width, canvasEl.height / img.height);
          const drawW = img.width * scale;
          const drawH = img.height * scale;
          const offsetX = (canvasEl.width - drawW) / 2;
          const offsetY = (canvasEl.height - drawH) / 2;
          ctx!.drawImage(img, offsetX, offsetY, drawW, drawH);
          ctx!.globalAlpha = 1;
        }

        frameIndex++;
        setVideoProgress(40 + Math.round((frameIndex / totalFrames) * 60));
        requestAnimationFrame(drawNextFrame);
      };

      requestAnimationFrame(drawNextFrame);

      // 7. 等待录制完成
      const videoBlob = await recordingDone;
      const url = URL.createObjectURL(videoBlob);
      setVideoUrl(url);
      setVideoStatus('success');
      setVideoProgress(100);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '视频合成异常';
      setVideoError(msg);
      setVideoStatus('error');
    }
  }, [totalPages, bgmMode, uploadedBgmName]);

  const hasArticle = contentItem.generatedTypes.includes('文章');
  const hasPoster = contentItem.generatedTypes.includes('海报');
  const hasVideo = contentItem.hasVideo;

  const togglePlatform = (key: VideoPlatform) => {
    setExpandedPlatforms((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // ── 渲染封面页（refId 用于视频合成截图） ──
  const renderCoverPage = (refId?: number) => (
    <div
      ref={refId !== undefined ? (el) => { posterPageRefs.current[refId] = el; } : undefined}
      className="aspect-[9/16] w-full relative overflow-hidden bg-black"
    >
      {/* 背景 — CSS 渐变代替外部图片 */}
      <div
        className="absolute inset-0"
        style={{
          background: poster.bgImageUrl
            ? `url(${poster.bgImageUrl}) center/cover no-repeat`
            : 'linear-gradient(160deg, #0f2027 0%, #203a43 30%, #2c5364 60%, #1a1a2e 100%)',
        }}
      />
      {/* 渐变遮罩 */}
      <div className="absolute inset-0" style={{ background: poster.overlay }} />

      {/* 内容层 */}
      <div className="relative flex h-full flex-col justify-between px-5 py-8">
        {/* 顶部：情感标语 */}
        <div className="pt-6 text-center">
          <p className="text-base italic tracking-wider text-white/80 font-light">
            {poster.topTagline}
          </p>
          <div className="mx-auto mt-3 flex items-center justify-center gap-3">
            <span className="h-px w-10 bg-white/30" />
            <span className="text-xs text-white/40">Heart</span>
            <span className="h-px w-10 bg-white/30" />
          </div>
        </div>

        {/* 中部：主标题 + 副标题标签 */}
        <div className="text-center -mt-4">
          <h1 className="text-[2.2rem] font-extrabold leading-tight tracking-wide text-white drop-shadow-lg">
            {poster.mainTitle}
          </h1>
          <div className="mt-3 flex items-center justify-center gap-0">
            <span
              className="rounded-l-full px-3 py-1 text-xs font-medium"
              style={{ backgroundColor: 'rgba(255,255,255,0.95)', color: poster.tagBg }}
            >
              {poster.subTitleTag1}
            </span>
            <span
              className="rounded-r-full px-3 py-1 text-xs font-medium"
              style={{ backgroundColor: poster.tagBg, color: poster.tagText }}
            >
              {poster.subTitleTag2}
            </span>
          </div>
        </div>

        {/* 下部：价格卡片横排 */}
        <div>
          <div className="flex justify-center gap-3">
            {poster.prices.filter((p) => p.amount).map((price, i) => (
              <div key={i} className="flex flex-col items-center">
                <p className="text-2xl font-extrabold text-white drop-shadow-md">
                  ¥{price.amount}
                </p>
                <p className="text-[9px] text-white/60 mt-0.5">
                  {price.label}
                </p>
                {price.badge && (
                  <span
                    className="mt-1.5 flex size-9 items-center justify-center rounded-full text-[8px] font-bold leading-tight text-center"
                    style={{ backgroundColor: poster.tagBg, color: poster.tagText }}
                  >
                    {price.badge}
                  </span>
                )}
              </div>
            ))}
          </div>
          <div className="mt-6 text-center">
            <div className="mx-auto mb-2 h-px w-12 bg-white/20" />
            <p className="text-[10px] tracking-widest text-white/40">
              {poster.bottomSlogan}
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  // ── 渲染内页（refId 用于视频合成截图） ──
  const renderInnerPage = (pageIndex: number, refId?: number) => {
    const sections = innerPages[pageIndex];
    if (!sections) return null;
    const isLastInnerPage = pageIndex === innerPages.length - 1;
    const innerOverlay = 'linear-gradient(180deg, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.7) 40%, rgba(0,0,0,0.85) 100%)';

    return (
      <div
        ref={refId !== undefined ? (el) => { posterPageRefs.current[refId] = el; } : undefined}
        className="aspect-[9/16] w-full relative overflow-hidden"
        style={{
          background: poster.bgImageUrl
            ? `url(${poster.bgImageUrl}) center/cover no-repeat`
            : 'linear-gradient(160deg, #0f2027 0%, #203a43 30%, #2c5364 60%, #1a1a2e 100%)',
        }}
      >
        {/* 遮罩 */}
        <div className="absolute inset-0" style={{ background: innerOverlay }} />
        {/* 顶部装饰线 */}
        <div className="absolute top-0 left-0 right-0 h-1" style={{ background: poster.accent }} />

        {/* 内容 */}
        <div className="relative flex h-full flex-col p-5 pt-6">
          {/* 标题 */}
          <div className="mb-4 text-center">
            <h2 className="text-lg font-bold text-white">
              {poster.innerTitle}
            </h2>
            <div className="mx-auto mt-2 h-0.5 w-10" style={{ background: poster.accent }} />
          </div>

          {/* 内容板块 */}
          <div className="flex-1 space-y-3 overflow-hidden">
            {sections.map((section, si) => (
              <div
                key={si}
                className="rounded-lg p-3"
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  border: `1px solid ${poster.accent}20`,
                }}
              >
                <div className="mb-2 flex items-center gap-2">
                  <span
                    className="h-3 w-1 rounded-full"
                    style={{ background: poster.accent }}
                  />
                  <span className="text-xs font-semibold text-white">
                    {section.heading}
                  </span>
                </div>
                <ul className="space-y-1 pl-3">
                  {section.items.map((item, ii) => (
                    <li
                      key={ii}
                      className="flex items-start gap-1.5 text-[10px] leading-relaxed text-white/70"
                    >
                      <span
                        className="mt-1.5 shrink-0 h-1 w-1 rounded-full"
                        style={{ background: poster.accent }}
                      />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* 最后一页：价格 + 联系方式 */}
          {isLastInnerPage && (
            <div className="mt-3">
              {poster.prices.filter((p) => p.amount).length > 0 && (
                <div className="flex justify-center gap-3 mb-3">
                  {poster.prices.filter((p) => p.amount).map((price, i) => (
                    <div
                      key={i}
                      className="text-center rounded-lg px-3 py-1.5"
                      style={{
                        background: `${poster.accent}15`,
                        border: `1px solid ${poster.accent}25`,
                      }}
                    >
                      <p className="text-[9px] text-white/60">{price.label}</p>
                      <p className="text-sm font-bold" style={{ color: poster.accent }}>
                        ¥{price.amount}
                      </p>
                    </div>
                  ))}
                </div>
              )}
              <div
                className="text-center rounded-lg py-2"
                style={{ background: `${poster.accent}20` }}
              >
                <div className="flex items-center justify-center gap-1.5 text-[10px] text-white/70">
                  <Phone className="size-3" style={{ color: poster.accent }} />
                  <span>{poster.contactPhone}</span>
                </div>
                <p className="mt-0.5 text-[8px] text-white/40">
                  {poster.bottomSlogan}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ── 渲染当前海报页面（使用带 ref 的渲染函数） ──
  const renderCurrentPosterPage = () => {
    if (currentPosterPage === 0) {
      return renderCoverPage(0);
    }
    return renderInnerPage(currentPosterPage - 1, currentPosterPage);
  };

  // ── 上传的 BGM 文件 URL ──
  const [uploadedBgmUrl, setUploadedBgmUrl] = useState<string | null>(null);

  // ── 隐藏全尺寸渲染区的 ref（1080×1920，用于视频截图） ──
  const fullSizeRefs = useRef<(HTMLDivElement | null)[]>([]);

  return (
    <div className="min-h-screen bg-[#F5F5F7]">
      {/* 顶部标题栏 */}
      <header className="sticky top-0 z-20 border-b bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-3 px-4">
          <Link href="/">
            <Button variant="ghost" size="icon-sm" className="shrink-0">
              <ArrowLeft className="size-4" />
            </Button>
          </Link>
          <Separator orientation="vertical" className="h-5" />
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-foreground">
              生成结果
            </span>
            <span className="text-xs text-muted-foreground">
              ZSTS 内容后台
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-4 px-4 pt-4">
        {/* 源内容信息 */}
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-indigo-50">
              <Film className="size-5 text-indigo-600" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-foreground">
                {contentItem.title}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                {contentItem.generatedTypes.map((type) => (
                  <Badge
                    key={type}
                    variant="outline"
                    className={
                      type === '文章'
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : 'border-indigo-200 bg-indigo-50 text-indigo-700'
                    }
                  >
                    {type === '文章' ? '📰' : '🖼️'} {type}
                  </Badge>
                ))}
                {hasVideo && (
                  <Badge
                    variant="outline"
                    className="border-amber-200 bg-amber-50 text-amber-700"
                  >
                    🎬 视频
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 海报预览 */}
        {hasPoster && (
          <section className="rounded-xl border bg-white shadow-sm">
            <div className="px-5 pt-5 pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Image className="size-4 text-indigo-600" />
                  <h3 className="text-sm font-semibold">海报</h3>
                  <Badge variant="outline" className="text-[10px]">
                    共 {totalPages} 页
                  </Badge>
                </div>
                {/* 翻页控制 */}
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={currentPosterPage === 0}
                    onClick={() => setCurrentPosterPage(Math.max(0, currentPosterPage - 1))}
                  >
                    <ChevronLeft className="size-4" />
                  </Button>
                  <span className="min-w-[3rem] text-center text-xs text-muted-foreground">
                    {currentPosterPage + 1} / {totalPages}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={currentPosterPage >= totalPages - 1}
                    onClick={() => setCurrentPosterPage(Math.min(totalPages - 1, currentPosterPage + 1))}
                  >
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              </div>
            </div>
            <Separator />

            {/* 海报预览区 */}
            <div className="flex justify-center px-5 py-6">
              <div className="relative mx-auto w-full max-w-[260px] overflow-hidden rounded-lg border shadow-md">
                {renderCurrentPosterPage()}
                {/* 尺寸标签 */}
                <div className="absolute right-2 top-2 rounded bg-black/50 px-1.5 py-0.5 text-[10px] text-white">
                  1080×1920
                </div>
                {/* 页码指示 */}
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-full bg-black/40 px-2 py-0.5 backdrop-blur-sm">
                  {Array.from({ length: totalPages }).map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setCurrentPosterPage(i)}
                      className={`h-1.5 rounded-full transition-all ${
                        i === currentPosterPage
                          ? 'w-3 bg-white'
                          : 'w-1.5 bg-white/40'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* 页面标签 */}
            <div className="flex items-center justify-center gap-2 px-5 pb-2">
              <button
                type="button"
                onClick={() => setCurrentPosterPage(0)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  currentPosterPage === 0
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                封面
              </button>
              {innerPages.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setCurrentPosterPage(i + 1)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    currentPosterPage === i + 1
                      ? 'bg-indigo-100 text-indigo-700'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  内页 {i + 1}
                </button>
              ))}
            </div>

            {/* 海报操作按钮 */}
            <div className="flex items-center justify-center gap-3 border-t px-5 py-4">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={async () => {
                  await handleExportAllPng();
                  setPosterDownloaded(true);
                  setTimeout(() => setPosterDownloaded(false), 2000);
                }}
                disabled={isExportingPng}
              >
                {isExportingPng ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    导出中...
                  </>
                ) : posterDownloaded ? (
                  <>
                    <CheckCircle2 className="size-3.5 text-emerald-500" />
                    已下载
                  </>
                ) : (
                  <>
                    <Download className="size-3.5" />
                    下载全部PNG
                  </>
                )}
              </Button>
              <Link href={`/poster?contentId=${contentId}`}>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Pencil className="size-3.5" />
                  重新编辑
                </Button>
              </Link>
            </div>
          </section>
        )}

        {/* 视频预览 */}
        {hasVideo && (
          <section className="rounded-xl border bg-white shadow-sm">
            <div className="px-5 pt-5 pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Film className="size-4 text-amber-600" />
                  <h3 className="text-sm font-semibold">视频</h3>
                  {videoStatus === 'success' && (
                    <Badge
                      variant="outline"
                      className="gap-1 border-emerald-200 bg-emerald-50 text-xs text-emerald-700"
                    >
                      <CheckCircle2 className="size-3" />
                      已生成
                    </Badge>
                  )}
                  {videoStatus === 'generating' && (
                    <Badge
                      variant="outline"
                      className="gap-1 border-amber-200 bg-amber-50 text-xs text-amber-700"
                    >
                      <Loader2 className="size-3 animate-spin" />
                      生成中
                    </Badge>
                  )}
                </div>
              </div>
              {/* 海报合并说明 */}
              <p className="mt-1 text-xs text-muted-foreground">
                基于海报页面合成视频，自动匹配背景音乐
              </p>
            </div>
            <Separator />

            {/* BGM 选择区 — 生成前显示 */}
            {videoStatus === 'idle' || videoStatus === 'error' ? (
              <div className="space-y-3 px-5 py-5">
                {/* BGM 模式选择 */}
                <div>
                  <Label className="text-sm font-medium">背景音乐</Label>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setBgmMode('ai')}
                      className={`flex flex-1 items-center gap-2 rounded-lg border px-4 py-3 text-left transition-colors ${
                        bgmMode === 'ai'
                          ? 'border-blue-200 bg-blue-50/50'
                          : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <Sparkles className={`size-4 ${bgmMode === 'ai' ? 'text-blue-600' : 'text-gray-400'}`} />
                      <div>
                        <p className={`text-sm font-medium ${bgmMode === 'ai' ? 'text-blue-700' : 'text-gray-700'}`}>
                          AI 匹配 BGM
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          根据内容风格自动匹配
                        </p>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setBgmMode('upload')}
                      className={`flex flex-1 items-center gap-2 rounded-lg border px-4 py-3 text-left transition-colors ${
                        bgmMode === 'upload'
                          ? 'border-blue-200 bg-blue-50/50'
                          : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <Upload className={`size-4 ${bgmMode === 'upload' ? 'text-blue-600' : 'text-gray-400'}`} />
                      <div>
                        <p className={`text-sm font-medium ${bgmMode === 'upload' ? 'text-blue-700' : 'text-gray-700'}`}>
                          上传 BGM
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          上传自定义背景音乐
                        </p>
                      </div>
                    </button>
                  </div>
                </div>

                {/* 上传 BGM 区域 */}
                {bgmMode === 'upload' && (
                  <div className="rounded-lg border-2 border-dashed border-gray-200 p-4 text-center">
                    {uploadedBgmName ? (
                      <div className="flex items-center justify-center gap-2">
                        <Music className="size-4 text-blue-500" />
                        <span className="text-sm text-foreground">{uploadedBgmName}</span>
                        <button
                          type="button"
                          onClick={() => setUploadedBgmName(null)}
                          className="ml-2 text-xs text-muted-foreground hover:text-foreground"
                        >
                          移除
                        </button>
                      </div>
                    ) : (
                      <label className="cursor-pointer">
                        <Music className="mx-auto size-6 text-gray-300" />
                        <p className="mt-2 text-sm text-muted-foreground">
                          点击上传 MP3/WAV 文件
                        </p>
                        <input
                          type="file"
                          accept="audio/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setUploadedBgmName(file.name);
                              setUploadedBgmUrl(URL.createObjectURL(file));
                            }
                          }}
                        />
                      </label>
                    )}
                  </div>
                )}

                {/* 海报页面预览缩略 */}
                <div>
                  <Label className="text-xs text-muted-foreground">视频素材：海报 {totalPages} 页</Label>
                  <div className="mt-2 flex gap-2">
                    {Array.from({ length: totalPages }).map((_, i) => (
                      <div
                        key={i}
                        className="h-14 w-8 rounded-sm border border-gray-200 bg-gradient-to-b from-indigo-100 to-indigo-200 flex items-center justify-center"
                      >
                        <span className="text-[8px] text-indigo-400">{i === 0 ? '封面' : `${i}`}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 生成按钮 */}
                <Button
                  className="w-full gap-2"
                  onClick={handleGenerateVideo}
                >
                  <Film className="size-4" />
                  {videoStatus === 'error' ? '重新生成视频' : '生成视频'}
                </Button>
                {videoStatus === 'error' && videoError && (
                  <p className="text-center text-xs text-destructive">{videoError}</p>
                )}
              </div>
            ) : (
              <>
                {/* 视频区域 */}
                <div className="flex justify-center px-5 py-6">
                  <div className="relative mx-auto w-full max-w-[260px] overflow-hidden rounded-lg border bg-black shadow-inner">
                    {videoStatus === 'generating' && (
                      <div className="aspect-[9/16] w-full">
                        <div
                          className="h-full w-full"
                          style={{
                            background:
                              'linear-gradient(180deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
                          }}
                        >
                          <div className="flex h-full flex-col items-center justify-center text-white">
                            <div className="text-center space-y-4">
                              <div className="relative">
                                <Loader2 className="size-12 animate-spin text-amber-400" />
                              </div>
                              <div>
                                <p className="text-sm font-medium">正在合成视频...</p>
                                <p className="mt-1 text-xs text-white/50">
                                  截取海报页面并合成为视频 ({videoProgress}%)
                                </p>
                              </div>
                              <div className="mx-auto w-32">
                                <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                                  <div
                                    className="h-full rounded-full bg-amber-400 transition-all duration-300"
                                    style={{ width: `${videoProgress}%` }}
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {videoStatus === 'success' && videoUrl && (
                      <div className="aspect-[9/16] w-full">
                        <video
                          src={videoUrl}
                          className="h-full w-full object-cover"
                          controls
                          playsInline
                          onPlay={() => setIsVideoPlaying(true)}
                          onPause={() => setIsVideoPlaying(false)}
                          onEnded={() => setIsVideoPlaying(false)}
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* 视频参数 */}
                <div className="mx-5 mb-4 flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    素材：海报 {totalPages} 页
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    BGM：{bgmMode === 'ai' ? 'AI 匹配' : uploadedBgmName || '自定义'}
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    规格：竖版9:16
                  </Badge>
                  {videoStatus === 'success' && (
                    <Badge variant="secondary" className="text-xs">
                      时长：{totalPages * 3}秒
                    </Badge>
                  )}
                </div>

                {/* 视频操作按钮 */}
                <div className="flex items-center justify-center gap-3 border-t px-5 py-4">
                  {videoStatus === 'generating' ? (
                    <Button disabled className="gap-2">
                      <Loader2 className="size-4 animate-spin" />
                      合成中...
                    </Button>
                  ) : (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={() => {
                          if (videoUrl) {
                            const a = document.createElement('a');
                            a.href = videoUrl;
                            a.download = `${contentItem.title}.webm`;
                            a.click();
                          }
                          setVideoDownloaded(true);
                          setTimeout(() => setVideoDownloaded(false), 2000);
                        }}
                      >
                        {videoDownloaded ? (
                          <>
                            <CheckCircle2 className="size-3.5 text-emerald-500" />
                            已下载
                          </>
                        ) : (
                          <>
                            <Download className="size-3.5" />
                            下载MP4
                          </>
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={handleGenerateVideo}
                      >
                        <RefreshCw className="size-3.5" />
                        重新生成
                      </Button>
                    </>
                  )}
                </div>
              </>
            )}
          </section>
        )}

        {/* 分发渠道 */}
        <section className="rounded-xl border bg-white shadow-sm">
          <div className="px-5 pt-5 pb-3">
            <h3 className="text-sm font-semibold">分发渠道</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              选择目标渠道，一键或半自动分发内容
            </p>
          </div>
          <Separator />

          <div className="divide-y">
            {/* CMS 官网 */}
            {hasArticle && (
              <div className="px-5 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex size-9 items-center justify-center rounded-lg bg-blue-50">
                      <Globe className="size-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">CMS 官网</p>
                      <p className="text-xs text-muted-foreground">
                        一键发布到官网文章系统
                      </p>
                    </div>
                  </div>
                  <Button size="sm" className="gap-1.5">
                    <ExternalLink className="size-3.5" />
                    一键发布
                  </Button>
                </div>
              </div>
            )}

            {/* 公众号 */}
            {hasArticle && (
              <div className="px-5 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex size-9 items-center justify-center rounded-lg bg-green-50">
                      <MessageCircle className="size-4 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">公众号</p>
                      <p className="text-xs text-muted-foreground">
                        推送到草稿箱 API，需手动确认发布
                      </p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <Share2 className="size-3.5" />
                    推送草稿箱
                  </Button>
                </div>
              </div>
            )}

            {/* 海报分发 */}
            {hasPoster && (
              <div className="px-5 py-4">
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-indigo-50">
                    <Image className="size-4 text-indigo-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">海报分发</p>
                    <p className="text-xs text-muted-foreground">
                      选择尺寸后下载，上传到对应平台
                    </p>
                  </div>
                </div>
                <RadioGroup
                  value={posterDistType}
                  onValueChange={setPosterDistType}
                  className="gap-2 pl-12"
                >
                  <label className="flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-2.5 transition-colors hover:bg-slate-50 has-[[data-state=checked]]:border-blue-200 has-[[data-state=checked]]:bg-blue-50/50">
                    <RadioGroupItem value="original" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">下载全套装图</p>
                      <p className="text-xs text-muted-foreground">
                        封面+内页共 {totalPages} 张，用于小红书图文/朋友圈
                      </p>
                    </div>
                    <Badge variant="outline" className="text-[10px]">
                      {totalPages}张 1080×1920
                    </Badge>
                  </label>
                  <label className="flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-2.5 transition-colors hover:bg-slate-50 has-[[data-state=checked]]:border-blue-200 has-[[data-state=checked]]:bg-blue-50/50">
                    <RadioGroupItem value="compressed" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">仅下载封面</p>
                      <p className="text-xs text-muted-foreground">
                        用于微信头像/公众号配图
                      </p>
                    </div>
                    <Badge variant="outline" className="text-[10px]">
                      540×960
                    </Badge>
                  </label>
                </RadioGroup>
                <div className="mt-3 pl-12">
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <Download className="size-3.5" />
                    下载海报
                  </Button>
                </div>
              </div>
            )}

            {/* 视频分发 */}
            {hasVideo && (
              <div className="px-5 py-4">
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-amber-50">
                    <Film className="size-4 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">视频分发</p>
                    <p className="text-xs text-muted-foreground">
                      打开平台发布页，复制标题标签后上传视频
                    </p>
                  </div>
                </div>
                <div className="space-y-2 pl-12">
                  {/* 一键打开全部平台 */}
                  <div className="flex gap-2">
                    <Button
                      variant="default"
                      size="sm"
                      className="flex-1 gap-2"
                      onClick={() => {
                        window.open(PLATFORM_CONFIG.weixin.publishUrl, '_blank');
                        window.open(PLATFORM_CONFIG.douyin.publishUrl, '_blank');
                        window.open(PLATFORM_CONFIG.xiaohongshu.publishUrl, '_blank');
                      }}
                    >
                      <ExternalLink className="size-3.5" />
                      一键打开全部平台
                    </Button>
                  </div>
                  {(
                    [
                      {
                        key: 'weixin' as const,
                        name: '视频号',
                        icon: <Video className="size-4" />,
                        color: 'text-orange-600',
                        bgColor: 'bg-orange-50',
                        borderColor: 'border-orange-200',
                        hoverBg: 'hover:bg-orange-100',
                      },
                      {
                        key: 'douyin' as const,
                        name: '抖音',
                        icon: <Smartphone className="size-4" />,
                        color: 'text-gray-800',
                        bgColor: 'bg-gray-50',
                        borderColor: 'border-gray-200',
                        hoverBg: 'hover:bg-gray-100',
                      },
                      {
                        key: 'xiaohongshu' as const,
                        name: '小红书',
                        icon: <Share2 className="size-4" />,
                        color: 'text-red-500',
                        bgColor: 'bg-red-50',
                        borderColor: 'border-red-200',
                        hoverBg: 'hover:bg-red-100',
                      },
                    ] as const
                  ).map((channel) => {
                    const pCfg = PLATFORM_CONFIG[channel.key];
                    const isOpen = expandedPlatforms.has(channel.key);
                    return (
                      <div key={channel.key} className="rounded-xl border bg-slate-50/50 overflow-hidden">
                        <button
                          type="button"
                          onClick={() => togglePlatform(channel.key)}
                          className={`flex w-full items-center gap-3 px-4 py-3 transition-all ${channel.hoverBg}`}
                        >
                          <div className={`flex size-8 items-center justify-center rounded-lg border ${channel.borderColor} bg-white ${channel.color}`}>
                            {channel.icon}
                          </div>
                          <div className="flex-1 text-left">
                            <p className={`text-sm font-medium ${channel.color}`}>{channel.name}</p>
                          </div>
                          <ChevronDown className={`size-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                        </button>
                        {isOpen && pCfg && (
                          <div className="space-y-3 border-t bg-white px-4 py-3">
                            {/* 打开平台发布页 */}
                            <div>
                              <p className="mb-1.5 text-xs font-medium text-muted-foreground">第1步：打开平台发布页</p>
                              <Button
                                variant="default"
                                size="sm"
                                className="w-full gap-2"
                                onClick={() => window.open(pCfg.publishUrl, '_blank')}
                              >
                                <ExternalLink className="size-3.5" />
                                打开{channel.name}发布页
                              </Button>
                            </div>
                            <Separator />
                            {/* 下载视频 */}
                            <div>
                              <p className="mb-1.5 text-xs font-medium text-muted-foreground">第2步：下载视频文件</p>
                              <Button
                                className="w-full gap-2"
                                size="sm"
                                disabled={videoStatus !== 'success'}
                                onClick={() => {
                                  if (videoUrl) {
                                    const a = document.createElement('a');
                                    a.href = videoUrl;
                                    a.download = `${contentItem.title}.webm`;
                                    a.click();
                                  }
                                }}
                              >
                                <Download className="size-3.5" />
                                {videoStatus === 'success' ? '下载视频文件 (MP4)' : '视频尚未生成'}
                              </Button>
                            </div>
                            <Separator />
                            {/* 复制标题 */}
                            <div>
                              <p className="mb-1.5 text-xs font-medium text-muted-foreground">第3步：复制标题</p>
                              <div className="flex items-start gap-2 rounded-lg border bg-slate-50 p-2.5">
                                <Type className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                                <p className="flex-1 text-sm">{pCfg.title}</p>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 shrink-0 gap-1 px-2"
                                  onClick={() => handleCopyByKey(pCfg.title, `${channel.key}-title`)}
                                >
                                  {copiedStates[`${channel.key}-title`] ? (
                                    <>
                                      <Check className="size-3 text-emerald-500" />
                                      <span className="text-xs text-emerald-600">已复制</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="size-3" />
                                      <span className="text-xs">复制</span>
                                    </>
                                  )}
                                </Button>
                              </div>
                            </div>
                            {/* 复制话题标签 */}
                            <div>
                              <p className="mb-1.5 text-xs font-medium text-muted-foreground">第4步：复制话题标签</p>
                              <div className="rounded-lg border bg-slate-50 p-2.5">
                                <div className="mb-1.5 flex flex-wrap gap-1">
                                  {pCfg.hashtags.map((tag) => (
                                    <Badge key={tag} variant="secondary" className="text-[10px]">
                                      <Hash className="mr-0.5 size-2.5" />
                                      {tag.slice(1)}
                                    </Badge>
                                  ))}
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-full gap-1"
                                  onClick={() => handleCopyByKey(pCfg.hashtags.join(' '), `${channel.key}-tags`)}
                                >
                                  {copiedStates[`${channel.key}-tags`] ? (
                                    <>
                                      <Check className="size-3 text-emerald-500" />
                                      <span className="text-xs text-emerald-600">话题标签已复制</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="size-3" />
                                      <span className="text-xs">复制全部话题标签</span>
                                    </>
                                  )}
                                </Button>
                              </div>
                            </div>
                            {/* 小红书额外文案 */}
                            {channel.key === 'xiaohongshu' && (
                              <div>
                                <p className="mb-1.5 text-xs font-medium text-muted-foreground">第5步：复制发布文案</p>
                                <div className="flex items-start gap-2 rounded-lg border bg-slate-50 p-2.5">
                                  <FileText className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                                  <p className="flex-1 text-sm leading-relaxed">{pCfg.description}</p>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 shrink-0 gap-1 px-2"
                                    onClick={() => handleCopyByKey(pCfg.description, `${channel.key}-desc`)}
                                  >
                                    {copiedStates[`${channel.key}-desc`] ? (
                                      <>
                                        <Check className="size-3 text-emerald-500" />
                                        <span className="text-xs text-emerald-600">已复制</span>
                                      </>
                                    ) : (
                                      <>
                                        <Copy className="size-3" />
                                        <span className="text-xs">复制</span>
                                      </>
                                    )}
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* 底部完成按钮 */}
        <div className="pb-8 pt-2">
          <Link href="/" className="block">
            <Button variant="outline" className="w-full" size="lg">
              完成并返回首页
            </Button>
          </Link>
        </div>
      </main>


      {/* 隐藏的 BGM audio 元素 */}
      {uploadedBgmUrl && (
        <audio id="bgm-audio-upload" src={uploadedBgmUrl} loop preload="auto" />
      )}

      {/* ── 隐藏的全尺寸海报渲染区（1080×1920，仅用于视频截图） ── */}
      <div style={{ position: 'fixed', left: '-9999px', top: 0, zIndex: -1 }}>
        {/* 封面页 */}
        <div
          ref={(el) => { fullSizeRefs.current[0] = el; }}
          style={{ width: 1080, height: 1920, position: 'relative', overflow: 'hidden', background: 'linear-gradient(160deg, #0f2027 0%, #203a43 30%, #2c5364 60%, #1a1a2e 100%)', fontFamily: 'PingFang SC, Microsoft YaHei, system-ui, sans-serif' }}
        >
          {/* 遮罩 */}
          <div style={{ position: 'absolute', inset: 0, background: poster.overlay }} />
          {/* 内容 */}
          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%', padding: '80px 60px 80px 60px' }}>
            {/* 顶部情感标语 */}
            <div style={{ paddingTop: 60, textAlign: 'center' }}>
              <p style={{ fontSize: 42, fontStyle: 'italic', letterSpacing: 6, color: 'rgba(255,255,255,0.8)', fontWeight: 300 }}>{poster.topTagline}</p>
              <div style={{ margin: '30px auto', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
                <span style={{ height: 1, width: 60, background: 'rgba(255,255,255,0.3)', display: 'inline-block' }} />
                <span style={{ fontSize: 24, color: 'rgba(255,255,255,0.4)' }}>Heart</span>
                <span style={{ height: 1, width: 60, background: 'rgba(255,255,255,0.3)', display: 'inline-block' }} />
              </div>
            </div>
            {/* 主标题 */}
            <div style={{ textAlign: 'center', marginTop: -30 }}>
              <h1 style={{ fontSize: 96, fontWeight: 900, lineHeight: 1.15, letterSpacing: 4, color: '#fff', textShadow: '0 4px 20px rgba(0,0,0,0.4)', wordBreak: 'break-all' }}>{poster.mainTitle}</h1>
              <div style={{ marginTop: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0 }}>
                <span style={{ borderRadius: '40px 0 0 40px', padding: '10px 24px', fontSize: 26, fontWeight: 500, backgroundColor: 'rgba(255,255,255,0.95)', color: poster.tagBg }}>{poster.subTitleTag1}</span>
                <span style={{ borderRadius: '0 40px 40px 0', padding: '10px 24px', fontSize: 26, fontWeight: 500, backgroundColor: poster.tagBg, color: poster.tagText }}>{poster.subTitleTag2}</span>
              </div>
            </div>
            {/* 价格卡片 */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 36 }}>
                {poster.prices.filter((p) => p.amount).map((price, i) => (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <p style={{ fontSize: 56, fontWeight: 900, color: '#fff', textShadow: '0 2px 10px rgba(0,0,0,0.3)' }}>¥{price.amount}</p>
                    <p style={{ fontSize: 22, color: 'rgba(255,255,255,0.6)', marginTop: 6 }}>{price.label}</p>
                    {price.badge && (
                      <span style={{ marginTop: 16, display: 'flex', width: 60, height: 60, alignItems: 'center', justifyContent: 'center', borderRadius: '50%', fontSize: 18, fontWeight: 700, lineHeight: 1.2, textAlign: 'center', backgroundColor: poster.tagBg, color: poster.tagText }}>{price.badge}</span>
                    )}
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 48, textAlign: 'center' }}>
                <div style={{ margin: '0 auto 12px', height: 1, width: 60, background: 'rgba(255,255,255,0.2)' }} />
                <p style={{ fontSize: 20, letterSpacing: 6, color: 'rgba(255,255,255,0.4)' }}>{poster.bottomSlogan}</p>
              </div>
            </div>
          </div>
        </div>

        {/* 内页 */}
        {innerPages.map((sections, pageIndex) => {
          const isLastInnerPage = pageIndex === innerPages.length - 1;
          const innerOverlay = 'linear-gradient(180deg, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.7) 40%, rgba(0,0,0,0.85) 100%)';
          return (
            <div
              key={pageIndex}
              ref={(el) => { fullSizeRefs.current[pageIndex + 1] = el; }}
              style={{ width: 1080, height: 1920, position: 'relative', overflow: 'hidden', background: 'linear-gradient(160deg, #0f2027 0%, #203a43 30%, #2c5364 60%, #1a1a2e 100%)', fontFamily: 'PingFang SC, Microsoft YaHei, system-ui, sans-serif' }}
            >
              <div style={{ position: 'absolute', inset: 0, background: innerOverlay }} />
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 6, background: poster.accent }} />
              <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', height: '100%', padding: '60px 50px 50px 50px', paddingTop: 80 }}>
                {/* 标题 */}
                <div style={{ marginBottom: 32, textAlign: 'center' }}>
                  <h2 style={{ fontSize: 44, fontWeight: 700, color: '#fff' }}>{poster.innerTitle}</h2>
                  <div style={{ margin: '16px auto 0', height: 4, width: 50, background: poster.accent }} />
                </div>
                {/* 内容板块 */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 20, overflow: 'hidden' }}>
                  {sections.map((section, si) => (
                    <div
                      key={si}
                      style={{ borderRadius: 16, padding: '24px 28px', background: 'rgba(255,255,255,0.08)', border: `1px solid ${poster.accent}20` }}
                    >
                      <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ height: 16, width: 5, borderRadius: 3, background: poster.accent, display: 'inline-block' }} />
                        <span style={{ fontSize: 26, fontWeight: 600, color: '#fff' }}>{section.heading}</span>
                      </div>
                      <ul style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingLeft: 24, listStyle: 'none', margin: 0 }}>
                        {section.items.map((item, ii) => (
                          <li key={ii} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 22, lineHeight: 1.6, color: 'rgba(255,255,255,0.7)' }}>
                            <span style={{ marginTop: 12, flexShrink: 0, height: 7, width: 7, borderRadius: '50%', background: poster.accent, display: 'inline-block' }} />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
                {/* 最后一页：价格 + 联系方式 */}
                {isLastInnerPage && (
                  <div style={{ marginTop: 24 }}>
                    {poster.prices.filter((p) => p.amount).length > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'center', gap: 20, marginBottom: 20 }}>
                        {poster.prices.filter((p) => p.amount).map((price, i) => (
                          <div
                            key={i}
                            style={{ textAlign: 'center', borderRadius: 12, padding: '10px 24px', background: `${poster.accent}15`, border: `1px solid ${poster.accent}25` }}
                          >
                            <p style={{ fontSize: 20, color: 'rgba(255,255,255,0.6)', margin: 0 }}>{price.label}</p>
                            <p style={{ fontSize: 32, fontWeight: 700, color: poster.accent, margin: 0 }}>¥{price.amount}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    <div style={{ textAlign: 'center', borderRadius: 12, padding: '12px 0', background: `${poster.accent}20` }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 22, color: 'rgba(255,255,255,0.7)' }}>
                        <span>{poster.contactPhone}</span>
                      </div>
                      <p style={{ marginTop: 4, fontSize: 18, color: 'rgba(255,255,255,0.4)' }}>{poster.bottomSlogan}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ResultPage() {
  return (
    <Suspense>
      <ResultPageInner />
    </Suspense>
  );
}
