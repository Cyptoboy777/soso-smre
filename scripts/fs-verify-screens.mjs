import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync } from 'fs';

const OUT = process.env.OUT;
const URL = process.env.URL;
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const pagesToCheck = [
  { path: '/', name: 'home' },
  { path: '/stats', name: 'stats' },
  { path: '/track-record', name: 'track-record' },
];

const contrastFails = [];

async function prepare(page, theme) {
  await page.addInitScript((t) => {
    try { localStorage.setItem('fs-theme', t); } catch {}
  }, theme);
  await page.emulateMedia({ colorScheme: theme === 'light' ? 'light' : 'dark' });
}

async function forceTheme(page, theme) {
  const html = await page.locator('html').getAttribute('class');
  const isLight = (html || '').includes('light');
  const wantLight = theme === 'light';
  if (wantLight !== isLight) {
    const btn = page.locator('.theme-toggle, .theme-toggle-btn').first();
    if (await btn.count()) {
      await btn.click();
      await page.waitForTimeout(400);
    }
  }
}

async function axeContrast(page, label) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  const contrast = results.violations.filter((v) => v.id === 'color-contrast');
  const count = contrast.reduce((n, v) => n + v.nodes.length, 0);
  if (count) {
    contrastFails.push({ label, count, samples: contrast[0]?.nodes.slice(0, 3).map((n) => n.html) });
  }
  console.log(`axe contrast ${label}: ${count}`);
  return count;
}

async function shot(name, { width, height, theme, path, openChat, scrollDesk }) {
  const context = await browser.newContext({
    viewport: { width, height },
    colorScheme: theme === 'light' ? 'light' : 'dark',
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  await prepare(page, theme);
  await page.addStyleTag({ content: '.ai-launcher .ai-orb { animation: none !important; }' });
  await page.goto(`${URL}${path || '/'}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2500);
  await page.waitForTimeout(1000);
  await forceTheme(page, theme);
  if (scrollDesk) {
    const desk = page.locator('#desk');
    if (await desk.count()) await desk.scrollIntoViewIfNeeded();
    else await page.evaluate(() => window.scrollTo(0, 900));
    await page.waitForTimeout(700);
  }
  if (openChat) {
    const launcher = page.locator('.ai-launcher');
    if (await launcher.count()) {
      await launcher.click({ force: true });
      await page.waitForTimeout(700);
    }
  }
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
  await axeContrast(page, name);
  await context.close();
  console.log('wrote', name);
}

// Screenshots required
await shot('home-desktop-dark', { width: 1440, height: 900, theme: 'dark', path: '/' });
await shot('home-desktop-light', { width: 1440, height: 900, theme: 'light', path: '/' });
await shot('home-mobile-dark', { width: 390, height: 844, theme: 'dark', path: '/' });
await shot('home-mobile-light', { width: 390, height: 844, theme: 'light', path: '/' });
await shot('desk-idea-dark', { width: 1440, height: 900, theme: 'dark', path: '/', scrollDesk: true });
await shot('desk-idea-light', { width: 1440, height: 900, theme: 'light', path: '/', scrollDesk: true });
await shot('chat-open-dark', { width: 1440, height: 900, theme: 'dark', path: '/', openChat: true });
await shot('chat-open-light', { width: 1440, height: 900, theme: 'light', path: '/', openChat: true });
await shot('stats-dark', { width: 1440, height: 900, theme: 'dark', path: '/stats' });
await shot('stats-light', { width: 1440, height: 900, theme: 'light', path: '/stats' });
await shot('track-record-dark', { width: 1440, height: 900, theme: 'dark', path: '/track-record' });
await shot('track-record-light', { width: 1440, height: 900, theme: 'light', path: '/track-record' });

console.log('CONTRAST_FAILS', JSON.stringify(contrastFails, null, 2));
await browser.close();
if (contrastFails.length) process.exitCode = 2;
