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
