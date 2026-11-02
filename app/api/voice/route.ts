import { NextResponse } from 'next/server';
import { answerWithOptionalGemini, type VoiceLang } from '@/lib/voice-answer';
import { clientIp, rejectIfRateLimited } from '@/lib/request-guard';
import type { DeskSnapshot } from '@/types/flow';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const ip = clientIp(req);
  const limited = rejectIfRateLimited(
    `voice:${ip}`,
    20,
    60_000,
    'Rate limit: Too many voice requests',
  );
  if (limited) return limited;

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
