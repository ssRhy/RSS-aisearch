import Parser from "rss-parser";
import axios from "axios";
import { NextResponse } from "next/server";

// 定义 RSS 源
const RSS_FEEDS = {
  "36kr": "https://36kr.com/feed",
  geekpark: "https://www.geekpark.net/rss",
  cyzone: "https://special.cyzone.cn/rss",
};

// 创建解析器实例
const parser = new Parser({
  customFields: {
    item: [
      "geekpark",
      "cyzone",
      "36kr",
      "pubDate",
      "content",
      "contentSnippet",
    ],
  },
});

async function summarizeWithAI(content: string) {
  if (!process.env.SILICONFLOW_API_KEY) {
    console.error("Missing SILICONFLOW_API_KEY");
    return null;
  }

  try {
    const response = await axios.post(
      "https://api.siliconflow.cn/v1/chat/completions",
      {
        model: "deepseek-ai/DeepSeek-R1-Distill-Llama-8B",
        messages: [
          {
            role: "user",
            content: `请简要总结以下新闻内容（100字以内）：${content}`,
          },
        ],
        max_tokens: 512,
        temperature: 0.7,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.SILICONFLOW_API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 10000, // 10 seconds timeout
      }
    );

    if (!response.data?.choices?.[0]?.message?.content) {
      console.error("Invalid AI response format:", response.data);
      return null;
    }

    return response.data.choices[0].message.content;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error("AI API Error:", {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
      });
    } else {
      console.error("Unknown error during AI summarization:", error);
    }
    return null;
  }
}

async function fetchRSSFeed(source: string, url: string) {
  try {
    const feed = await parser.parseURL(url);
    if (!feed?.items?.length) {
      console.error(`No items found in feed for ${source}`);
      return [];
    }

    const newsItems = await Promise.all(
      feed.items.slice(0, 5).map(async (item) => {
        const content = item.content || item.contentSnippet || item.title || "";
        const aiSummary = await summarizeWithAI(content);

        return {
          title: item.title || "无标题",
          link: item.link || "",
          summary: content,
          aiSummary,
          source,
          pubDate: item.pubDate || item.isoDate || new Date().toISOString(),
        };
      })
    );

    return newsItems.filter((item) => item.title && item.link);
  } catch (error) {
    console.error(`Error fetching ${source}:`, error);
    return [];
  }
}

export async function GET() {
  try {
    // 设置 CORS headers
    const headers = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };

    const feedPromises = Object.entries(RSS_FEEDS).map(([source, url]) =>
      fetchRSSFeed(source, url)
    );

    const results = await Promise.all(feedPromises);
    const allNews = results.flat();

    // 按日期排序
    allNews.sort((a, b) => {
      const dateA = new Date(a.pubDate);
      const dateB = new Date(b.pubDate);
      return dateB.getTime() - dateA.getTime();
    });

    return NextResponse.json(allNews, { headers });
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch news",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500, headers: { "Access-Control-Allow-Origin": "*" } }
    );
  }
}

// 处理 OPTIONS 请求
export async function OPTIONS() {
  return NextResponse.json(
    {},
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    }
  );
}
