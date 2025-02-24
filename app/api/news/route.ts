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
      .replace(/确保[^。]*。/g, "")
      .replace(/现在[^。]*。/g, "")
      .replace(/最后[^。]*。/g, "")
      .trim();

    // 检查是否包含思考过程关键词
    const thinkingKeywords = [
      "处理", "总结一下", "我来", "整理", "思考",
      "格式要求", "标签包裹", "不添加"
    ];

    // 如果包含思考过程关键词，返回空字符串
    if (thinkingKeywords.some(keyword => summary.includes(keyword))) {
      return "";
    }

    // 提取<summary>标签中的内容，如果没有则添加
    let summaryMatch = summary.match(/<summary>([\s\S]*?)<\/summary>/);
    
    if (!summaryMatch) {
      // 如果文本不是以标点符号结尾，可能是不完整的
      if (!summary.match(/[。！？]$/)) {
        // 尝试寻找最后一个完整句子
        const lastSentence = summary.match(/[^。！？]*[。！？]/g);
        if (lastSentence) {
          summary = lastSentence.join('');
        } else {
          return "";
        }
      }
      summary = `<summary>${summary}</summary>`;
      summaryMatch = summary.match(/<summary>([\s\S]*?)<\/summary>/);
    }

    let finalSummary = summaryMatch ? summaryMatch[1].trim() : "";

    // 如果总结太短，尝试保留更多内容
    if (finalSummary.length < 10 && summary.length > 10) {
      finalSummary = summary.replace(/<\/?summary>/g, '').trim();
    }

    // 最终验证
    if (!finalSummary || 
        finalSummary.length > 200 || // 保持长度限制
        thinkingKeywords.some(keyword => finalSummary.includes(keyword)) // 仍然检查关键词
    ) {
      return "";
    }

    // 确保以标点符号结尾
    if (!finalSummary.match(/[。！？]$/)) {
      finalSummary += '。';
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
