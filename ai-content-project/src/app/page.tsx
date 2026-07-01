'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';

export default function HomePage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get('token');
    // 重定向到 AI 创作助手，携带 token 以通过 Go 代理认证
    if (token) {
      router.replace(`/create?token=${encodeURIComponent(token)}`);
    } else {
      router.replace('/create');
    }
  }, [router, searchParams]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F5F5F7]">
      <div className="flex flex-col items-center gap-3">
        <div className="size-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
        <p className="text-sm text-muted-foreground">正在进入 AI 创作助手...</p>
      </div>
    </div>
  );
}
