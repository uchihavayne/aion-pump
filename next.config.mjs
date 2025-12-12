/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    // Hataları yoksay ve build al
    ignoreBuildErrors: true,
  },
  eslint: {
    // Lint hatalarını yoksay
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
