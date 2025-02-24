"use client";

import { useEffect, useState } from "react";

interface NewsItem {
  title: string;
  link: string;
  pubDate: string;
  source: string;
  summary: string;
}

export default function NewsPage() {
  const [news, setNews] = useState<NewsItem[]>([]); // 确保初始化为空数组
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNews = async () => {
      try {
        setLoading(true);
        const response = await fetch("/api/news");
        const data = await response.json();
        // 确保data.feeds存在且是数组
        const newsItems = Array.isArray(data.feeds) ? data.feeds : [];
        console.log('Fetched news items:', newsItems); // 调试日志
        setNews(newsItems);
        setLoading(false);
      } catch (error) {
        console.error("Error fetching news:", error);
        setLoading(false);
      }
    };

    fetchNews();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-xl">加载中...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">科技新闻聚合</h1>
      <div className="grid gap-6">
        {Array.isArray(news) && news.map((item: NewsItem, index: number) => (
          <div
            key={index}
            className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-medium px-2 py-1 bg-gray-100 rounded">
                {item.source}
              </span>
              <span className="text-sm text-gray-500">
                {new Date(item.pubDate).toLocaleDateString("zh-CN")}
              </span>
            </div>
            
            <h2 className="text-xl font-semibold mb-3">
              <a href={item.link} target="_blank" rel="noopener noreferrer" className="hover:text-blue-600">
                {item.title}
              </a>
            </h2>
            
            <div className="mt-3 p-4 bg-gray-50 rounded-md">
              <div className="flex items-center gap-2 mb-2">
                <svg
                  className="w-5 h-5 text-blue-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
                <span className="font-medium text-gray-700">AI 总结</span>
              </div>
              <p className="text-gray-600 text-sm leading-relaxed">
                {item.summary}
              </p>
            </div>
            
            <div className="mt-4 flex justify-end">
              <a
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:text-blue-700 text-sm font-medium"
              >
                阅读全文 →
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
