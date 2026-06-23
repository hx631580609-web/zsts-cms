'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Plus,
  Link2,
  FileUp,
  Sparkles,
  ClipboardPaste,
  Search,
  MoreHorizontal,
  ArrowRight,
  Image,
  Film,
  FileText,
  LayoutDashboard,
  User,
} from 'lucide-react';

function getCookie(name: string) {
  const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : null;
}
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  CONTENT_ITEMS,
  SOURCE_COLOR_MAP,
  STATUS_COLOR_MAP,
  type ContentItem,
  type ContentSource,
} from '@/lib/data';

const SOURCE_ICONS: Record<ContentSource, React.ReactNode> = {
  '链接读取': <Link2 className="size-3.5" />,
  '文件识别': <FileUp className="size-3.5" />,
  'AI生成': <Sparkles className="size-3.5" />,
  '人工粘贴': <ClipboardPaste className="size-3.5" />,
};

export default function DashboardPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [cmsUser, setCmsUser] = useState<string | null>(null);

  useEffect(() => { setCmsUser(getCookie('cms_user')); }, []);

  const filteredItems = CONTENT_ITEMS.filter((item) => {
    const matchesSearch =
      !searchQuery ||
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.tags.some((t) => t.includes(searchQuery));
    const matchesCategory =
      !filterCategory || item.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const stats = {
    total: CONTENT_ITEMS.length,
    draft: CONTENT_ITEMS.filter((i) => i.status === '草稿').length,
    generated: CONTENT_ITEMS.filter((i) => i.status === '已生成').length,
    published: CONTENT_ITEMS.filter((i) => i.status === '已发布').length,
  };

  return (
    <div className="min-h-screen bg-[#F5F5F7]">
      {/* 顶部导航 */}
      <header className="sticky top-0 z-20 border-b bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <div className="flex items-center gap-2.5">
            <LayoutDashboard className="size-5 text-[#1D4ED8]" />
            <span className="text-base font-semibold tracking-tight">
              ZSTS 内容后台
            </span>
          </div>
          <div className="flex items-center gap-2">
            {cmsUser ? (
              <div className="flex items-center gap-2 rounded-full border bg-gray-50 px-3 py-1">
                <User className="size-3.5 text-gray-500" />
                <span className="text-xs font-medium text-gray-700">{cmsUser}</span>
              </div>
            ) : (
              <div className="flex size-8 items-center justify-center rounded-full bg-[#1D4ED8] text-xs font-medium text-white">
                Z
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 space-y-6">
        {/* 统计卡片 */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: '内容总数', value: stats.total, color: 'text-foreground' },
            {
              label: '草稿',
              value: stats.draft,
              color: 'text-zinc-500',
            },
            {
              label: '已生成',
              value: stats.generated,
              color: 'text-emerald-600',
            },
            {
              label: '已发布',
              value: stats.published,
              color: 'text-blue-600',
            },
          ].map((stat) => (
            <Card key={stat.label} className="gap-0 py-0 shadow-sm">
              <CardContent className="px-4 py-3.5">
                <p className="text-xs text-muted-foreground">{stat.label}</p>
                <p className={`text-2xl font-semibold tracking-tight ${stat.color}`}>
                  {stat.value}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* 创建内容入口 */}
        <section>
          <Link href="/create">
            <Card className="shadow-sm transition-all hover:shadow-md cursor-pointer border-dashed border-2 border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50">
              <CardContent className="flex items-center justify-center gap-3 py-5">
                <div className="flex size-10 items-center justify-center rounded-xl bg-blue-600 text-white">
                  <Plus className="size-5" />
                </div>
                <div>
                  <p className="text-base font-semibold text-blue-700">AI创建内容</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        </section>

        {/* 内容池 */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">内容池</h2>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="搜索标题或标签..."
                  className="h-8 w-52 pl-8 text-xs"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-1">
                {(['全部', '沙特签证', '中东商旅', '出行指南', '政策解读'] as const).map(
                  (cat) => (
                    <Button
                      key={cat}
                      variant={
                        filterCategory === cat ||
                        (cat === '全部' && !filterCategory)
                          ? 'default'
                          : 'outline'
                      }
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() =>
                        setFilterCategory(cat === '全部' ? null : cat)
                      }
                    >
                      {cat}
                    </Button>
                  ),
                )}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            {filteredItems.map((item) => (
              <ContentRow key={item.id} item={item} />
            ))}
            {filteredItems.length === 0 && (
              <div className="flex flex-col items-center justify-center rounded-xl border bg-white py-12 text-sm text-muted-foreground">
                <Search className="mb-2 size-8 opacity-30" />
                未找到匹配的内容
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

function ContentRow({ item }: { item: ContentItem }) {
  return (
    <div className="group flex items-center gap-4 rounded-xl border bg-white px-5 py-4 shadow-sm transition-shadow hover:shadow-md">
      {/* 标题与信息 */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{item.title}</p>
        <div className="mt-1 flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {item.category}
          </span>
          <span className="text-xs text-muted-foreground">·</span>
          <span className="text-xs text-muted-foreground">
            {item.createdAt}
          </span>
          {item.tags.slice(0, 3).map((tag) => (
            <Badge key={tag} variant="outline" className="h-4 px-1.5 text-[10px]">
              {tag}
            </Badge>
          ))}
        </div>
      </div>

      {/* 已生成类型 */}
      <div className="flex items-center gap-1.5">
        {item.generatedTypes.includes('文章') && (
          <Badge
            variant="outline"
            className="gap-1 border-emerald-200 bg-emerald-50 text-[11px] text-emerald-700"
          >
            <FileText className="size-3" />
            文章
          </Badge>
        )}
        {item.generatedTypes.includes('海报') && (
          <Badge
            variant="outline"
            className="gap-1 border-indigo-200 bg-indigo-50 text-[11px] text-indigo-700"
          >
            <Image className="size-3" />
            海报
          </Badge>
        )}
        {item.hasVideo && (
          <Badge
            variant="outline"
            className="gap-1 border-amber-200 bg-amber-50 text-[11px] text-amber-700"
          >
            <Film className="size-3" />
            视频
          </Badge>
        )}
      </div>

      {/* 状态 */}
      <Badge
        variant="secondary"
        className={`text-[11px] ${STATUS_COLOR_MAP[item.status]}`}
      >
        {item.status}
      </Badge>

      {/* 操作 */}
      <div className="flex items-center gap-1">
        {item.status === '草稿' && (
          <Link href={`/poster?contentId=${item.id}`}>
            <Button variant="outline" size="sm" className="h-7 gap-1 text-xs">
              生成内容
              <ArrowRight className="size-3" />
            </Button>
          </Link>
        )}
        {item.status === '已生成' && (
          <Link href={`/result?contentId=${item.id}`}>
            <Button variant="outline" size="sm" className="h-7 gap-1 text-xs">
              查看结果
              <ArrowRight className="size-3" />
            </Button>
          </Link>
        )}
        <Button variant="ghost" size="icon-sm" className="size-7">
          <MoreHorizontal className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}
