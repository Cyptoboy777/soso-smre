import { NextResponse } from 'next/server';
import { isMajorNews, filterAndSortNews, stripInternalFields, type RawNewsItem } from '@/lib/newsFilter';

export async function GET() {
  const now = Date.now();

  // ── Try SoSoValue API first ──────────────────────────────────────────────
  const sosoKey = process.env.SOSOVALUE_API_KEY;
  if (sosoKey) {
    try {
      const r = await fetch('https://openapi.sosovalue.com/openapi/v1/news/hot', {
        headers: { 'x-soso-api-key': sosoKey, Accept: 'application/json' },
        next: { revalidate: 60 },
      });
      if (r.ok) {
        const d = await r.json() as {
          code: number;
          data: { list: Array<{ title: string; source_link: string; content?: string; release_time?: string; source?: string }> };
        };
        if (d.code === 0 && d.data?.list?.length) {
          const items: RawNewsItem[] = d.data.list.map((n, i) => {
            const pubTime = n.release_time ? parseInt(n.release_time, 10) : now;
            const age = now - pubTime;
            const major = isMajorNews(n.title);
            return {
              id: String(i),
              title: n.title,
              url: n.source_link ?? '#',
              summary: n.content ?? n.title,
              source: n.source ?? 'SoSoValue',
              time: new Date(pubTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + (major ? ' • 🔥 MAJOR' : ''),
              pubTime, age, isMajor: major,
            };
          });

          const filtered = filterAndSortNews(items);
          return NextResponse.json({ news: stripInternalFields(filtered), source: 'sosovalue' });
        }
      }
    } catch { /* fall through */ }
  }

  // ── Fallback: Reddit r/CryptoCurrency ────────────────────────────────────
  try {
    const r = await fetch(
      'https://www.reddit.com/r/CryptoCurrency/hot.json?limit=20&raw_json=1',
      { headers: { 'User-Agent': 'SoSo-SMRE/1.0' }, next: { revalidate: 120 } },
    );
    if (!r.ok) throw new Error('Reddit error');

    const d = await r.json() as {
      data: { children: Array<{ data: { id: string; title: string; url: string; selftext: string; created_utc: number } }> };
    };

    const items: RawNewsItem[] = d.data.children
      .filter((c) => !c.data.title.startsWith('[') && !c.data.title.startsWith('Daily'))
      .map((c, i) => {
        const pubTime = c.data.created_utc * 1000;
        const age = now - pubTime;
        const major = isMajorNews(c.data.title);
        return {
          id: c.data.id ?? String(i),
          title: c.data.title,
          url: c.data.url ?? 'https://reddit.com/r/CryptoCurrency',
          summary: (c.data.selftext ?? c.data.title).slice(0, 250),
          source: 'Reddit',
          time: new Date(pubTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + (major ? ' • 🔥 MAJOR' : ''),
          pubTime, age, isMajor: major,
        };
      });

    const filtered = filterAndSortNews(items);
    return NextResponse.json({ news: stripInternalFields(filtered), source: 'reddit' });
  } catch (e) {
    return NextResponse.json({ news: [], error: String(e) }, { status: 500 });
  }
}
