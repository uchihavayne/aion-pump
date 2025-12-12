import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typescript: {
    // ⚠️ DİKKAT: Bu satır TypeScript hatalarını görmezden gelir ve build almasını sağlar
    ignoreBuildErrors: true,
  },
  eslint: {
    // ⚠️ DİKKAT: Bu satır Lint hatalarını görmezden gelir
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
