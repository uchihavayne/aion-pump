/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false, // Bunu false yapın, çünkü strict mode hook'ları iki kere çalıştırır
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
