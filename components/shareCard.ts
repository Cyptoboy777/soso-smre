/* Renders the shareable trade card on a canvas. Contains NO wallet address, balances or account data:
 * only the pair, the amounts the user chose, the estimated cost and the SoSwapDEX name. */

export type ShareData = { pay: string; get: string; costPct: number; netLabel: string };

export const SHARE_W = 1200;
export const SHARE_H = 630;

async function loadLogo(): Promise<HTMLImageElement | null> {
  return new Promise((res) => {
    const i = new Image();
    i.onload = () => res(i); i.onerror = () => res(null);
    i.src = '/icons/logo.svg';
  });
}

export async function drawShareCard(canvas: HTMLCanvasElement, d: ShareData) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  canvas.width = SHARE_W; canvas.height = SHARE_H;
  const sans = '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

  // background: black with a single orange glow rising from the bottom-left
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, SHARE_W, SHARE_H);
  const g = ctx.createRadialGradient(180, SHARE_H + 80, 20, 180, SHARE_H + 80, 760);
  g.addColorStop(0, 'rgba(234,88,12,0.55)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, SHARE_W, SHARE_H);

  const logo = await loadLogo();
  if (logo) ctx.drawImage(logo, 64, 56, 72, 72);
  ctx.fillStyle = '#fafafa'; ctx.font = `800 40px ${sans}`; ctx.textBaseline = 'middle';
  ctx.fillText('So', 156, 94);
  const w = ctx.measureText('So').width; ctx.fillStyle = '#fb923c'; ctx.fillText('SwapDEX', 156 + w, 94);

  // the trade, set large; this is the one thing the card is about
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#a1a1aa'; ctx.font = `500 30px ${sans}`; ctx.fillText('I just swapped', 64, 250);
  ctx.fillStyle = '#fafafa'; ctx.font = `800 76px ${sans}`;
  let pay = d.pay; while (ctx.measureText(pay).width > SHARE_W - 128 && pay.length > 6) pay = pay.slice(0, -2);
  ctx.fillText(pay, 64, 340);
  ctx.fillStyle = '#fdba74'; ctx.font = `700 52px ${sans}`;
  let get = `≈ ${d.get}`; while (ctx.measureText(get).width > SHARE_W - 128 && get.length > 6) get = get.slice(0, -2);
  ctx.fillText(get, 64, 418);

  // quiet footer: cost shown honestly, then the network
  ctx.fillStyle = '#d4d4d8'; ctx.font = `600 30px ${sans}`;
  ctx.fillText(`Total cost ${d.costPct.toFixed(d.costPct < 0.1 ? 3 : 2)}%, shown before I signed`, 64, 520);
  ctx.fillStyle = '#71717a'; ctx.font = `500 26px ${sans}`;
  ctx.fillText(`Real order book on SoDEX ${d.netLabel}. I sign every order in my own wallet.`, 64, 566);
}

export function canvasToBlob(c: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((r) => c.toBlob((b) => r(b), 'image/png'));
}

/* ───────── win card: shared after a real, profitable, closed trade ─────────
 * Draws only the pair, the % gain, the brand and the site. The wallet address is never drawn.
 * The amount is drawn only when the user turns it on. */

export type WinCardData = { pair: string; pct: number; amountLabel?: string };

export async function drawWinCard(canvas: HTMLCanvasElement, d: WinCardData) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  canvas.width = SHARE_W; canvas.height = SHARE_H;
  const sans = '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

  ctx.fillStyle = '#050506'; ctx.fillRect(0, 0, SHARE_W, SHARE_H);
  const g = ctx.createRadialGradient(SHARE_W - 160, 120, 10, SHARE_W - 160, 120, 640);
  g.addColorStop(0, 'rgba(249,115,22,0.42)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, SHARE_W, SHARE_H);
  // faint grid
  ctx.strokeStyle = 'rgba(255,255,255,0.04)'; ctx.lineWidth = 1;
  for (let x = 0; x <= SHARE_W; x += 60) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, SHARE_H); ctx.stroke(); }
  for (let y = 0; y <= SHARE_H; y += 60) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(SHARE_W, y); ctx.stroke(); }
  // border
  ctx.strokeStyle = 'rgba(249,115,22,0.35)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(24, 24, SHARE_W - 48, SHARE_H - 48, 28); ctx.stroke();

  const logo = await loadLogo();
  if (logo) ctx.drawImage(logo, 72, 64, 64, 64);
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fafafa'; ctx.font = `800 36px ${sans}`; ctx.fillText('So', 152, 97);
  const w = ctx.measureText('So').width; ctx.fillStyle = '#fb923c'; ctx.fillText('SwapDEX', 152 + w, 97);

  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#a1a1aa'; ctx.font = `600 34px ${sans}`; ctx.fillText(d.pair, 72, 250);
  ctx.fillStyle = '#a1a1aa'; ctx.font = `500 28px ${sans}`; ctx.fillText('Closed trade', 72, 296);
  const pct = `${d.pct >= 0 ? '+' : ''}${d.pct.toFixed(2)}%`;
  const grad = ctx.createLinearGradient(0, 330, 0, 470); grad.addColorStop(0, '#6ee7b7'); grad.addColorStop(1, '#10b981');
  ctx.fillStyle = grad; ctx.font = `800 150px ${sans}`; ctx.fillText(pct, 66, 450);
  if (d.amountLabel) { ctx.fillStyle = '#e4e4e7'; ctx.font = `600 32px ${sans}`; ctx.fillText(d.amountLabel, 72, 506); }

  ctx.fillStyle = '#71717a'; ctx.font = `500 24px ${sans}`; ctx.fillText('Real fills on SoDEX. Past results do not predict future ones.', 72, 566);
  ctx.textAlign = 'right'; ctx.fillStyle = '#fdba74'; ctx.font = `700 28px ${sans}`; ctx.fillText('soswapdex.xyz', SHARE_W - 72, 566);
  ctx.textAlign = 'left';
}
