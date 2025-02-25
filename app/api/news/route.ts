import Parser from "rss-parser";
import axios, { AxiosError } from "axios";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// 定义 RSS 源
const RSS_FEEDS = {
  "36KR": "https://www.36kr.com/feed",
  GEEKPARK: "https://www.geekpark.net/rss",
  OSCHINA: "https://www.oschina.net/news/rss",
  ITHOME: "https://www.ithome.com/rss/",
  CNBETA: "https://www.cnbeta.com/backend.php",
};

// 创建 RSS parser 实例
const parser = new Parser({
  customFields: {
    item: [
      ["media:content", "media"],
      ["content:encoded", "contentEncoded"],
      ["description", "description"],
      ["content", "content"],
    ],
  },
});

// 定义新闻项的接口
interface NewsItem {
  title: string;
  link: string;
  pubDate: string;
  source: string;
  summary: string;
}

// 定义 RSS 项的接口
interface RssItem {
  title?: string;
  link?: string;
  pubDate?: string;
  isoDate?: string;
  content?: string;
  contentEncoded?: string;
  contentSnippet?: string;
  description?: string;
  [key: string]: any; // 处理其他可能的字段
}

async function summarizeWithAI(content: string) {
  // 如果没有 API 密钥，使用简单的摘要提取方法
  if (!process.env.SILICONFLOW_API_KEY) {
    console.warn("Missing SILICONFLOW_API_KEY, using fallback summary method");

    // 提取内容的前几句作为摘要
    const sentences = content.match(/[^。！？.!?]+[。！？.!?]/g) || [];
    let simpleSummary = sentences.slice(0, 2).join("");

    // 如果摘要太长，截断它
    if (simpleSummary.length > 100) {
      simpleSummary = simpleSummary.substring(0, 100) + "...";
    }

    return simpleSummary || content.substring(0, 100);
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
      "处理",
      "总结一下",
      "我来",
      "整理",
      "思考",
      "格式要求",
      "标签包裹",
      "不添加",
    ];

    // 如果包含思考过程关键词，返回空字符串
    if (thinkingKeywords.some((keyword) => summary.includes(keyword))) {
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
          summary = lastSentence.join("");
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
      finalSummary = summary.replace(/<\/?summary>/g, "").trim();
    }

    // 最终验证
    if (
      !finalSummary ||
      finalSummary.length > 200 || // 保持长度限制
      thinkingKeywords.some((keyword) => finalSummary.includes(keyword)) // 仍然检查关键词
    ) {
      return "";
    }

    // 确保以标点符号结尾
    if (!finalSummary.match(/[。！？]$/)) {
      finalSummary += "。";
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

export async function GET(request: NextRequest) {
  try {
    console.log("Starting to fetch RSS feeds..."); // 调试日志

    const feedPromises = Object.entries(RSS_FEEDS).map(
      async ([source, url]) => {
        try {
          console.log(`Fetching from ${source}: ${url}`); // 调试日志
          const feed = await parser.parseURL(url);
          console.log(
            `Received ${feed.items?.length || 0} items from ${source}`
          ); // 调试日志

          if (!feed?.items?.length) {
            console.log(`No items found in feed for ${source}`);
            return [];
          }

          const items = await Promise.all(
            feed.items.slice(0, 5).map(async (item: RssItem) => {
              try {
                console.log("Item fields:", Object.keys(item));
                console.log("Item content fields:", {
                  content: item.content ? "exists" : "null",
                  contentEncoded: item.contentEncoded ? "exists" : "null",
                  "content:encoded": item["content:encoded"]
                    ? "exists"
                    : "null",
                  contentSnippet: item.contentSnippet ? "exists" : "null",
                  description: item.description ? "exists" : "null",
                  title: item.title ? "exists" : "null",
                });

                // 尝试从多个可能的字段中获取内容
                let content = "";

                // 按优先级尝试不同的内容字段
                if (item.contentEncoded && item.contentEncoded.length > 20) {
                  content = item.contentEncoded;
                } else if (item.content && item.content.length > 20) {
                  content = item.content;
                } else if (item.description && item.description.length > 20) {
                  content = item.description;
                } else if (
                  item.contentSnippet &&
                  item.contentSnippet.length > 20
                ) {
                  content = item.contentSnippet;
                } else {
                  content = item.title || "";
                }

                // 移除HTML标签
                content = content.replace(/<[^>]*>/g, "");

                // 调试日志
                console.log(`Content source for "${item.title}":`, {
                  length: content.length,
                  preview: content.substring(0, 100) + "...",
                });

                console.log(`Processing item from ${source}: ${item.title}`); // 调试日志

                // 获取每个新闻的摘要
                const summary = await summarizeWithAI(content);
                console.log(
                  `Summary generated for ${item.title}: ${
                    summary ? "success" : "failed"
                  }`
                ); // 调试日志

                if (summary) {
                  return {
                    title: item.title || "无标题",
                    link: item.link || "",
                    pubDate:
                      item.pubDate || item.isoDate || new Date().toISOString(),
                    source,
                    summary,
                  } as NewsItem;
                }
                return null;
              } catch (error) {
                console.error(`Error processing item from ${source}:`, error);
                return null;
              }
            })
          );

          // 过滤掉没有摘要的新闻（null值）
          const validItems = items.filter(
            (item): item is NewsItem => item !== null
          );
          console.log(`Valid items from ${source}: ${validItems.length}`); // 调试日志
          return validItems;
        } catch (error) {
          console.error(`Error fetching ${source}:`, error);
          return [];
        }
      }
    );

    const allFeeds = await Promise.all(feedPromises);
    const feeds = allFeeds.flat().sort((a: NewsItem, b: NewsItem) => {
      return new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime();
    });

    console.log(`Total feeds after processing: ${feeds.length}`); // 调试日志

    return NextResponse.json(
      { feeds },
      {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      }
    );
  } catch (error) {
    console.error("Error in GET /api/news:", error);
    return NextResponse.json(
      { error: "Failed to fetch feeds", feeds: [] },
      { status: 500, headers: { "Access-Control-Allow-Origin": "*" } }
    );
  }
}

// 这个函数处理 OPTIONS 请求(预检请求)
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*", // 允许所有域名访问，生产环境建议设置为特定域名
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400", // 预检请求结果缓存时间(秒)
    },
  });
}
