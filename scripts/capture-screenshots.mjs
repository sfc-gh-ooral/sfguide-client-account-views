// Screenshots of the running app in Sample mode, for the landing page (docs/images/).
// Usage: npm run dev, then node scripts/capture-screenshots.mjs [http://localhost:3000] [outDir]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.argv[2] ?? 'http://localhost:3000';
const OUT = process.argv[3] ?? 'docs/images';
mkdirSync(OUT, { recursive: true });
const b = await chromium.launch();

async function page(viewport, scheme = 'dark') {
  const ctx = await b.newContext({ viewport, deviceScaleFactor: viewport.width < 500 ? 2 : 1, colorScheme: scheme, reducedMotion: 'reduce' });
  await ctx.addInitScript(() => { localStorage.setItem('cav-mode', 'sample'); localStorage.setItem('qs-advisor', 'ADV-0017'); });
  return ctx.newPage();
}
const shot = async (p, name, full = false) => { await p.waitForTimeout(900); await p.screenshot({ path: `${OUT}/${name}.png`, fullPage: full }); console.log('saved', name); };
const D = { width: 1440, height: 900 };

let p = await page(D);
await p.goto(BASE + '/'); await p.getByText('Ready in').waitFor({ timeout: 30000 });
await shot(p, '01-account-desk');
await p.getByRole('button', { name: 'Draft brief' }).click();
await p.getByText('Sources:').waitFor({ timeout: 30000 });
await p.getByText('Brief for the next client call').scrollIntoViewIfNeeded();
await p.evaluate(() => window.scrollTo(0, 120));
await shot(p, '02-call-prep');
await p.evaluate(() => window.scrollTo(0, 900));
await shot(p, '03-holdings-performance');

await p.goto(BASE + '/architecture'); await p.getByText('Copy load status').waitFor({ timeout: 30000 });
await shot(p, '04-architecture');
await p.getByRole('button', { name: /Compare positions for Hollis/ }).click();
await p.getByText('Missing').first().waitFor({ timeout: 30000 });
await shot(p, '05-recon-drawer');

await p.goto(BASE + '/load-test'); await p.getByText('Every round trip, bucketed').waitFor({ timeout: 30000 });
await shot(p, '06-load-lab');

await p.goto(BASE + '/cost'); await p.getByRole('button', { name: /placeholder numbers/ }).click();
await shot(p, '07-cost-model');

const M = { width: 390, height: 844 };
p = await page(M);
await p.goto(BASE + '/'); await p.getByText('Book').first().waitFor();
await p.waitForTimeout(1500);
await shot(p, 'm1-book');
await p.getByRole('button', { name: /Hollis Family Trust/ }).first().click();
await p.getByText('Ready in').waitFor({ timeout: 30000 });
await shot(p, 'm2-account');
await p.goto(BASE + '/load-test'); await p.getByText('Every round trip, bucketed').waitFor({ timeout: 30000 });
await shot(p, 'm3-load-lab');
const wide = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
console.log('horizontal scroll at 390px:', wide);

p = await page(D, 'light');
await p.goto(BASE + '/'); await p.getByText('Ready in').waitFor({ timeout: 30000 });
await shot(p, '08-account-desk-light');
await b.close();
