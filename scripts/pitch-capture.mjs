import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const BASE = 'https://flowsentinel-app.vercel.app';
const OUT = '/tmp/fs-pitch/shots';
fs.mkdirSync(OUT, { recursive: true });
fs.rmSync('/tmp/fs-pitch/rawvid', { recursive: true, force: true });
fs.mkdirSync('/tmp/fs-pitch/rawvid', { recursive: true });

const browser = await chromium.launch({
  headless: true,
  executablePath: '/usr/bin/google-chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required'],
});

async function openVoice(page) {
  for (let i = 0; i < 25; i++) {
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
    if (clicked) { console.log('voice click', clicked); break; }
    await page.evaluate(() => window.scrollBy(0, 450));
    await page.waitForTimeout(700);
  }
  try {
    await page.waitForSelector('.voice-mode-overlay, .voice-orb-canvas-host, .voice-orb-fallback', { timeout: 20000 });
  } catch (e) {
    console.log('voice overlay wait soft-fail');
  }
}

async function shot(name, fn) {
  const ctx = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
  });
  const page = await ctx.newPage();
  page.setDefaultTimeout(120000);
  await fn(page);
  const file = path.join(OUT, name);
  await page.screenshot({ path: file, fullPage: false });
  console.log('shot', name, fs.statSync(file).size);
  await ctx.close();
}

await shot('01_hero.png', async (page) => {
  await page.goto(BASE + '/?v=pitch', { waitUntil: 'networkidle' });
  await page.waitForTimeout(5000);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(800);
});

await shot('02_judge.png', async (page) => {
  await page.goto(BASE + '/judge?v=pitch', { waitUntil: 'networkidle' });
  await page.waitForTimeout(4500);
});

await shot('03_desk.png', async (page) => {
  await page.goto(BASE + '/?v=pitch', { waitUntil: 'networkidle' });
  await page.waitForTimeout(4000);
  await page.evaluate(() => window.scrollTo(0, 720));
  await page.waitForTimeout(1500);
});

await shot('04_risk.png', async (page) => {
  await page.goto(BASE + '/?v=pitch', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3500);
  // try scroll to risk
  await page.evaluate(() => {
    const el = [...document.querySelectorAll('h2,h3,section,[data-testid]')].find(e => /risk/i.test(e.textContent||''));
    (el || document.body).scrollIntoView({ block: 'center' });
  });
  await page.waitForTimeout(1200);
  // also try scrolling mid-page
  const y = await page.evaluate(() => Math.min(document.body.scrollHeight * 0.45, 1600));
  await page.evaluate((yy) => window.scrollTo(0, yy), y);
  await page.waitForTimeout(1000);
});

await shot('05_proof.png', async (page) => {
  await page.goto(BASE + '/?v=pitch', { waitUntil: 'networkidle' });
  await page.waitForTimeout(4000);
  await page.evaluate(() => window.scrollTo(0, 200));
  await page.waitForTimeout(800);
});

await shot('06_track.png', async (page) => {
  await page.goto(BASE + '/track-record?v=pitch', { waitUntil: 'networkidle' });
  await page.waitForTimeout(4500);
});

await shot('07_voice.png', async (page) => {
  await page.goto(BASE + '/?v=pitch', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  await openVoice(page);
  await page.waitForTimeout(4000);
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((el) => /read thesis/i.test(el.textContent || ''));
    b?.click();
  });
  await page.waitForTimeout(3500);
});

// Short recorded clips for motion (hero + judge + voice)
async function recordClip(name, seconds, fn) {
  const dir = '/tmp/fs-pitch/rawvid/' + name;
  fs.mkdirSync(dir, { recursive: true });
  const ctx = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: { dir, size: { width: 1920, height: 1080 } },
  });
  const page = await ctx.newPage();
  page.setDefaultTimeout(120000);
  await fn(page, seconds);
  await page.waitForTimeout(Math.max(0, (seconds * 1000) - 500));
  await ctx.close();
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.webm'));
  if (files[0]) {
    fs.renameSync(path.join(dir, files[0]), path.join('/tmp/fs-pitch/rawvid', name + '.webm'));
    console.log('clip', name, fs.statSync('/tmp/fs-pitch/rawvid/' + name + '.webm').size);
  } else {
    console.log('no clip', name);
  }
}

await recordClip('hero', 10, async (page) => {
  await page.goto(BASE + '/?v=pitchvid', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
});

await recordClip('judge', 10, async (page) => {
  await page.goto(BASE + '/judge?v=pitchvid', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  for (let i = 0; i < 4; i++) {
    await page.evaluate(() => window.scrollBy(0, 350));
    await page.waitForTimeout(1200);
  }
});

await recordClip('desk', 12, async (page) => {
  await page.goto(BASE + '/?v=pitchvid', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  for (let i = 0; i < 5; i++) {
    await page.evaluate(() => window.scrollBy(0, 280));
    await page.waitForTimeout(1400);
  }
});

await recordClip('track', 8, async (page) => {
  await page.goto(BASE + '/track-record?v=pitchvid', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.evaluate(() => window.scrollBy(0, 400));
  await page.waitForTimeout(2000);
});

await recordClip('voice', 10, async (page) => {
  await page.goto(BASE + '/?v=pitchvid', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await openVoice(page);
  await page.waitForTimeout(2000);
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((el) => /read thesis/i.test(el.textContent || ''));
    b?.click();
  });
});

await browser.close();
console.log('capture done');
