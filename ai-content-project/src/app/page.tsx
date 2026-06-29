'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    // 直接重定向到 AI 创作助手页面
    router.replace('/create');
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F5F5F7]">
      <div className="flex flex-col items-center gap-3">
        <div className="size-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
        <p className="text-sm text-muted-foreground">正在进入 AI 创作助手...</p>
      </div>
    </div>
  );
}
