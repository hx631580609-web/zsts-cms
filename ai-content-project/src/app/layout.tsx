import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Inspector } from 'react-dev-inspector';
import { TokenPersister } from '@/components/token-persister';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'ZSTS内容后台',
    template: '%s | ZSTS内容后台',
  },
  description: '签证业务内容生产与分发中枢',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const isDev = process.env.COZE_PROJECT_ENV === 'DEV';

  return (
    <html lang="zh-CN">
      <body className={`antialiased`}>
        {isDev && <Inspector />}
        <Suspense fallback={null}>
          <TokenPersister />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
