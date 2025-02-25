// 部署前检查脚本
console.log("Checking deployment configuration...");

// 检查环境变量
if (!process.env.SILICONFLOW_API_KEY) {
  console.error("警告: 缺少 SILICONFLOW_API_KEY 环境变量");
  process.exit(1);
}

// 检查基础路径配置
const nextConfig = require("../next.config.js");
if (!nextConfig.basePath && process.env.NODE_ENV === "production") {
  console.warn("警告: 生产环境未配置 basePath，可能导致资源路径错误");
}

console.log("配置检查完成！");
