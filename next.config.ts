import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // TypeScript strict mode — NO ignoreBuildErrors
  typescript: {
    ignoreBuildErrors: false,
  },
  serverExternalPackages: ['@google/genai', 'groq-sdk'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.redd.it' },
      { protocol: 'https', hostname: '**.reddit.com' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: 'assets.coingecko.com' },
    ],
  },
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type' },
        ],
      },
    ];
  },
};

export default nextConfig;
