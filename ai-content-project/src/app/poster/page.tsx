'use client';

import { useState, useRef, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Film,
  Check,
  ChevronLeft,
  ChevronRight,
  Phone,
  Upload,
  Loader2,
  ExternalLink,
  Copy,
  Play,
  X,
  CheckCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { BGM_OPTIONS, SHARE_PLATFORMS, generatePosterTags } from '@/lib/data';
import html2canvas from 'html2canvas-pro';
import JSZip from 'jszip';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';

type Ratio = '9:16' | '16:9';

// ── BGM 音频生成（Web Audio API，Hijaz 阿拉伯音阶） ──
// 音符频率映射（Hijaz 音阶 D4-G5）
const HIJAZ_SCALE = [293.66, 311.13, 369.99, 392.00, 440.00, 466.16, 554.37, 587.33];
// 各 BGM 的旋律模式（音阶索引序列 + 节奏）
type BgmPattern = { notes: number[]; rhythm: number[]; tempo: number; wave: OscillatorType };
const BGM_PATTERNS: Record<string, BgmPattern> = {
  '沙特传统乌德琴':  { notes: [0,2,4,3,2,1,0,2,4,5,4,3], rhythm: [3,1,2,2,2,2,3,1,2,1,3,2], tempo: 80,  wave: 'triangle' },
  '沙漠驼铃':        { notes: [4,4,0,0,4,4,2,2],           rhythm: [4,2,4,2,4,2,4,2],           tempo: 60,  wave: 'sine' },
  '阿拉伯之夜':      { notes: [0,2,4,5,7,5,4,2,0,2,3,4],   rhythm: [2,2,2,2,2,2,2,2,2,2,2,2],   tempo: 120, wave: 'sawtooth' },
  '中东风情':        { notes: [0,1,3,4,3,1,0,2,4,5,4,2],   rhythm: [2,2,3,1,2,2,2,2,3,1,2,2],   tempo: 100, wave: 'triangle' },
  '利雅得晨曦':      { notes: [4,3,2,0,2,3,4,5,7,5,4,0],   rhythm: [3,1,2,2,3,1,2,2,4,2,2,2],   tempo: 90,  wave: 'sine' },
};

async function createBgmAudioStream(bgmName: string, durationSec: number): Promise<MediaStream | null> {
  if (bgmName === '不选择' || !BGM_PATTERNS[bgmName]) return null;
  const pattern = BGM_PATTERNS[bgmName];
  const ctx = new AudioContext();
  const destination = ctx.createMediaStreamDestination();
  const masterGain = ctx.createGain();
  masterGain.gain.value = 0.12;
  masterGain.connect(destination);

  const beatDuration = 60 / pattern.tempo; // 每拍秒数

  // 主旋律
  const osc = ctx.createOscillator();
  osc.type = pattern.wave;
  const oscGain = ctx.createGain();
  oscGain.gain.value = 0;
  osc.connect(oscGain);
  oscGain.connect(masterGain);

  // 背景低音 drone
  const drone = ctx.createOscillator();
  drone.type = 'sine';
  drone.frequency.value = HIJAZ_SCALE[0] / 2; // 低八度根音
  const droneGain = ctx.createGain();
  droneGain.gain.value = 0.04;
  drone.connect(droneGain);
  droneGain.connect(masterGain);

  // 节奏打击（模拟 darbuka）
  const percGain = ctx.createGain();
  percGain.gain.value = 0.06;
  percGain.connect(masterGain);

  const now = ctx.currentTime;
  osc.start(now);
  drone.start(now);

  // 编排旋律
  let time = now;
  let loopCount = 0;
  const loopDuration = pattern.rhythm.reduce((a, b) => a + b, 0) * beatDuration;
  while (time < now + durationSec + 0.5) {
    for (let i = 0; i < pattern.notes.length; i++) {
      const start = time;
      const dur = pattern.rhythm[i] * beatDuration * 0.85;
      const freq = HIJAZ_SCALE[pattern.notes[i] % HIJAZ_SCALE.length];
      osc.frequency.setValueAtTime(freq, start);
      oscGain.gain.setValueAtTime(0.12, start);
      oscGain.gain.setTargetAtTime(0.001, start + dur * 0.7, dur * 0.3);
      // 打击节奏（每拍一次）
      const osc2 = ctx.createOscillator();
      osc2.type = 'triangle';
      osc2.frequency.value = 200 + (i % 2) * 100;
      const g2 = ctx.createGain();
      g2.gain.setValueAtTime(0, start);
      g2.gain.linearRampToValueAtTime(0.3, start + 0.01);
      g2.gain.exponentialRampToValueAtTime(0.001, start + 0.08);
      osc2.connect(g2);
      g2.connect(percGain);
      osc2.start(start);
      osc2.stop(start + 0.1);
      time = start + pattern.rhythm[i] * beatDuration;
    }
    loopCount++;
  }

  osc.stop(now + durationSec + 0.5);
  drone.stop(now + durationSec + 0.5);

  return destination.stream;
}

// 3 个预设背景图
const PRESET_BGS = [
  {
    id: 'desert-dunes',
    label: '沙漠金丘',
    url: 'https://images.pexels.com/photos/189349/pexels-photo-189349.jpeg?w=600&h=1067&fit=crop&q=80',
    accent: '#D4A843',
    overlay: 'linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.3) 50%, rgba(0,0,0,0.65) 100%)',
    tagBg: '#1a5c2a',
    tagText: '#FFFFFF',
  },
  {
    id: 'riyadh-skyline',
    label: '利雅得天际线',
    url: 'https://images.pexels.com/photos/2087391/pexels-photo-2087391.jpeg?w=600&h=1067&fit=crop&q=80',
    accent: '#4A90D9',
    overlay: 'linear-gradient(180deg, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.25) 50%, rgba(0,0,0,0.7) 100%)',
    tagBg: '#1a3a6b',
    tagText: '#FFFFFF',
  },
  {
    id: 'mecca-night',
    label: '麦加夜景',
    url: 'https://images.pexels.com/photos/2087454/pexels-photo-2087454.jpeg?w=600&h=1067&fit=crop&q=80',
    accent: '#C9A84C',
    overlay: 'linear-gradient(180deg, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.4) 50%, rgba(0,0,0,0.75) 100%)',
    tagBg: '#6b4c1a',
    tagText: '#FFFFFF',
  },
];

interface Section {
  heading: string;
  items: string[];
}

interface InnerPageData {
  title: string;
  bgId: string;
  customBgUrl: string;
  imageDesc: string;
  sections: Section[];
}

function defaultInnerPage(): InnerPageData {
  return {
    title: '办理流程 & 材料清单',
    bgId: 'desert-dunes',
    customBgUrl: '',
    imageDesc: '',
    sections: [
      {
        heading: '所需材料',
        items: ['有效护照（6个月以上）', '2寸白底照片2张', '沙特方邀请函', '公司营业执照复印件', '在职证明信'],
      },
      {
        heading: '办理流程',
        items: ['提交材料 → 审核整理 → 递交使馆 → 等待出签 → 签证送达'],
      },
      {
        heading: '办理周期',
        items: ['普通办理：7-15个工作日', '加急办理：3-5个工作日'],
      },
    ],
  };
}

function getBg(url: string, id: string) {
  const preset = PRESET_BGS.find((b) => b.id === id);
  const bgUrl = id === 'custom' ? url : (preset?.url ?? PRESET_BGS[0].url);
  const accent = preset?.accent ?? PRESET_BGS[0].accent;
  const overlay = preset?.overlay ?? PRESET_BGS[0].overlay;
  const tagBg = preset?.tagBg ?? PRESET_BGS[0].tagBg;
  const tagText = preset?.tagText ?? PRESET_BGS[0].tagText;
  return { bgUrl, accent, overlay, tagBg, tagText };
}

function PosterEditorInner() {
  const searchParams = useSearchParams();
  const rawPageCount = parseInt(searchParams.get('pageCount') || '6');
  const pageCount = Math.min(15, Math.max(2, isNaN(rawPageCount) ? 6 : rawPageCount));
  const ratio: Ratio = (searchParams.get('ratio') as Ratio) || '9:16';
  const numInnerPages = pageCount - 1; // 1 封面 + N 内页

  const isVertical = ratio === '9:16';
  const previewAspect = isVertical ? 'aspect-[9/16]' : 'aspect-[16/9]';
  const previewWidth = isVertical ? 'w-[300px]' : 'w-[500px]';
  const resolutionLabel = isVertical ? '1080 × 1920' : '1920 × 1080';

  // 页面索引：0 = 封面, 1..N = 内页
  const [currentPage, setCurrentPage] = useState<number>(0);

  // ── 封面状态 ──
  const [topTagline, setTopTagline] = useState('探索无界 商旅无忧');
  const [mainTitle, setMainTitle] = useState('沙特商务签证');
  const [subTitleTag1, setSubTitleTag1] = useState('2026最新政策');
  const [subTitleTag2, setSubTitleTag2] = useState('专业办理');
  const [coverBgId, setCoverBgId] = useState('desert-dunes');
  const [coverCustomBgUrl, setCoverCustomBgUrl] = useState('');

  // ── 内页数据（每个内页独立） ──
  const [innerPages, setInnerPages] = useState<InnerPageData[]>(
    Array.from({ length: numInnerPages }, () => defaultInnerPage()),
  );

  // 从 chatbot 读取预排版数据 + AI 生成结果
  useEffect(() => {
    try {
      // 读取 AI 完整结果（由 create 页面存入）
      const aiResultRaw = sessionStorage.getItem('ai_result');
      let aiResult: { content?: string; title?: string; summary?: string; tags?: string[]; source?: string; slogan?: string } | null = null;
      if (aiResultRaw) {
        aiResult = JSON.parse(aiResultRaw);
        sessionStorage.removeItem('ai_result');
      }

      // 读取海报分页数据
      const pagesJson = sessionStorage.getItem('poster_pages');
      const storedTitle = sessionStorage.getItem('poster_title');
      const storedSlogan = sessionStorage.getItem('poster_slogan');

      if (pagesJson) {
        const pages: Array<{ title: string; image_desc?: string; sections: Array<{ heading: string; items: string[] }> }> = JSON.parse(pagesJson);
        if (pages.length > 0) {
          setInnerPages(pages.map((p) => ({
            title: p.title,
            bgId: 'desert-dunes',
            customBgUrl: '',
            imageDesc: p.image_desc || '',
            sections: p.sections,
          })));
        }
      }

      // 用 AI 结果填充封面字段
      if (aiResult) {
        if (aiResult.title) {
          setMainTitle(aiResult.title);
        } else if (storedTitle) {
          setMainTitle(storedTitle);
        }
        // 从摘要生成顶部标语（取前20字）
        if (aiResult.summary) {
          const shortSummary = aiResult.summary.length > 20
            ? aiResult.summary.substring(0, 20)
            : aiResult.summary;
          setTopTagline(shortSummary);
        }
        // 从标签填充副标题标签
        if (aiResult.tags && aiResult.tags.length > 0) {
          setSubTitleTag1(aiResult.tags[0] || '');
          setSubTitleTag2(aiResult.tags.length > 1 ? aiResult.tags[1] : '');
        }
        // 清除示例价格（AI 内容通常不包含价格信息）
        setPrices([]);
        // 用 AI 生成的 slogan 作为底部标语，回退到摘要
        if (aiResult.slogan) {
          setBottomSlogan(aiResult.slogan);
        } else if (storedSlogan) {
          setBottomSlogan(storedSlogan);
        } else if (aiResult.summary) {
          setBottomSlogan(aiResult.summary.length > 30 ? aiResult.summary.substring(0, 30) : aiResult.summary);
        }
        // 清除示例联系电话
        setContactPhone('');
      } else {
        // 没有 AI 结果时，回退到旧逻辑
        if (storedTitle) {
          setMainTitle(storedTitle);
        }
      }
    } catch {
      // 静默降级，使用默认内容
    }
  }, []);

  // ── 公用 ──
  const [prices, setPrices] = useState([
    { amount: '1280', label: '标准办理', badge: '真纯玩' },
    { amount: '1980', label: '加急办理', badge: '极速签' },
    { amount: '880', label: '落地签', badge: '说走就走' },
  ]);
  const [bottomSlogan, setBottomSlogan] = useState('专业签证服务 · 让商旅更简单');
  const [contactPhone, setContactPhone] = useState('400-888-6666');

  // ── 视频选项 ──
  const [generateVideo, setGenerateVideo] = useState(true);
  const [pageDuration, setPageDuration] = useState(5); // 每页展示秒数
  const [bgm, setBgm] = useState('不选择');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── ffmpeg.wasm 实例（惰性加载） ──
  const ffmpegRef = useRef<FFmpeg | null>(null);
  const [ffmpegLoaded, setFfmpegLoaded] = useState(false);

  const loadFfmpeg = async () => {
    if (ffmpegRef.current && ffmpegLoaded) return;
    const ff = new FFmpeg();
    ff.on('log', ({ message }) => {
      // 提取进度百分比（ffmpeg 标准输出中有 frame= / time= 等信息）
      if (message.includes('time=')) {
        const match = message.match(/time=(\d{2}):(\d{2}):(\d{2})/);
        if (match) {
          const [, h, m, s] = match;
          setGenProgress(`转码中... ${h}:${m}:${s}`);
        }
      }
    });
    setGenProgress('正在加载转码引擎...');
    await ff.load();
    ffmpegRef.current = ff;
    setFfmpegLoaded(true);
  };

  // ── WebM → MP4 转码（ffmpeg.wasm） ──
  const convertWebmToMp4 = async (webmBlob: Blob): Promise<Blob> => {
    await loadFfmpeg();
    const ff = ffmpegRef.current!;

    const totalSec = totalPages * pageDuration;
    setGenProgress('正在转码为 MP4...');

    // 写入输入
    await ff.writeFile('input.webm', await fetchFile(webmBlob));

    // H.264 + AAC 编码 → MP4（兼容所有平台）
    // -c:v libx264: H.264 视频编码
    // -preset ultrafast: 浏览器内速度优先
    // -crf 23: 画质平衡
    // -c:a aac: AAC 音频编码
    // -movflags +faststart: 流媒体优化（网页渐进加载）
    await ff.exec([
      '-i', 'input.webm',
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      '-crf', '23',
      '-pix_fmt', 'yuv420p',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-movflags', '+faststart',
      'output.mp4',
    ]);

    const data = await ff.readFile('output.mp4');
    const mp4Blob = new Blob([data], { type: 'video/mp4' });

    // 清理临时文件
    await ff.deleteFile('input.webm').catch(() => {});
    await ff.deleteFile('output.mp4').catch(() => {});

    return mp4Blob;
  };

  // ── 画廊预览状态 ──
  const [showGallery, setShowGallery] = useState(false);
  const [galleryDataUrls, setGalleryDataUrls] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [genProgress, setGenProgress] = useState('');

  // ── 视频在线预览 ──
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [showVideoPreview, setShowVideoPreview] = useState(false);

  // ── 复制状态 ──
  const [copied, setCopied] = useState(false);

  // ── 预览元素 refs（用于 html2canvas 截图） ──
  const previewRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const setPreviewRef = useCallback((pageIndex: number) => (el: HTMLDivElement | null) => {
    if (el) {
      previewRefs.current.set(pageIndex, el);
    } else {
      previewRefs.current.delete(pageIndex);
    }
  }, []);

  // ── 截取海报页面 → 进入画廊预览 ──
  const handleGenerate = async () => {
    setIsGenerating(true);
    setGenProgress('正在截取页面...');
    try {
      const allPages = totalPages;
      const urls: string[] = [];

      for (let i = 0; i < allPages; i++) {
        setGenProgress(`截取第 ${i + 1}/${allPages} 页...`);
        const el = previewRefs.current.get(i);
        if (!el) {
          console.warn(`预览元素 ${i} 未找到，跳过`);
          continue;
        }
        const canvas = await html2canvas(el, {
          scale: 4,
          useCORS: true,
          allowTaint: true,
          backgroundColor: null,
        });
        urls.push(canvas.toDataURL('image/png'));
      }

      setGalleryDataUrls(urls);
      setShowGallery(true);
      setGenProgress('');
      setIsGenerating(false);
    } catch (err: any) {
      console.error('截取海报失败:', err);
      setGenProgress('截取失败，请重试');
      setTimeout(() => { setGenProgress(''); setIsGenerating(false); }, 2000);
    }
  };

  // ── 画廊：下载全部图片 ZIP ──
  const handleDownloadZip = async () => {
    const zip = new JSZip();
    for (let i = 0; i < galleryDataUrls.length; i++) {
      const label = i === 0 ? '封面' : `内页${i}`;
      const base64 = galleryDataUrls[i].split(',')[1];
      zip.file(`${String(i + 1).padStart(2, '0')}_${label}.png`, base64, { base64: true });
    }
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    triggerDownload(zipBlob, `poster_${Date.now()}.zip`);
  };

  // ── 画廊：生成视频（返回 blob，由调用方决定预览/下载） ──
  const buildVideoBlob = async (): Promise<Blob> => {
    const loaded: HTMLImageElement[] = [];
    for (const url of galleryDataUrls) {
      const img = new Image();
      await new Promise<void>((res, rej) => {
        img.onload = () => res();
        img.onerror = () => rej(new Error('图片加载失败'));
        img.src = url;
      });
      loaded.push(img);
    }
    return generateVideoFromImages(loaded, pageDuration, bgm);
  };

  // ── 画廊：在线预览视频 ──
  const handlePreviewVideo = async () => {
    if (videoPreviewUrl) {
      setShowVideoPreview(true);
      return;
    }
    setGenProgress('正在生成视频预览...');
    try {
      const videoBlob = await buildVideoBlob();
      const url = URL.createObjectURL(videoBlob);
      setVideoPreviewUrl(url);
      setShowVideoPreview(true);
      setGenProgress('');
    } catch (err: any) {
      console.error('视频生成失败:', err);
      setGenProgress('视频生成失败');
      setTimeout(() => setGenProgress(''), 2000);
    }
  };

  // ── 画廊：生成并下载视频（WebM → ffmpeg → MP4） ──
  const handleDownloadVideo = async () => {
    setGenProgress('正在生成视频...');
    try {
      const webmBlob = videoPreviewUrl
        ? await fetch(videoPreviewUrl).then((r) => r.blob())
        : await buildVideoBlob();
      if (!videoPreviewUrl) {
        const url = URL.createObjectURL(webmBlob);
        setVideoPreviewUrl(url);
      }

      // ffmpeg.wasm 转码 WebM → MP4
      const mp4Blob = await convertWebmToMp4(webmBlob);
      triggerDownload(mp4Blob, `poster_video_${Date.now()}.mp4`);
      setGenProgress('视频下载完成！（MP4格式）');
      setTimeout(() => setGenProgress(''), 1500);
    } catch (err: any) {
      console.error('视频生成失败:', err);
      setGenProgress('视频生成失败');
      setTimeout(() => setGenProgress(''), 2000);
    }
  };

  // ── 视频合成（Canvas + MediaRecorder，精确时间戳 + BGM 音频） ──
  const generateVideoFromImages = async (
    loaded: HTMLImageElement[],
    durationPerPage: number,
    bgmName: string,
  ): Promise<Blob> => {
    const first = loaded[0];
    const vw = first.naturalWidth;
    const vh = first.naturalHeight;
    const totalDurationMs = loaded.length * durationPerPage * 1000;

    // BGM 音频流
    const audioStream = await createBgmAudioStream(bgmName, loaded.length * durationPerPage);

    return new Promise<Blob>((resolve, reject) => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = vw;
        canvas.height = vh;
        const ctx = canvas.getContext('2d')!;

        const videoStream = canvas.captureStream(30);
        // 合并视频 + 音频轨道
        let combinedStream: MediaStream;
        if (audioStream) {
          combinedStream = new MediaStream([
            ...videoStream.getVideoTracks(),
            ...audioStream.getAudioTracks(),
          ]);
        } else {
          combinedStream = videoStream;
        }

        const chunks: Blob[] = [];
        const recorder = new MediaRecorder(combinedStream, {
          mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
            ? 'video/webm;codecs=vp9'
            : 'video/webm',
        });

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.push(e.data);
        };
        recorder.onstop = () => {
          resolve(new Blob(chunks, { type: 'video/webm' }));
        };
        recorder.onerror = () => reject(new Error('视频录制失败'));

        recorder.start();

        const startTime = performance.now();
        let stopped = false;

        const draw = () => {
          if (stopped) return;
          const elapsed = performance.now() - startTime;
          const pageIdx = Math.min(Math.floor(elapsed / (durationPerPage * 1000)), loaded.length - 1);

          if (elapsed >= totalDurationMs) {
            recorder.stop();
            stopped = true;
            return;
          }

          ctx.drawImage(loaded[pageIdx], 0, 0, vw, vh);
          requestAnimationFrame(draw);
        };

        draw();
      } catch (err) {
        reject(err);
      }
    });
  };

  // 通用下载触发器
  const triggerDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // ── 自动生成 tags ──
  const autoTags = generatePosterTags(mainTitle, subTitleTag1, subTitleTag2);

  // ── 复制标题 + tags ──
  const handleCopyTitleAndTags = async () => {
    const lines = [
      mainTitle,
      '',
      autoTags.join(' '),
    ];
    const text = lines.join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // ── 打开分发平台 ──
  const handleOpenPlatform = (platformId: string) => {
    const p = SHARE_PLATFORMS.find((s) => s.id === platformId);
    if (p) window.open(p.url, '_blank', 'noopener,noreferrer');
  };

  // ── helpers ──
  const currentCoverBg = () => getBg(coverCustomBgUrl, coverBgId);
  const currentInnerBg = (pageIdx: number) => {
    const ip = innerPages[pageIdx];
    return getBg(ip.customBgUrl, ip.bgId);
  };
  const currentInnerPage = (): InnerPageData | null => {
    if (currentPage === 0) return null;
    return innerPages[currentPage - 1] ?? null;
  };

  const handleUploadBg = (target: 'cover' | number) => {
    if (fileInputRef.current) {
      (fileInputRef.current as any).__target = target;
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const target = (fileInputRef.current as any)?.__target;
    if (target === 'cover') {
      setCoverBgId('custom');
      setCoverCustomBgUrl(url);
    } else if (typeof target === 'number') {
      const newInner = [...innerPages];
      newInner[target] = { ...newInner[target], bgId: 'custom', customBgUrl: url };
      setInnerPages(newInner);
    }
    e.target.value = '';
  };

  const getActiveBg = () => {
    if (currentPage === 0) return coverBgId;
    const ip = innerPages[currentPage - 1];
    return ip?.bgId ?? 'desert-dunes';
  };

  const setActiveBg = (bgId: string) => {
    if (currentPage === 0) {
      setCoverBgId(bgId);
      setCoverCustomBgUrl('');
    } else {
      const newInner = [...innerPages];
      newInner[currentPage - 1] = { ...newInner[currentPage - 1], bgId, customBgUrl: '' };
      setInnerPages(newInner);
    }
  };

  // ── 内页字段更新 ──
  const updateInnerTitle = (value: string) => {
    if (currentPage === 0) return;
    const newInner = [...innerPages];
    newInner[currentPage - 1] = { ...newInner[currentPage - 1], title: value };
    setInnerPages(newInner);
  };

  const updateInnerImageDesc = (value: string) => {
    if (currentPage === 0) return;
    const newInner = [...innerPages];
    newInner[currentPage - 1] = { ...newInner[currentPage - 1], imageDesc: value };
    setInnerPages(newInner);
  };

  const updateSectionHeading = (secIdx: number, value: string) => {
    if (currentPage === 0) return;
    const newInner = [...innerPages];
    const sections = [...newInner[currentPage - 1].sections];
    sections[secIdx] = { ...sections[secIdx], heading: value };
    newInner[currentPage - 1] = { ...newInner[currentPage - 1], sections };
    setInnerPages(newInner);
  };

  const updateSectionItem = (secIdx: number, itemIdx: number, value: string) => {
    if (currentPage === 0) return;
    const newInner = [...innerPages];
    const sections = [...newInner[currentPage - 1].sections];
    const items = [...sections[secIdx].items];
    items[itemIdx] = value;
    sections[secIdx] = { ...sections[secIdx], items };
    newInner[currentPage - 1] = { ...newInner[currentPage - 1], sections };
    setInnerPages(newInner);
  };

  const addSection = () => {
    if (currentPage === 0) return;
    const newInner = [...innerPages];
    const sections = [...newInner[currentPage - 1].sections];
    sections.push({ heading: '新板块', items: ['条目1'] });
    newInner[currentPage - 1] = { ...newInner[currentPage - 1], sections };
    setInnerPages(newInner);
  };

  const addSectionItem = (secIdx: number) => {
    if (currentPage === 0) return;
    const newInner = [...innerPages];
    const sections = [...newInner[currentPage - 1].sections];
    sections[secIdx] = { ...sections[secIdx], items: [...sections[secIdx].items, ''] };
    newInner[currentPage - 1] = { ...newInner[currentPage - 1], sections };
    setInnerPages(newInner);
  };

  const handleAddPrice = () => {
    setPrices([...prices, { amount: '', label: '', badge: '' }]);
  };

  const handlePriceChange = (index: number, field: 'amount' | 'label' | 'badge', value: string) => {
    const newPrices = [...prices];
    newPrices[index] = { ...newPrices[index], [field]: value };
    setPrices(newPrices);
  };

  // ── 封面预览 ──
  const renderCoverPreview = (ref?: (el: HTMLDivElement | null) => void) => {
    const bg = currentCoverBg();
    return (
      <div ref={ref} className={`${previewAspect} w-full relative overflow-hidden bg-black`}>
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${bg.bgUrl})` }}
        />
        <div className="absolute inset-0" style={{ background: bg.overlay }} />
        <div className="relative flex h-full flex-col justify-between px-5 py-8">
          <div className="pt-6 text-center">
            <p className="text-base italic tracking-wider text-white/80 font-light">
              {topTagline || '探索无界 商旅无忧'}
            </p>
            <div className="mx-auto mt-3 flex items-center justify-center gap-3">
              <span className="h-px w-10 bg-white/30" />
              <span className="text-xs text-white/40">Heart</span>
              <span className="h-px w-10 bg-white/30" />
            </div>
          </div>
          <div className="text-center -mt-4">
            <h1 className="text-[2.2rem] font-extrabold leading-tight tracking-wide text-white drop-shadow-lg">
              {mainTitle || '主标题'}
            </h1>
            <div className="mt-3 flex items-center justify-center gap-0">
              <span
                className="rounded-l-full px-3 py-1 text-xs font-medium"
                style={{ backgroundColor: 'rgba(255,255,255,0.95)', color: bg.tagBg }}
              >
                {subTitleTag1 || '标签1'}
              </span>
              <span
                className="rounded-r-full px-3 py-1 text-xs font-medium"
                style={{ backgroundColor: bg.tagBg, color: bg.tagText }}
              >
                {subTitleTag2 || '标签2'}
              </span>
            </div>
          </div>
          <div>
            <div className="flex justify-center gap-3">
              {prices.filter((p) => p.amount).map((price, i) => (
                <div key={i} className="flex flex-col items-center">
                  <p className="text-2xl font-extrabold text-white drop-shadow-md">
                    ¥{price.amount}
                  </p>
                  <p className="text-[9px] text-white/60 mt-0.5">
                    {price.label || `方案${i + 1}`}
                  </p>
                  {price.badge && (
                    <span
                      className="mt-1.5 flex size-9 items-center justify-center rounded-full text-[8px] font-bold leading-tight text-center"
                      style={{ backgroundColor: bg.tagBg, color: bg.tagText }}
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
                {bottomSlogan || '底部标语'}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ── 内页预览 ──
  const renderInnerPreview = (pageIdx: number, ref?: (el: HTMLDivElement | null) => void) => {
    const ip = innerPages[pageIdx];
    if (!ip) return null;
    const bg = currentInnerBg(pageIdx);
    return (
      <div
        ref={ref}
        className={`${previewAspect} w-full relative overflow-hidden`}
        style={{
          backgroundImage: `url(${bg.bgUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.7) 40%, rgba(0,0,0,0.85) 100%)' }} />
        <div className="absolute top-0 left-0 right-0 h-1" style={{ background: bg.accent }} />
        <div className="relative flex h-full flex-col p-5 pt-6">
          <div className="mb-4 text-center">
            <h2 className="text-lg font-bold text-white">{ip.title || '内页标题'}</h2>
            <div className="mx-auto mt-2 h-0.5 w-10" style={{ background: bg.accent }} />
            {ip.imageDesc && (
              <p className="mt-2 text-[10px] text-white/50 italic">🖼️ {ip.imageDesc}</p>
            )}
          </div>
          <div className="flex-1 space-y-3 overflow-hidden">
            {ip.sections.map((section, si) => (
              <div key={si} className="rounded-lg p-3" style={{ background: 'rgba(255,255,255,0.08)', border: `1px solid ${bg.accent}20` }}>
                <div className="mb-2 flex items-center gap-2">
                  <span className="h-3 w-1 rounded-full" style={{ background: bg.accent }} />
                  <span className="text-xs font-semibold text-white">{section.heading}</span>
                </div>
                <ul className="space-y-1 pl-3">
                  {section.items.map((item, ii) => (
                    <li key={ii} className="flex items-start gap-1.5 text-[10px] leading-relaxed text-white/70">
                      <span className="mt-1.5 shrink-0 h-1 w-1 rounded-full" style={{ background: bg.accent }} />
                      {item || '条目内容'}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-3">
            {prices.filter((p) => p.amount).length > 0 && (
              <div className="flex justify-center gap-3 mb-3">
                {prices.filter((p) => p.amount).map((price, i) => (
                  <div key={i} className="text-center rounded-lg px-3 py-1.5" style={{ background: `${bg.accent}15`, border: `1px solid ${bg.accent}25` }}>
                    <p className="text-[9px] text-white/60">{price.label || `方案${i + 1}`}</p>
                    <p className="text-sm font-bold" style={{ color: bg.accent }}>¥{price.amount}</p>
                  </div>
                ))}
              </div>
            )}
            <div className="text-center rounded-lg py-2" style={{ background: `${bg.accent}20` }}>
              <div className="flex items-center justify-center gap-1.5 text-[10px] text-white/70">
                <Phone className="size-3" style={{ color: bg.accent }} />
                <span>{contactPhone || '联系方式'}</span>
              </div>
              <p className="mt-0.5 text-[8px] text-white/40">{bottomSlogan || '底部标语'}</p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ── 背景图选择器（3 预设 + 自定义上传） ──
  const renderBgSelector = () => (
    <Card className="gap-0 border bg-white shadow-sm">
      <div className="px-5 pt-5 pb-3">
        <h3 className="text-sm font-semibold">背景图</h3>
      </div>
      <Separator />
      <div className="space-y-4 px-5 py-5">
        <div className="grid grid-cols-4 gap-2">
          {PRESET_BGS.map((opt) => (
            <button
              key={opt.id}
              className={`flex flex-col items-center gap-1 rounded-lg p-1.5 transition-all ${
                getActiveBg() === opt.id
                  ? 'ring-2 ring-blue-500 ring-offset-1'
                  : 'hover:bg-slate-50'
              }`}
              onClick={() => setActiveBg(opt.id)}
            >
              <div
                className={`${isVertical ? 'aspect-[9/16]' : 'aspect-[16/9]'} w-full rounded-md border bg-cover bg-center`}
                style={{ backgroundImage: `url(${opt.url})` }}
              />
              <span className="text-[10px] text-muted-foreground">{opt.label}</span>
            </button>
          ))}
          {/* 自定义上传 */}
          <button
            className={`flex flex-col items-center gap-1 rounded-lg p-1.5 transition-all ${
              getActiveBg() === 'custom'
                ? 'ring-2 ring-blue-500 ring-offset-1'
                : 'hover:bg-slate-50'
            }`}
            onClick={() => handleUploadBg(currentPage === 0 ? 'cover' : currentPage - 1)}
          >
            <div className={`${isVertical ? 'aspect-[9/16]' : 'aspect-[16/9]'} w-full rounded-md border border-dashed border-slate-300 flex items-center justify-center bg-slate-50`}>
              {getActiveBg() === 'custom' ? (
                <div
                  className="w-full h-full bg-cover bg-center rounded-md"
                  style={{
                    backgroundImage: `url(${
                      currentPage === 0 ? coverCustomBgUrl : (innerPages[currentPage - 1]?.customBgUrl || '')
                    })`,
                  }}
                />
              ) : (
                <Upload className="size-4 text-slate-400" />
              )}
            </div>
            <span className="text-[10px] text-muted-foreground">自定义</span>
          </button>
        </div>
        {getActiveBg() === 'custom' && (
          <p className="text-[10px] text-muted-foreground">
            已选择自定义图片。点击"自定义"可重新上传替换。
          </p>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>
    </Card>
  );

  // ── 封面编辑表单 ──
  const renderCoverForm = () => (
    <div className="w-[380px] shrink-0 space-y-4">
      <Card className="gap-0 border bg-white shadow-sm">
        <div className="px-5 pt-5 pb-3">
          <h3 className="text-sm font-semibold">封面文案</h3>
        </div>
        <Separator />
        <div className="space-y-4 px-5 py-5">
          <div>
            <Label className="text-sm">顶部情感标语</Label>
            <Input value={topTagline} onChange={(e) => setTopTagline(e.target.value)} className="mt-1.5" placeholder="如：探索无界 商旅无忧" />
          </div>
          <div>
            <Label className="text-sm">主标题</Label>
            <Input value={mainTitle} onChange={(e) => setMainTitle(e.target.value)} className="mt-1.5" placeholder="海报主标题" />
          </div>
          <div>
            <Label className="text-sm">副标题标签（左右两段）</Label>
            <div className="mt-1.5 flex gap-2">
              <Input value={subTitleTag1} onChange={(e) => setSubTitleTag1(e.target.value)} placeholder="左标签" className="flex-1" />
              <Input value={subTitleTag2} onChange={(e) => setSubTitleTag2(e.target.value)} placeholder="右标签" className="flex-1" />
            </div>
          </div>
        </div>
      </Card>
      {renderBgSelector()}
      {renderCommonForm()}
    </div>
  );

  // ── 公用表单（价格 + 底部信息） ──
  const renderCommonForm = () => (
    <>
      <Card className="gap-0 border bg-white shadow-sm">
        <div className="px-5 pt-5 pb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">价格区</h3>
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleAddPrice} disabled={prices.length >= 3}>
            + 添加价格
          </Button>
        </div>
        <Separator />
        <div className="space-y-3 px-5 py-5">
          {prices.map((price, index) => (
            <div key={index} className="flex gap-2">
              <Input placeholder="金额" value={price.amount} onChange={(e) => handlePriceChange(index, 'amount', e.target.value)} className="w-20" />
              <Input placeholder="说明" value={price.label} onChange={(e) => handlePriceChange(index, 'label', e.target.value)} className="flex-1" />
              <Input placeholder="圆形标签" value={price.badge} onChange={(e) => handlePriceChange(index, 'badge', e.target.value)} className="w-24" />
            </div>
          ))}
          <p className="text-[11px] text-muted-foreground">圆形标签：价格下方的圆形徽章文字，如"真纯玩""极速签"</p>
        </div>
      </Card>

      <Card className="gap-0 border bg-white shadow-sm">
        <div className="px-5 pt-5 pb-3">
          <h3 className="text-sm font-semibold">底部信息</h3>
        </div>
        <Separator />
        <div className="space-y-4 px-5 py-5">
          <div>
            <Label className="text-sm">联系电话</Label>
            <Input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} className="mt-1.5" placeholder="如：400-888-6666" />
          </div>
          <div>
            <Label className="text-sm">底部标语</Label>
            <Input value={bottomSlogan} onChange={(e) => setBottomSlogan(e.target.value)} className="mt-1.5" placeholder="底部标语文字" />
          </div>
        </div>
      </Card>
    </>
  );

  // ── 内页编辑表单 ──
  const renderInnerForm = () => {
    const ip = currentInnerPage();
    if (!ip) return null;
    return (
      <div className="w-[380px] shrink-0 space-y-4">
        <Card className="gap-0 border bg-white shadow-sm">
          <div className="px-5 pt-5 pb-3">
            <h3 className="text-sm font-semibold">内页 {currentPage} 标题</h3>
          </div>
          <Separator />
          <div className="px-5 py-5 space-y-4">
            <Input value={ip.title} onChange={(e) => updateInnerTitle(e.target.value)} placeholder="如：办理流程 & 材料清单" />
            <div>
              <Label className="text-xs text-muted-foreground">🖼️ 配图描述</Label>
              <Input value={ip.imageDesc} onChange={(e) => updateInnerImageDesc(e.target.value)} placeholder="如：沙特利雅得城市天际线日落全景" className="mt-1.5" />
            </div>
          </div>
        </Card>

        <Card className="gap-0 border bg-white shadow-sm">
          <div className="px-5 pt-5 pb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold">内容板块</h3>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={addSection} disabled={ip.sections.length >= 5}>
              + 添加板块
            </Button>
          </div>
          <Separator />
          <div className="space-y-4 px-5 py-5">
            {ip.sections.map((section, si) => (
              <div key={si} className="space-y-2 rounded-lg border bg-slate-50/50 p-3">
                <Input
                  value={section.heading}
                  onChange={(e) => updateSectionHeading(si, e.target.value)}
                  placeholder="板块标题"
                  className="h-8 text-sm font-medium"
                />
                {section.items.map((item, ii) => (
                  <Input
                    key={ii}
                    value={item}
                    onChange={(e) => updateSectionItem(si, ii, e.target.value)}
                    placeholder={`条目 ${ii + 1}`}
                    className="h-7 text-xs"
                  />
                ))}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs text-muted-foreground"
                  onClick={() => addSectionItem(si)}
                  disabled={section.items.length >= 8}
                >
                  + 添加条目
                </Button>
              </div>
            ))}
          </div>
        </Card>

        {renderBgSelector()}
      </div>
    );
  };

  const totalPages = pageCount;
  const totalVideoDuration = totalPages * pageDuration;

  return (
    <div className="min-h-screen bg-[#F5F5F7]">
      {/* 顶部导航 */}
      <header className="sticky top-0 z-20 border-b bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
          <Link href="/create">
            <Button variant="ghost" size="icon-sm" className="shrink-0">
              <ArrowLeft className="size-4" />
            </Button>
          </Link>
          <Separator orientation="vertical" className="h-5" />
          <div className="flex flex-col">
            <span className="text-sm font-semibold">海报编辑器</span>
            <span className="text-xs text-muted-foreground">
              {ratio} · {totalPages} 页 · {currentPage === 0 ? '封面' : `内页 ${currentPage}`}
            </span>
          </div>
          <div className="ml-auto">
            <Button className="gap-1.5" onClick={handleGenerate} disabled={isGenerating}>
              {isGenerating ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  {genProgress || '生成中...'}
                </>
              ) : (
                <>
                  <Check className="size-3.5" />
                  生成海报
                </>
              )}
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <div className="flex gap-6">
          {/* 左栏：编辑表单 */}
          {currentPage === 0 ? renderCoverForm() : renderInnerForm()}

          {/* 右栏：实时预览 */}
          <div className="flex-1">
            <div className="sticky top-20">
              {/* 页面切换 */}
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon-sm"
                    disabled={currentPage === 0}
                    onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
                  >
                    <ChevronLeft className="size-4" />
                  </Button>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {currentPage + 1} / {totalPages}{' '}
                    {currentPage === 0 ? '封面' : `内页 ${currentPage}`}
                  </span>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    disabled={currentPage === totalPages - 1}
                    onClick={() => setCurrentPage(Math.min(totalPages - 1, currentPage + 1))}
                  >
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
                <Badge variant="secondary" className="text-xs">{resolutionLabel}</Badge>
              </div>

              {/* 预览 */}
              <div className="flex justify-center">
                <div className={`${previewWidth} overflow-hidden rounded-xl border shadow-lg`}>
                  {currentPage === 0
                    ? renderCoverPreview(setPreviewRef(0))
                    : renderInnerPreview(currentPage - 1, setPreviewRef(currentPage))}
                </div>
              </div>

              {/* 缩略图导航 */}
              <div className="mt-4 flex justify-center gap-2 overflow-x-auto pb-1">
                <button
                  className={`w-[56px] shrink-0 overflow-hidden rounded-lg border-2 transition-all ${
                    currentPage === 0 ? 'border-blue-500 shadow-md' : 'border-slate-200 hover:border-slate-300'
                  }`}
                  onClick={() => setCurrentPage(0)}
                >
                  <div
                    className={`${isVertical ? 'aspect-[9/16]' : 'aspect-[16/9]'} w-full bg-cover bg-center`}
                    style={{ backgroundImage: `url(${currentCoverBg().bgUrl})` }}
                  >
                    <div className="flex h-full items-center justify-center bg-black/40">
                      <p className="text-[7px] font-medium text-white/60">封面</p>
                    </div>
                  </div>
                </button>
                {innerPages.map((ip, idx) => {
                  const bg = currentInnerBg(idx);
                  return (
                    <button
                      key={idx}
                      className={`w-[56px] shrink-0 overflow-hidden rounded-lg border-2 transition-all ${
                        currentPage === idx + 1 ? 'border-blue-500 shadow-md' : 'border-slate-200 hover:border-slate-300'
                      }`}
                      onClick={() => setCurrentPage(idx + 1)}
                    >
                      <div
                        className={`${isVertical ? 'aspect-[9/16]' : 'aspect-[16/9]'} w-full bg-cover bg-center`}
                        style={{ backgroundImage: `url(${bg.bgUrl})` }}
                      >
                        <div className="flex h-full items-center justify-center bg-black/60">
                          <p className="text-[7px] font-medium text-white/60">{idx + 1}</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* 视频生成选项 */}
              <Card className="mt-4 gap-0 border bg-white shadow-sm">
                <div className="px-4 pt-4 pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Film className="size-4 text-indigo-500" />
                      <h3 className="text-sm font-semibold">同时生成视频</h3>
                    </div>
                    <Switch checked={generateVideo} onCheckedChange={setGenerateVideo} />
                  </div>
                </div>
                {generateVideo && (
                  <>
                    <Separator />
                    <div className="space-y-3 px-4 py-4">
                      {/* 每页展示秒数 */}
                      <div>
                        <Label className="text-xs">每页展示秒数</Label>
                        <div className="mt-1 flex items-center gap-2">
                          <input
                            type="range"
                            min={2}
                            max={10}
                            step={1}
                            value={pageDuration}
                            onChange={(e) => setPageDuration(Number(e.target.value))}
                            className="flex-1 h-2 rounded-full appearance-none bg-slate-200 accent-indigo-500"
                          />
                          <span className="w-8 text-center text-sm font-medium tabular-nums text-indigo-600">
                            {pageDuration}s
                          </span>
                        </div>
                      </div>

                      {/* BGM */}
                      <div>
                        <Label className="text-xs">BGM（15秒循环，可不选）</Label>
                        <Select value={bgm} onValueChange={setBgm}>
                          <SelectTrigger className="mt-1 h-8 w-full text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {BGM_OPTIONS.map((b) => (
                              <SelectItem key={b} value={b}>{b}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <p className="text-[10px] text-muted-foreground">
                        视频共 {totalPages} 页 × {pageDuration}s = {totalVideoDuration}s · 比例 {ratio}{' '}
                        {bgm !== '不选择' ? `· BGM: ${bgm}` : '· 无BGM'}
                      </p>
                    </div>
                  </>
                )}
              </Card>
            </div>
          </div>
        </div>
      </main>

      {/* 隐藏区域：预渲染所有页面供 html2canvas 截图 */}
      <div aria-hidden="true" style={{ position: 'fixed', left: '-9999px', top: 0, zIndex: -1, pointerEvents: 'none' }}>
        {/* 封面 */}
        <div ref={setPreviewRef(0)} className={`${previewWidth}`}>
          <div className={`${previewAspect} w-full relative overflow-hidden`}>
            {renderCoverPreview()}
          </div>
        </div>
        {/* 内页 */}
        {innerPages.map((_ip, idx) => (
          <div key={idx} ref={setPreviewRef(idx + 1)} className={`${previewWidth}`}>
            <div className={`${previewAspect} w-full relative overflow-hidden`}>
              {renderInnerPreview(idx)}
            </div>
          </div>
        ))}
      </div>

      {/* 画廊预览浮层 */}
      {showGallery && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white" style={{ fontFamily: 'system-ui, sans-serif' }}>
          {/* 顶部栏 */}
          <div className="shrink-0 px-4 py-3 border-b border-gray-200 space-y-3">
            {/* 第一行：导航 + 下载 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-gray-500 hover:text-gray-900 hover:bg-gray-100"
                  onClick={() => {
                    setShowGallery(false);
                    setGalleryDataUrls([]);
                    if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
                    setVideoPreviewUrl(null);
                  }}
                >
                  <ArrowLeft className="size-4 mr-1" />
                  返回编辑
                </Button>
                <Separator orientation="vertical" className="h-4 bg-gray-300" />
                <span className="text-sm text-gray-600">{ratio} · {totalPages} 页 · {resolutionLabel}</span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-gray-700 border-gray-300 hover:bg-gray-100"
                  onClick={handleDownloadZip}
                >
                  下载全部图片
                </Button>
                {generateVideo && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-gray-700 border-gray-300 hover:bg-gray-100"
                      onClick={handlePreviewVideo}
                      disabled={!!genProgress}
                    >
                      {genProgress && !videoPreviewUrl ? (
                        <><Loader2 className="size-3.5 animate-spin mr-1" />{genProgress}</>
                      ) : (
                        <><Play className="size-3.5 mr-1" />预览视频</>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      className="bg-indigo-600 hover:bg-indigo-700 text-white"
                      onClick={handleDownloadVideo}
                      disabled={!!genProgress}
                    >
                      {genProgress ? (
                        <><Loader2 className="size-3.5 animate-spin mr-1" />{genProgress}</>
                      ) : (
                        <><Film className="size-3.5 mr-1" />下载 MP4 ({totalVideoDuration}s{bgm !== '不选择' ? ` · ${bgm}` : ''})</>
                      )}
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* 第二行：分发平台 + 复制 */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 shrink-0">一键发布到：</span>
              {SHARE_PLATFORMS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleOpenPlatform(p.id)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium border border-gray-300 text-gray-700 hover:bg-gray-100 hover:border-gray-400 transition-all"
                  title={p.desc}
                >
                  <span>{p.icon}</span>
                  <span>{p.name}</span>
                  <ExternalLink className="size-3 opacity-50" />
                </button>
              ))}
              <Separator orientation="vertical" className="h-4 bg-gray-300" />
              <button
                onClick={handleCopyTitleAndTags}
                className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                  copied
                    ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                    : 'border-gray-300 text-gray-600 hover:bg-gray-100 hover:border-gray-400'
                }`}
              >
                {copied ? (
                  <><CheckCheck className="size-3" /> 已复制标题+Tags</>
                ) : (
                  <><Copy className="size-3" /> 复制标题+Tags</>
                )}
              </button>
            </div>

            {/* 第三行：自动生成的 tags 预览 */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {autoTags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 rounded text-[10px] bg-gray-100 text-gray-500 border border-gray-200"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* 画廊网格 */}
          <div className="flex-1 overflow-auto p-6">
            <div className={`mx-auto grid gap-4 ${galleryDataUrls.length <= 3 ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 max-w-5xl' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 max-w-7xl'}`}>
              {galleryDataUrls.map((url, idx) => (
                <div key={idx} className="group relative">
                  <div className="overflow-hidden rounded-lg border border-gray-200 bg-gray-50 shadow-lg">
                    <img
                      src={url}
                      alt={idx === 0 ? '封面' : `内页 ${idx}`}
                      className="w-full h-auto"
                    />
                  </div>
                  <div className="mt-1.5 flex items-center justify-between px-0.5">
                    <span className="text-xs text-gray-400">
                      {idx === 0 ? '封面' : `内页 ${idx}`}
                    </span>
                    <button
                      className="text-xs text-gray-400 hover:text-gray-700 transition-colors"
                      onClick={() => {
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `${String(idx + 1).padStart(2, '0')}_${idx === 0 ? '封面' : `内页${idx}`}.png`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                      }}
                    >
                      下载
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 视频在线预览浮层 */}
      {showVideoPreview && videoPreviewUrl && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/98">
          {/* 关闭 */}
          <button
            className="absolute top-4 right-4 z-10 p-2 rounded-full bg-black/40 hover:bg-black/60 text-white/80 hover:text-white transition-all"
            onClick={() => setShowVideoPreview(false)}
          >
            <X className="size-5" />
          </button>

          {/* 视频信息 */}
          <div className="absolute top-4 left-4 z-10 text-white/50 text-xs">
            {ratio} · {totalPages}页 · {totalVideoDuration}s
            {bgm !== '不选择' ? ` · ${bgm}` : ''}
          </div>

          {/* 视频播放器 */}
          <video
            src={videoPreviewUrl}
            controls
            autoPlay
            loop
            className="max-h-[90vh] max-w-[90vw] rounded-lg shadow-2xl"
            style={{ background: '#000' }}
          />

          {/* 底部操作 */}
          <div className="absolute bottom-6 flex items-center gap-3">
            <button
              onClick={handleDownloadVideo}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors"
            >
              <Film className="size-4" />
             下载 MP4
            </button>
            <button
              onClick={() => setShowVideoPreview(false)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white/90 hover:bg-white text-gray-800 text-sm transition-colors border border-gray-200"
            >
              返回画廊
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PosterPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-[#F5F5F7]">
          <div className="text-sm text-muted-foreground">加载中...</div>
        </div>
      }
    >
      <PosterEditorInner />
    </Suspense>
  );
}
