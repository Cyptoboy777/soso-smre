import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

const OUT = '/workspace/screenshots/flowsentinel';
const BASE = 'https://flowsentinel-app.vercel.app/?v=a8431fb';
fs.mkdirSync(OUT, { recursive: true });
fs.rmSync('/tmp/v6vid', { recursive: true, force: true });
fs.mkdirSync('/tmp/v6vid', { recursive: true });

const browser = await chromium.launch({
  headless: true,
  executablePath: '/usr/bin/google-chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

async function openVoice(page) {
  // Desk may be lazy — scroll and wait for the voice CTA
  for (let i = 0; i < 20; i++) {
    const clicked = await page.evaluate(() => {
      const candidates = [...document.querySelectorAll('button, a, [role="button"]')];
      for (const el of candidates) {
        const t = (el.textContent || '').toLowerCase();
        const aria = (el.getAttribute('aria-label') || '').toLowerCase();
        if (t.includes('voice') || aria.includes('voice') || t.includes('enter voice')) {
          el.scrollIntoView({ block: 'center' });
          el.click();
          return t || aria;
        }
      }
      return null;
    });
    if (clicked) {
      console.log('clicked', clicked);
      break;
    }
    await page.evaluate(() => window.scrollBy(0, 400));
    await page.waitForTimeout(800);
  }
  await page.waitForSelector('.voice-mode-overlay, .voice-orb-canvas-host, .voice-orb-fallback', { timeout: 25000 });
}

async function shot(name, width, height, fn) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.setDefaultTimeout(120000);
  await fn(page);
  const file = path.join(OUT, name);
  await page.screenshot({ path: file, fullPage: false });
  console.log('saved', name, fs.statSync(file).size);
  await context.close();
}

await shot('v6-hero-1440.png', 1440, 900, async (page) => {
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(5500);
  await page.evaluate(() => window.scrollTo(0, 0));
});

await shot('v6-hero-390.png', 390, 844, async (page) => {
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.evaluate(() => window.scrollTo(0, 0));
});

await shot('v6-voice-speaking-1440.png', 1440, 900, async (page) => {
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  await openVoice(page);
  for (let i = 0; i < 30; i++) {
    const ready = await page.evaluate(() => /tap the mic|ready|listening|speaking/i.test(document.querySelector('.voice-mode-state')?.textContent || ''));
    if (ready) break;
    await page.waitForTimeout(1000);
  }
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((el) => /read thesis/i.test(el.textContent || ''));
    b?.click();
  });
  await page.waitForTimeout(4000);
});

await shot('v6-voice-390.png', 390, 844, async (page) => {
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await openVoice(page);
  await page.waitForTimeout(5000);
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((el) => /read thesis/i.test(el.textContent || ''));
    b?.click();
  });
  await page.waitForTimeout(2500);
});

const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  recordVideo: { dir: '/tmp/v6vid', size: { width: 1440, height: 900 } },
});
const page = await context.newPage();
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForTimeout(4500);
await page.evaluate(() => window.scrollTo({ top: 800, behavior: 'smooth' }));
await page.waitForTimeout(2000);
await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
await page.waitForTimeout(1500);
await openVoice(page);
await page.waitForTimeout(3000);
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((el) => /read thesis/i.test(el.textContent || ''));
  b?.click();
});
await page.waitForTimeout(5000);
await context.close();
const vids = fs.readdirSync('/tmp/v6vid').filter((f) => f.endsWith('.webm'));
if (vids[0]) {
  const webm = path.join('/tmp/v6vid', vids[0]);
  fs.copyFileSync(webm, path.join(OUT, 'v6-demo.webm'));
  spawnSync('ffmpeg', ['-y', '-i', webm, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-an', path.join(OUT, 'v6-demo.mp4')], { encoding: 'utf8' });
  console.log('mp4', fs.statSync(path.join(OUT, 'v6-demo.mp4')).size);
}
await browser.close();
console.log('done');
