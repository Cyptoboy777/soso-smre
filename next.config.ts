import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typescript: { ignoreBuildErrors: false },
  serverExternalPackages: ['@google/genai'],
};

export default nextConfig;
