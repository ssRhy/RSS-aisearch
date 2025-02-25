import Image from "next/image";

// 错误写法
// <img src="/images/logo.png" />

// 正确写法
<Image src="/images/logo.png" width={100} height={100} alt="Logo" />;

// 或使用绝对路径（根据环境自动处理）
// import config from '../../src/config';
// <img src={`${config.baseUrl}/images/logo.png`} alt="Logo" />
