"use client";

import { useState, useEffect } from "react";
import styles from "./page.module.css";

interface NewsItem {
  title: string;
  link: string;
  summary: string;
  aiSummary?: string;
  source: string;
  pubDate: string;
}

export default function Home() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchNews();
  }, []);

  const fetchNews = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/news");
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setNews(data);
    } catch (err) {
      setError("Failed to fetch news");
      console.error("Error fetching news:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className={styles.container}>Loading...</div>;
  if (error) return <div className={styles.container}>Error: {error}</div>;

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Tech News Summary</h1>
      <div className={styles.newsGrid}>
        {news.map((item, index) => (
          <div key={index} className={styles.newsCard}>
            <div className={styles.source}>{item.source}</div>
            <h2 className={styles.newsTitle}>
              <a href={item.link} target="_blank" rel="noopener noreferrer">
                {item.title}
              </a>
            </h2>
            <div className={styles.date}>
              {new Date(item.pubDate).toLocaleDateString()}
            </div>
            {item.aiSummary && (
              <div className={styles.summary}>
                <h3>AI Summary:</h3>
                <p>{item.aiSummary}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
