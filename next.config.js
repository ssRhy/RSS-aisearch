/** @type {import('next').NextConfig} */
const nextConfig = {
  // 根据实际部署环境调整
  basePath: process.env.NODE_ENV === "production" ? "" : "", // 移除子路径配置
  assetPrefix: process.env.NODE_ENV === "production" ? "" : "",
  // 启用图像优化
  images: {
    domains: ["your-domain.com"], // 添加您的图片域名
  },
  // 确保客户端和服务端渲染一致
  reactStrictMode: true,
  // 输出选项
  output: "standalone",
};

module.exports = nextConfig;
