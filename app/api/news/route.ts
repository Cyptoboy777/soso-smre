import { NextResponse } from 'next/server';

export interface NewsItem {
  id: string;
  title: string;
  url: string;
  summary: string;
  source: string;
  time: string;
}

export async function GET() {
  // ── Try SoSoValue API first ───────────────────────────────────────────────
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
          const now = Date.now();
          const FOUR_HOURS = 4 * 60 * 60 * 1000;
          const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

          // Process and categorize news
          let processedNews = d.data.list.map((n, i) => {
            const pubTime = n.release_time ? parseInt(n.release_time, 10) : now;
            const age = now - pubTime;
            
            // Define major news criteria (keywords or high impact)
            const isMajor = /SEC|ETF|Fed|Hack|Crash|Binance|BlackRock|Rate|Inflation/i.test(n.title);

            return {
              id: String(i),
              title: n.title,
              url: n.source_link ?? '#',
              summary: n.content ?? n.title,
              source: n.source ?? 'SoSoValue',
              time: n.release_time 
                ? new Date(pubTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + (isMajor ? ' • 🔥 MAJOR' : '')
                : 'Live • SoSoValue',
              pubTime,
              age,
              isMajor
            };
          });

          // Rule 1: Major news stays for up to 24 hours
          const majorNews = processedNews.filter(n => n.isMajor && n.age <= TWENTY_FOUR_HOURS);
          
          // Rule 2: Normal breaking news changes/rotates every 4 hours (we filter out ones older than 4h)
          const normalNews = processedNews.filter(n => !n.isMajor && n.age <= FOUR_HOURS);

          // Rule 3: Always real-time (handled by revalidate: 60)
          
          // Combine and sort: Major news at top, then normal news, all sorted by newest first
          majorNews.sort((a, b) => b.pubTime - a.pubTime);
          normalNews.sort((a, b) => b.pubTime - a.pubTime);

          let finalNews = [...majorNews, ...normalNews];

          // Fallback if APIs don't provide timestamps or too strict filtering leaves empty arrays
          if (finalNews.length === 0) {
             finalNews = processedNews.slice(0, 9);
          }

          return NextResponse.json({ news: finalNews.slice(0, 15), source: 'sosovalue' });
        }
      }
    } catch {}
  }

  // ── Fallback: Reddit r/CryptoCurrency ─────────────────────────────────────
  try {
    const r = await fetch(
      'https://www.reddit.com/r/CryptoCurrency/hot.json?limit=15&raw_json=1',
      { headers: { 'User-Agent': 'SoSo-SMRE/1.0' }, next: { revalidate: 120 } }
    );
    if (!r.ok) throw new Error('Reddit error');
    const d = await r.json() as {
      data: { children: Array<{ data: { id: string; title: string; url: string; selftext: string; created_utc: number } }> };
    };

    const now = Date.now();
    const FOUR_HOURS = 4 * 60 * 60 * 1000;
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

    let processedNews = d.data.children
      .filter(c => !c.data.title.startsWith('[') && !c.data.title.startsWith('Daily'))
      .map((c, i) => {
        const pubTime = c.data.created_utc * 1000;
        const age = now - pubTime;
        const isMajor = /SEC|ETF|Fed|Hack|Crash|Binance|BlackRock|Rate|Inflation/i.test(c.data.title);

        return {
          id: c.data.id ?? String(i),
          title: c.data.title,
          url: c.data.url ?? 'https://reddit.com/r/CryptoCurrency',
          summary: (c.data.selftext ?? c.data.title).slice(0, 250),
          source: 'Reddit',
          time: new Date(pubTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + (isMajor ? ' • 🔥 MAJOR' : ''),
          pubTime,
          age,
          isMajor
        };
      });

    const majorNews = processedNews.filter(n => n.isMajor && n.age <= TWENTY_FOUR_HOURS);
    const normalNews = processedNews.filter(n => !n.isMajor && n.age <= FOUR_HOURS);

    majorNews.sort((a, b) => b.pubTime - a.pubTime);
    normalNews.sort((a, b) => b.pubTime - a.pubTime);

    let finalNews = [...majorNews, ...normalNews];
    if (finalNews.length === 0) finalNews = processedNews.slice(0, 9);

    const news: NewsItem[] = finalNews.slice(0, 15).map(({ pubTime, age, isMajor, ...rest }) => rest);

    return NextResponse.json({ news, source: 'reddit' });
  } catch (e) {
    return NextResponse.json({ news: [], error: String(e) }, { status: 500 });
  }
}
