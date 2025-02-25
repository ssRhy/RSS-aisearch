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
    let simpleSummary = sentences.slice(0, 3).join(""); // 增加到3句以获取更多内容

    return simpleSummary || content.substring(0, 150); // 增加长度以获取更完整的摘要
  }

  try {
    const apiEndpoint = "https://api.siliconflow.cn/v1/chat/completions";
    const model = "deepseek-ai/DeepSeek-R1-Distill-Llama-8B";

    const apiRequest = {
      model: model,
      messages: [
        {
          role: "system",
          content:
            "你是新闻总结机器人。你需要提供完整、准确的新闻摘要，确保信息完整且易于理解。",
        },
        {
          role: "user",
          content: `新闻内容如下：\n\n${content}\n\n请提供一段150字以内的完整摘要，保留关键信息。直接输出摘要文字，不要添加任何前缀或标签。`,
        },
      ],
      max_tokens: 300, // 增加token上限以获取更完整的回复
      temperature: 0.2, // 降低随机性，提高一致性
    };

    // 添加重试逻辑
    let retries = 2;
    let response;

    while (retries >= 0) {
      try {
        response = await axios.post(apiEndpoint, apiRequest, {
          headers: {
            Authorization: `Bearer ${process.env.SILICONFLOW_API_KEY}`,
            "Content-Type": "application/json",
          },
          timeout: 15000, // 增加超时时间到15秒
        });
        break; // 如果成功就跳出循环
      } catch (error) {
        console.error(`API调用失败，剩余重试次数: ${retries}`, error);
        if (retries <= 0) throw error;
        retries--;
        // 重试前等待一秒
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    if (!response?.data?.choices?.[0]?.message?.content) {
      console.error("无效的AI响应格式:", response?.data);
      return null;
    }

    // 处理响应文本
    let summary = response.data.choices[0].message.content.trim();

    // 只保留纯文本摘要，移除任何指令或标签
    summary = summary
      .replace(/<summary>/g, "")
      .replace(/<\/summary>/g, "")
      .replace(/^AI Summary:/i, "")
      .replace(/^摘要:/i, "")
      .trim();

    // 确保摘要不会太短
    if (summary.length < 20) {
      console.warn("AI摘要太短，尝试提取原文内容");
      const sentences = content.match(/[^。！？.!?]+[。！？.!?]/g) || [];
      summary = sentences.slice(0, 3).join("");
    }

    return summary;
  } catch (error) {
    console.error("AI摘要生成失败:", error);

    // 降级处理：从原始内容提取
    const sentences = content.match(/[^。！？.!?]+[。！？.!?]/g) || [];
    let fallbackSummary = sentences.slice(0, 3).join("");
    return fallbackSummary || content.substring(0, 150);
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
