import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ['@google/genai', 'groq-sdk'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.redd.it' },
      { protocol: 'https', hostname: '**.reddit.com' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
    ],
  },
};

export default nextConfig;
