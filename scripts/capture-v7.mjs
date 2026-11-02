import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
const OUT = '/workspace/screenshots/flowsentinel';
const BASE = 'https://flowsentinel-app.vercel.app/?v=9da2f54';
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox','--disable-dev-shm-usage'] });
async function shot(name, w, h, url, wait=3500, scrollY=0) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(wait);
  if (scrollY) await page.evaluate((y) => window.scrollTo(0, y), scrollY);
  await page.waitForTimeout(600);
  const file = path.join(OUT, name);
  await page.screenshot({ path: file, fullPage: false });
  console.log('saved', name, fs.statSync(file).size);
  await ctx.close();
}
await shot('v7-hero-1440.png', 1440, 900, BASE, 5000, 0);
await shot('v7-desk-1440.png', 1440, 900, BASE, 6000, 700);
await shot('v7-judge-1440.png', 1440, 900, 'https://flowsentinel-app.vercel.app/judge?v=9da2f54', 5000, 0);
await shot('v7-hero-390.png', 390, 844, BASE, 3000, 0);
await shot('v7-judge-390.png', 390, 844, 'https://flowsentinel-app.vercel.app/judge?v=9da2f54', 4000, 0);
await browser.close();
console.log('done');
