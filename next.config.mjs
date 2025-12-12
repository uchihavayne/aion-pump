/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false, // BURASI ÇOK ÖNEMLİ! false yapın
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  webpack: (config) => {
    config.resolve.fallback = { fs: false, net: false, tls: false };
    config.externals.push("pino-pretty", "lokijs", "encoding");
    return config;
  },
};

export default nextConfig;
