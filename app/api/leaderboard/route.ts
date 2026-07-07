import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, limit, orderBy } from 'firebase/firestore';

// Shown only when Firestore isn't configured or the public `leaderboard` collection
// is still empty (fresh deploy) — keeps the page non-empty for a first-run demo.
const DEMO_PERFORMERS = [
  { name: 'AlphaWhale', roi: '+142.5%', balance: '$24,250', points: 4500 },
  { name: 'SosoMaster', roi: '+89.2%', balance: '$18,920', points: 3200 },
  { name: 'CryptoKing', roi: '+67.8%', balance: '$16,780', points: 2800 },
  { name: 'BullRun99', roi: '+45.1%', balance: '$14,510', points: 1900 },
  { name: 'PaperHands', roi: '-12.4%', balance: '$8,760', points: 450 },
];

export async function GET() {
  if (!db) {
    return NextResponse.json({ performers: DEMO_PERFORMERS, demo: true });
  }

  try {
    // Ranking is read from a dedicated public `leaderboard` collection (one doc per
    // user, written client-side from app/portfolio/page.tsx whenever their portfolio
    // analytics refresh) — NOT from the private per-user portfolio docs, which stay
    // locked down to owner-only access.
    const rankingsQuery = query(collection(db, 'leaderboard'), orderBy('points', 'desc'), limit(10));
    const snap = await getDocs(rankingsQuery);

    if (snap.empty) {
      return NextResponse.json({ performers: DEMO_PERFORMERS, demo: true });
    }

    const performers = snap.docs.map(d => {
      const data = d.data() as { name?: string; roi?: string; balance?: string; points?: number };
      return {
        name: data.name ?? 'Anonymous Trader',
        roi: data.roi ?? '0%',
        balance: data.balance ?? '$0',
        points: data.points ?? 0,
      };
    });

    return NextResponse.json({ performers, demo: false });
  } catch (e) {
    console.error('Leaderboard fetch error:', e);
    return NextResponse.json({ performers: DEMO_PERFORMERS, demo: true });
  }
}
