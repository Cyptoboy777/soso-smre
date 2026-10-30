import { NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';
import { answerWithOptionalGemini, type VoiceLang } from '@/lib/voice-answer';
import type { DeskSnapshot } from '@/types/flow';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'anon';
  const rl = rateLimit(`voice:${ip}`, 20, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: 'Rate limit: Too many voice requests' }, { status: 429 });
  }
  const body = (await req.json()) as {
    question?: string;
    lang?: VoiceLang;
    desk?: DeskSnapshot;
  };
  if (!body.question?.trim() || !body.desk) {
    return NextResponse.json({ error: 'question and desk required' }, { status: 400 });
  }
  const result = await answerWithOptionalGemini(body.desk, body.question.trim(), body.lang ?? 'auto');
  return NextResponse.json(result);
}
