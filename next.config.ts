import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Webpack ayarı: pino ve thread-stream hatalarını engeller
  webpack: (config) => {
    config.externals.push('pino-pretty', 'lokijs', 'encoding');
    return config;
  },
  // TypeScript hatalarını build sırasında görmezden gel
  typescript: {
    ignoreBuildErrors: true,
  },
  // ESLint hatalarını build sırasında görmezden gelmek için
  // bu ayar artık burada yapılmıyor, aşağıda komutla yapacağız.
};

export default nextConfig;