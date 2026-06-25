import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const NEWS_JSON_PATH = path.join(process.cwd(), '..', 'content', 'pages', 'saudi-news.json');

interface ArticlePayload {
  title: string;
  desc: string;
  image?: string;
  imageAlt?: string;
  tag?: string;
  tagColor?: string;
  category?: string;
  author?: string;
  content: string;
}

function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export async function POST(req: NextRequest) {
  try {
    const payload: ArticlePayload = await req.json();
    if (!payload.title || !payload.content) {
      return NextResponse.json({ success: false, error: '标题和正文内容不能为空' }, { status: 400 });
    }

    if (!fs.existsSync(NEWS_JSON_PATH)) {
      return NextResponse.json({ success: false, error: 'news.json 不存在' }, { status: 500 });
    }

    const raw = fs.readFileSync(NEWS_JSON_PATH, 'utf-8');
    const data = JSON.parse(raw);

    const zhArticles: any[] = data?.articles?.items?.zh || [];
    const hotItems: { text: string }[] = data?.sidebar?.hot?.items?.zh || [];

    const tag = payload.tag || '沙特资讯';
    const tagColor = payload.tagColor || 'green';
    const category = payload.category || 'all';
    const author = payload.author || 'ZSTS签证通';

    const newArticle = {
      title: payload.title,
      desc: payload.desc || payload.title,
      image: payload.image || 'images/riyadh-skyline.jpg',
      imageAlt: payload.imageAlt || payload.title,
      tag,
      tagColor,
      date: todayStr(),
      author,
      category,
      link: 'news-detail.html?id=0',
      reverse: false,
      content: payload.content,
    };

    // 插入到列表开头，并重新计算 link 的 id
    zhArticles.unshift(newArticle);
    zhArticles.forEach((item, idx) => {
      item.link = `news-detail.html?id=${idx}`;
    });

    // 同步更新热门资讯（最多保留 5 条）
    hotItems.unshift({ text: newArticle.title });
    if (hotItems.length > 5) hotItems.length = 5;

    fs.writeFileSync(NEWS_JSON_PATH, JSON.stringify(data, null, 2), 'utf-8');

    return NextResponse.json({ success: true, message: '已发布到沙特资讯' });
  } catch (err: any) {
    console.error('[publish-to-news] 发布失败:', err);
    return NextResponse.json({ success: false, error: err.message || '发布失败' }, { status: 500 });
  }
}
