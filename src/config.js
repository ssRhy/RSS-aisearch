// 使用环境变量区分不同环境
const baseUrl =
  process.env.NODE_ENV === "production"
    ? "https://your-production-api.com"
    : "http://localhost:3000";

// 添加API路径处理
const apiPath =
  process.env.NODE_ENV === "production"
    ? "/your-repo-name/api" // 确保路径正确
    : "/api";

// 导出配置
const config = {
  baseUrl,
  apiPath,
  // 其他配置项...
};

export default config;
