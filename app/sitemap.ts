import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_APP_URL || 'https://flowsentinel-app.vercel.app';
  const paths = ['', '/demo', '/track-record', '/terms', '/privacy'];
  const now = new Date();
  return paths.map((p) => ({
    url: `${base}${p || '/'}`,
    lastModified: now,
    changeFrequency: 'daily' as const,
    priority: p === '' ? 1 : 0.7,
  }));
}
