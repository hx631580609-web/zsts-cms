'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Plus,
  Sparkles,
  Search,
  FileText,
  LayoutDashboard,
  User,
  Eye,
  Trash2,
  Loader2,
  ArrowLeft,
} from 'lucide-react';

function getCookie(name: string) {
  const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : null;
}
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';

// 文章类型定义
interface Article {
  id: number;
  title: string;
  summary: string;
  tags: string;
  cover_image: string;
  source: string;
  word_count: number;
  status: 'draft' | 'published';
  author: string;
  created_at: string;
  updated_at: string;
}

// 文章统计
interface ArticleStats {
  total: number;
  draft: number;
  published: number;
  today: number;
}

export default function DashboardPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [cmsUser, setCmsUser] = useState<string | null>(null);
  const [articles, setArticles] = useState<Article[]>([]);
  const [stats, setStats] = useState<ArticleStats>({ total: 0, draft: 0, published: 0, today: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => { setCmsUser(getCookie('cms_user')); }, []);

  const fetchArticles = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('cms_token') || '';
      const params = new URLSearchParams();
      if (searchQuery) params.set('search', searchQuery);
      if (filterStatus) params.set('status', filterStatus);
      params.set('limit', '50');

      const res = await fetch(`/api/articles?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      setArticles(data.rows || []);
    } catch (e) {
      console.error('获取文章列表失败:', e);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, filterStatus]);

  const fetchStats = useCallback(async () => {
    try {
      const token = localStorage.getItem('cms_token') || '';
      const res = await fetch('/api/articles/stats', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      setStats(data);
    } catch (e) {
      console.error('获取统计失败:', e);
    }
  }, []);

  useEffect(() => {
    fetchArticles();
    fetchStats();
  }, [fetchArticles, fetchStats]);

  const handleDelete = async (id: number, title: string) => {
    if (!confirm(`确定要删除文章「${title}」吗？`)) return;
    try {
      const token = localStorage.getItem('cms_token') || '';
      const res = await fetch(`/api/articles/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) {
        fetchArticles();
        fetchStats();
      }
    } catch (e) {
      console.error('删除失败:', e);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'draft': return '草稿';
      case 'published': return '已发布';
      default: return status;
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F5F7]">
      {/* 顶部导航 */}
      <header className="sticky top-0 z-20 border-b bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <div className="flex items-center gap-2.5">
            <Link href="/create">
              <Button variant="ghost" size="icon-sm">
                <ArrowLeft className="size-4" />
              </Button>
            </Link>
            <LayoutDashboard className="size-5 text-[#1D4ED8]" />
            <span className="text-base font-semibold tracking-tight">
              文章管理
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/create">
              <Button size="sm" className="gap-1.5">
                <Plus className="size-3.5" />
                新建文章
              </Button>
            </Link>
            {cmsUser ? (
              <div className="flex items-center gap-2 rounded-full border bg-gray-50 px-3 py-1">
                <User className="size-3.5 text-gray-500" />
                <span className="text-xs font-medium text-gray-700">{cmsUser}</span>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 space-y-6">
        {/* 统计卡片 */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: '文章总数', value: stats.total, color: 'text-foreground' },
            { label: '草稿', value: stats.draft, color: 'text-zinc-500' },
            { label: '已发布', value: stats.published, color: 'text-emerald-600' },
            { label: '今日新增', value: stats.today, color: 'text-blue-600' },
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

        {/* 文章列表 */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">文章列表</h2>
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
                {[
                  { label: '全部', value: null },
                  { label: '草稿', value: 'draft' },
                  { label: '已发布', value: 'published' },
                ].map((item) => (
                  <Button
                    key={item.label}
                    variant={
                      filterStatus === item.value ||
                      (item.value === null && !filterStatus)
                        ? 'default'
                        : 'outline'
                    }
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setFilterStatus(item.value)}
                  >
                    {item.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            {loading ? (
              <div className="flex items-center justify-center rounded-xl border bg-white py-12">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            ) : articles.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border bg-white py-12 text-sm text-muted-foreground">
                <Search className="mb-2 size-8 opacity-30" />
                {searchQuery || filterStatus ? '未找到匹配的文章' : '暂无文章，点击右上角新建'}
              </div>
            ) : (
              articles.map((article) => (
                <div key={article.id} className="group flex items-center gap-4 rounded-xl border bg-white px-5 py-4 shadow-sm transition-shadow hover:shadow-md">
                  {/* 标题与信息 */}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{article.title}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {article.source || 'AI生成'}
                      </span>
                      <span className="text-xs text-muted-foreground">·</span>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(article.created_at)}
                      </span>
                      <span className="text-xs text-muted-foreground">·</span>
                      <span className="text-xs text-muted-foreground">
                        {article.word_count} 字
                      </span>
                      {article.tags && article.tags.split(/[,,、]/).slice(0, 3).map((tag, i) => (
                        <Badge key={i} variant="outline" className="h-4 px-1.5 text-[10px]">
                          {tag.trim()}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* 类型 */}
                  <div className="flex items-center gap-1.5">
                    <Badge
                      variant="outline"
                      className="gap-1 border-emerald-200 bg-emerald-50 text-[11px] text-emerald-700"
                    >
                      <FileText className="size-3" />
                      文章
                    </Badge>
                  </div>

                  {/* 状态 */}
                  <Badge
                    variant="secondary"
                    className={`text-[11px] ${article.status === 'published' ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-100 text-zinc-600'}`}
                  >
                    {getStatusLabel(article.status)}
                  </Badge>

                  {/* 操作 */}
                  <div className="flex items-center gap-1">
                    <Link href={`/article?id=${article.id}`}>
                      <Button variant="outline" size="sm" className="h-7 gap-1 text-xs">
                        <Eye className="size-3" />
                        查看
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="size-7 text-red-500 hover:text-red-600 hover:bg-red-50"
                      onClick={() => handleDelete(article.id, article.title)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
