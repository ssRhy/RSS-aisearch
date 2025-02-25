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
          style={{ margin: "10px", padding: "10px", border: "1px solid #ccc" }}
        >
          <p>环境: {process.env.NODE_ENV}</p>
          <p>数据条数: {news.length}</p>
          <p>
            窗口宽度:{" "}
            {typeof window !== "undefined" ? window.innerWidth : "unknown"}
          </p>
        </div>
      )}
    </main>
  );
}
