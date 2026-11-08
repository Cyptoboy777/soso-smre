import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const out = '/opt/cursor/artifacts';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });

async function shoot(name, viewport, options = {}) {
  const context = await browser.newContext({
    viewport,
    reducedMotion: options.reduced ? 'reduce' : 'no-preference',
    colorScheme: options.light ? 'light' : 'dark',
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (err) => errors.push(String(err)));
  await page.goto('http://localhost:3000/trade', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  const midText = await page.locator('.execution-meta.tabular').first().textContent().catch(() => '');
  const mid = Number(String(midText).replace(/,/g, '').match(/Mid\s+([\d.]+)/)?.[1] ?? '');
  if (Number.isFinite(mid) && mid > 0) {
    await page.locator('input.field').nth(0).fill(String(Math.round(mid - mid * 0.001)));
    await page.locator('input.field').nth(1).fill('0.0001');
    await page.waitForTimeout(900);
  }
  await page.screenshot({ path: `${out}/${name}.png` });
  await page.screenshot({ path: `${out}/${name}-full.png`, fullPage: true });
  const focused = [];
  for (let i = 0; i < 8; i += 1) {
    await page.keyboard.press('Tab');
    const info = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el) return null;
      const style = getComputedStyle(el);
      return {
        tag: el.tagName,
        text: (el.innerText || el.getAttribute('aria-label') || '').slice(0, 40),
        outline: style.outlineStyle,
      };
    });
    focused.push(info);
  }
  const box = await page.locator('.execution').boundingBox();
  console.log(JSON.stringify({ name, errors, mid, focused, width: box?.width, height: box?.height }));
  await context.close();
}

await shoot('trade-desktop-1440', { width: 1440, height: 900 });
await shoot('trade-mobile-390', { width: 390, height: 844 });
await shoot('trade-desktop-light', { width: 1440, height: 900 }, { light: true });
await shoot('trade-mobile-reduced', { width: 390, height: 844 }, { reduced: true });
await browser.close();
