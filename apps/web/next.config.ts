import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: { buildActivity: false },
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: '**.githubusercontent.com' },
      { protocol: 'https', hostname: '**.googleusercontent.com' },
      { protocol: 'https', hostname: 'pub-65dc9b1c529c45e6a5f2e75c9a74fc49.r2.dev' },
    ],
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Exclude API routes from static build
  rewrites: async () => [],
  webpack: (config) => {
    return config;
  },
};

export default nextConfig;
