"use client";

import { useState, useEffect } from "react";
import styles from "./page.module.css";

interface NewsItem {
  title: string;
  link: string;
  pubDate: string;
  source: string;
  summary: string;
}

export default function Home() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchNews = async () => {
      try {
        setLoading(true);
        setError(null);
        console.log("Fetching news..."); // 调试日志

        const response = await fetch("/api/news");
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log("Received data:", data); // 调试日志

        if (!data.feeds) {
          throw new Error("No feeds data received");
        }

        const newsItems = Array.isArray(data.feeds) ? data.feeds : [];
        console.log("Processed news items:", newsItems); // 调试日志

        setNews(newsItems);
      } catch (error) {
        console.error("Error fetching news:", error);
        setError(
          error instanceof Error ? error.message : "Failed to fetch news"
        );
      } finally {
        setLoading(false);
      }
    };

    fetchNews();
  }, []);

  if (loading) {
    return (
      <main className={styles.main}>
        <h1 className={styles.title}>Tech News Summary</h1>
        <div className={styles.loading}>Loading news...</div>
      </main>
    );
  }

  if (error) {
    return (
      <main className={styles.main}>
        <h1 className={styles.title}>Tech News Summary</h1>
        <div className={styles.error}>Error: {error}</div>
      </main>
    );
  }

  const debugInfo =
    process.env.NODE_ENV !== "production" ||
    new URLSearchParams(window.location.search).has("debug");

  return (
    <main className={styles.main}>
      <h1 className={styles.title}>Tech News Summary</h1>
      <div className={styles.newsGrid}>
        {news.length > 0 ? (
          news.map((item, index) => (
            <div key={`${item.source}-${index}`} className={styles.newsCard}>
              <div className={styles.source}>{item.source}</div>
              <h2 className={styles.newsTitle}>
                <a href={item.link} target="_blank" rel="noopener noreferrer">
                  {item.title}
                </a>
              </h2>
              <div className={styles.date}>
                {new Date(item.pubDate).toLocaleDateString()}
              </div>
              {item.summary && (
                <div className={styles.summary}>
                  <div className={styles.summaryHeader}>
                    <span>AI Summary</span>
                  </div>
                  <p>{item.summary}</p>
                </div>
              )}
            </div>
          ))
        ) : (
          <div className={styles.noNews}>
            <p>No news available at the moment.</p>
            <p>Please try again later.</p>
          </div>
        )}
      </div>
      {debugInfo && (
        <div
          className={styles.debugInfo}
          style={{
            margin: "20px",
            padding: "15px",
            border: "1px solid #ccc",
            backgroundColor: "#f0f0f0",
            borderRadius: "8px",
          }}
        >
          <h3>环境诊断信息</h3>
          <p>
            <strong>环境:</strong> {process.env.NODE_ENV}
          </p>
          <p>
            <strong>数据条数:</strong> {news.length}
          </p>
          <p>
            <strong>窗口宽度:</strong>{" "}
            {typeof window !== "undefined" ? window.innerWidth : "unknown"}
          </p>
          <p>
            <strong>API路径:</strong> {"/api/news"}
          </p>
          <p>
            <strong>用户代理:</strong>{" "}
            {typeof navigator !== "undefined" ? navigator.userAgent : "unknown"}
          </p>
          <p>
            <strong>渲染时间:</strong> {new Date().toLocaleTimeString()}
          </p>

          {/* 显示第一个新闻摘要信息 */}
          {news.length > 0 && (
            <div style={{ marginTop: "10px" }}>
              <h4>第一条新闻摘要信息</h4>
              <p>
                <strong>标题:</strong> {news[0].title}
              </p>
              <p>
                <strong>来源:</strong> {news[0].source}
              </p>
              <p>
                <strong>摘要长度:</strong> {news[0].summary?.length || 0}字
              </p>
              <p>
                <strong>摘要前50字:</strong> {news[0].summary?.substring(0, 50)}
              </p>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
