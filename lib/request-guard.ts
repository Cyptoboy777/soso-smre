import { NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';

/** Best-effort client IP behind Vercel / proxies. */
export function clientIp(req: Request): string {
  const xf = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  if (xf) return xf;
  const real = req.headers.get('x-real-ip')?.trim();
  if (real) return real;
  return 'anon';
}

/** Return a 429 JSON response when the bucket is empty; otherwise null. */
export function rejectIfRateLimited(
  key: string,
  limit: number,
  windowMs: number,
  message = 'Rate limit exceeded',
): NextResponse | null {
  const rl = rateLimit(key, limit, windowMs);
  if (rl.ok) return null;
  return NextResponse.json(
    { error: message, remaining: rl.remaining },
    { status: 429, headers: { 'Retry-After': String(Math.ceil(windowMs / 1000)) } },
  );
}
