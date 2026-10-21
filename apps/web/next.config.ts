import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  ...(process.env.MOBILE_BUILD === 'true' ? { output: 'export' as const } : {}),
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
  // Also register the proxy with Next.js: Netlify may build from apps/web
  // without loading the repository-root netlify.toml. beforeFiles takes
  // precedence over local API handlers, which cannot reach the private VM.
  rewrites: async () => process.env.NETLIFY === 'true' ? {
    beforeFiles: [{
      source: '/api/:path*',
      destination: 'https://cofarmz-backend-866114557322.asia-south1.run.app/api/:path*?__cofarmz_website=1',
    }],
    afterFiles: [],
    fallback: [],
  } : [],
  webpack: (config) => {
    return config;
  },
};

export default nextConfig;
