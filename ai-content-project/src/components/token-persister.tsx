'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

/**
 * 从 URL query 中读取 token 并写入 cookie。
 * 解决 iframe 内 Next.js 客户端导航（Link / useRouter）丢失 token 导致 401 的问题。
 * 
 * 工作机制：
 * 1. 首次进入 /ai-content?token=xxx → 从 URL 读取 token → 写入 document.cookie
 * 2. 后续客户端导航到 /create 等页面时，浏览器自动携带 cookie
 * 3. 代理通过 cookie（途径3）完成认证
 */
export function TokenPersister() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) return;

    // 检查 cookie 是否已有有效 token（避免重复写入）
    const existing = document.cookie
      .split('; ')
      .find((row) => row.startsWith('cms_token='));
    if (existing) {
      const existingVal = existing.split('=')[1];
      if (existingVal === token) return; // 相同 token，跳过
    }

    // 写入 cookie：非 HttpOnly 版本，与代理设置的 HttpOnly cookie 共存
    // 不设 expires 则 session 级别有效
    document.cookie = `cms_token=${token}; path=/; SameSite=Lax`;
  }, [searchParams]);

  return null;
}
