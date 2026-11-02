import { NextResponse } from 'next/server';
import { runApiDiagnostics } from '@/lib/api-diag';
import { hasSosoKey } from '@/lib/sosovalue';
import { hasSodexCredentials } from '@/lib/sodex';
import { hasGeminiKey, GEMINI_FAST_MODEL } from '@/lib/gemini';
import { clientIp, rejectIfRateLimited } from '@/lib/request-guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const ip = clientIp(req);
  const limited = rejectIfRateLimited(
    `diag:${ip}`,
    10,
    60_000,
    'Rate limit: diagnostics budget exceeded',
  );
  if (limited) return limited;

  const diag = await runApiDiagnostics();
  return NextResponse.json({
    ...diag,
    keys: {
      sosovalue: hasSosoKey(),
      gemini: hasGeminiKey(),
      sodexTrade: hasSodexCredentials(),
      sodexMasterAddress: Boolean(
        process.env.SODEX_MASTER_ADDRESS?.trim() || process.env.SODEX_ACCOUNT_ADDRESS?.trim(),
      ),
    },
    geminiModel: hasGeminiKey() ? GEMINI_FAST_MODEL : null,
    labels: {
      orders: hasSodexCredentials() ? 'TESTNET_LIVE_EIP712' : 'DRY_RUN_SIMULATED',
      marketData: 'PUBLIC_SODEX_REST',
    },
  });
}
