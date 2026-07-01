import { NextRequest, NextResponse } from 'next/server';
import { FetchClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';
import dns from 'dns';
import { promisify } from 'util';

const dnsLookup = promisify(dns.lookup);

// SSRF 防护：校验 URL 是否安全
async function validateUrl(rawUrl: string): Promise<{ safe: boolean; reason?: string }> {
  try {
    const parsed = new URL(rawUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { safe: false, reason: '仅支持 http/https 协议' };
    }
    const hostname = parsed.hostname.toLowerCase();
    const blockedHosts = ['localhost', '127.0.0.1', '0.0.0.0', '::1', '169.254.169.254', 'metadata.google.internal', '100.100.100.200'];
    if (blockedHosts.includes(hostname)) {
      return { safe: false, reason: '禁止访问内网地址' };
    }
    if (/^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|0\.|127\.|169\.254\.|\[::1\]|\[fc00:)/.test(hostname)) {
      return { safe: false, reason: '禁止访问私有网络地址' };
    }
    try {
      const { address } = await dnsLookup(hostname);
      if (/^(10\.|127\.|0\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.|::1|fc00:)/.test(address)) {
        return { safe: false, reason: '域名解析到内网地址，已拦截' };
      }
    } catch { /* DNS 解析失败放行 */ }
    return { safe: true };
  } catch {
    return { safe: false, reason: '无效的 URL 格式' };
  }
}

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();
    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: '请提供有效的 URL' }, { status: 400 });
    }
    const validation = await validateUrl(url);
    if (!validation.safe) {
      return NextResponse.json({ error: validation.reason || 'URL 不安全' }, { status: 403 });
    }

    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);

    const config = new Config();
    const client = new FetchClient(config, customHeaders);

    const response = await client.fetch(url);

    return NextResponse.json({
      title: response.title,
      content: response.content,
      url: response.url,
      status_code: response.status_code,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
