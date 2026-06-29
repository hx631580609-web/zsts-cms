import { NextRequest, NextResponse } from 'next/server';

// ══════════════════════════════════════════════════════
//  POST /api/upload — 文件上传与内容解析
// ══════════════════════════════════════════════════════

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const SUPPORTED_TEXT_TYPES = ['text/plain', 'text/markdown', 'text/csv', 'text/html', 'application/json'];

function getMimeType(filename: string): string {
  const ext = filename.toLowerCase().split('.').pop() || '';
  const mimeMap: Record<string, string> = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
    gif: 'image/gif', webp: 'image/webp',
    pdf: 'application/pdf',
    txt: 'text/plain', md: 'text/markdown', csv: 'text/csv',
    json: 'application/json', html: 'text/html',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  };
  return mimeMap[ext] || 'application/octet-stream';
}

function bufferToBase64DataUrl(buffer: Buffer, mimeType: string): string {
  return `data:${mimeType};base64,${buffer.toString('base64')}`;
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  try {
    // pdf-parse v2 使用 class API，用 any 绕过类型检查
    const { PDFParse } = await import('pdf-parse');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parser = new (PDFParse as any)({ verbosity: 0 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (parser as any).load(buffer);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: any = await parser.getText();
    parser.destroy();
    // getText 可能返回 string 或 { text: string }
    if (typeof result === 'string') return result;
    if (result && typeof result.text === 'string') return result.text;
    if (result && typeof result.toString === 'function') return result.toString();
    return '';
  } catch (err) {
    console.error('[upload] PDF 解析失败:', err);
    return '[PDF 内容解析失败]';
  }
}

async function extractDocxText(buffer: Buffer): Promise<string> {
  try {
    // 简单提取 DOCX 中的文本（DOCX 本质是 ZIP 包含 XML）
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(buffer);
    const docXml = zip.file('word/document.xml');
    if (!docXml) return '[DOCX 文件无法解析]';
    const xml = await docXml.async('string');
    // 提取 <w:t> 标签中的文本
    const textParts = xml.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || [];
    return textParts
      .map(t => t.replace(/<[^>]+>/g, ''))
      .join('')
      .replace(/\s+/g, ' ')
      .trim();
  } catch (err) {
    console.error('[upload] DOCX 解析失败:', err);
    return '[DOCX 内容解析失败]';
  }
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: '请上传文件' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: `文件过大，最大支持 10MB（当前 ${(file.size / 1024 / 1024).toFixed(1)}MB）` }, { status: 400 });
    }

    const mimeType = file.type || getMimeType(file.name);
    const buffer = Buffer.from(await file.arrayBuffer());

    // 图片：返回 base64 data URL（供视觉模型使用）
    if (SUPPORTED_IMAGE_TYPES.includes(mimeType)) {
      const base64 = bufferToBase64DataUrl(buffer, mimeType);
      return NextResponse.json({
        filename: file.name,
        type: 'image',
        mimeType,
        size: file.size,
        base64Image: base64,
        content: `[图片文件: ${file.name}, ${(file.size / 1024).toFixed(1)}KB]`,
      });
    }

    // PDF：提取文本
    if (mimeType === 'application/pdf') {
      const text = await extractPdfText(buffer);
      return NextResponse.json({
        filename: file.name,
        type: 'document',
        mimeType,
        size: file.size,
        content: text || '[PDF 文件内容为空]',
        preview: text.substring(0, 500) + (text.length > 500 ? '...' : ''),
      });
    }

    // DOCX：提取文本
    if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      const text = await extractDocxText(buffer);
      return NextResponse.json({
        filename: file.name,
        type: 'document',
        mimeType,
        size: file.size,
        content: text || '[DOCX 文件内容为空]',
        preview: text.substring(0, 500) + (text.length > 500 ? '...' : ''),
      });
    }

    // 文本文件：直接读取
    if (SUPPORTED_TEXT_TYPES.includes(mimeType)) {
      const text = buffer.toString('utf-8');
      return NextResponse.json({
        filename: file.name,
        type: 'text',
        mimeType,
        size: file.size,
        content: text,
        preview: text.substring(0, 500) + (text.length > 500 ? '...' : ''),
      });
    }

    return NextResponse.json({
      error: `不支持的文件类型: ${mimeType}。支持: 图片(JPG/PNG/GIF/WebP)、PDF、DOCX、TXT、MD、CSV、JSON`,
    }, { status: 400 });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '未知错误';
    console.error('[api/upload] Error:', msg);
    return NextResponse.json({ error: '文件处理失败: ' + msg }, { status: 500 });
  }
}
