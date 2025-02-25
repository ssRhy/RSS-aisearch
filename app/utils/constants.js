// 创建环境特定常量
const isDevelopment = process.env.NODE_ENV === "development";
const isProduction = process.env.NODE_ENV === "production";

// API设置
const API_TIMEOUT = isProduction ? 20000 : 15000; // 生产环境更长超时
const SUMMARY_MAX_LENGTH = isProduction ? 300 : 200; // 调整摘要长度

export const constants = {
  isDevelopment,
  isProduction,
  API_TIMEOUT,
  SUMMARY_MAX_LENGTH,
  // 其他环境特定配置...
};

export default constants;
