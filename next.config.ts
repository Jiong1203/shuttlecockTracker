import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 啟用圖片優化
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
  // 優化編譯
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  // 實驗性功能：優化打包
  experimental: {
    optimizePackageImports: ['lucide-react', '@radix-ui/react-dialog', '@radix-ui/react-label'],
  },
};

export default nextConfig;
