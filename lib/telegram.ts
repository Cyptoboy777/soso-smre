/** Telegram numeric chat/user IDs (groups are negative). Shared so the
 *  format check can't silently drift between the endpoints that send alerts. */
export const TELEGRAM_CHAT_ID_RE = /^-?\d{5,15}$/;

export function isValidTelegramChatId(chatId: unknown): chatId is string {
  return typeof chatId === 'string' && TELEGRAM_CHAT_ID_RE.test(chatId.trim());
}
