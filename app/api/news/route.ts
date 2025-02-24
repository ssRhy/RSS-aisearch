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
            role: "system",
            content:
              "你是新闻总结机器人。你只会输出最终的新闻总结文本。你被禁止输出任何其他内容。",
          },
          {
            role: "user",
            content: `新闻内容如下：\n\n${content}\n\n[格式要求]\n输出格式：<summary>你的总结</summary>\n\n[输出要求]\n1. 字数限制：100字以内\n2. 只允许输出<summary>标签内的内容\n3. 禁止输出任何标签外的文字\n4. 禁止输出思考过程`,
          },
          {
            role: "assistant",
            content:
              "明白。我只会用<summary>标签包裹最终总结，不会输出任何其他内容。",
          },
        ],
        max_tokens: 256,
        temperature: 0.1,
        top_p: 0.5,
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

    // 提取和处理输出内容
    let summary = response.data.choices[0].message.content.trim();

    // 移除"AI Summary:"前缀
    summary = summary.replace(/^AI Summary:/, "").trim();

    // 移除所有的思考过程（以特定词语开头的句子）
    summary = summary
      .replace(/现在开始处理[^。]*。/g, "")
      .replace(/首先[^。]*。/g, "")
      .replace(/接下来[^。]*。/g, "")
      .replace(/然后[^。]*。/g, "")
      .replace(/需要[^。]*。/g, "")
      .replace(/我们要[^。]*。/g, "")
      .replace(/让我们[^。]*。/g, "")
      .replace(/好的[^。]*。/g, "")
      .trim();

    // 如果内容不在<summary>标签内，则添加标签
    if (!/<summary>[\s\S]*<\/summary>/.test(summary)) {
      // 如果文本看起来像是思考过程，返回空字符串
      if (
        summary.includes("处理") ||
        summary.includes("分析") ||
        summary.includes("总结一下") ||
        summary.includes("我来")
      ) {
        return "";
      }
      summary = `<summary>${summary}</summary>`;
    }

    // 提取<summary>标签中的内容
    const summaryMatch = summary.match(/<summary>([\s\S]*?)<\/summary>/);
    const finalSummary = summaryMatch ? summaryMatch[1].trim() : summary.trim();

    // 如果最终结果仍然包含思考过程的特征，返回空字符串
    if (
      finalSummary.includes("处理") ||
      finalSummary.includes("分析") ||
      finalSummary.includes("总结一下") ||
      finalSummary.includes("我来")
    ) {
      return "";
    }

    return finalSummary;
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
