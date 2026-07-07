import { NextResponse } from 'next/server';
import { checkRateLimit, getClientKey } from '@/lib/rateLimit';

const MAX_MESSAGE_LENGTH = 2000;
const CHAT_ID_RE = /^-?\d{5,15}$/; // Telegram numeric chat/user IDs (groups are negative)

export async function POST(req: Request) {
  try {
    // This endpoint has no per-user auth (chatId is just typed into Settings), so
    // rate limit hard to stop it being used as a free relay to spam arbitrary chat IDs.
    const clientKey = getClientKey(req);
    const rl = checkRateLimit(`telegram:${clientKey}`, 5, 60_000);
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Rate limit exceeded. Please slow down.' }, { status: 429 });
    }

    const { chatId, message } = await req.json();
    const botToken = process.env.TELEGRAM_BOT_TOKEN;

    if (!botToken) {
      return NextResponse.json({ error: 'Telegram Bot Token not configured' }, { status: 500 });
    }

    if (!chatId || typeof chatId !== 'string' || !CHAT_ID_RE.test(chatId.trim())) {
      return NextResponse.json({ error: 'A valid numeric Telegram Chat ID is required' }, { status: 400 });
    }

    if (!message || typeof message !== 'string' || message.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json({ error: `Message must be a string up to ${MAX_MESSAGE_LENGTH} characters` }, { status: 400 });
    }

    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId.trim(),
        text: message,
        parse_mode: 'HTML',
        disable_web_page_preview: false
      })
    });

    const data = await response.json();

    if (!data.ok) {
      return NextResponse.json({ error: data.description }, { status: 400 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Telegram API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
