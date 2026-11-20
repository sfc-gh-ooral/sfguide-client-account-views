// Captures the bundled Sample-mode data from a running Live-mode app (npm run dev with .env.local),
// so the no-account example shows the same synthetic rows, real measured latencies, and AI text
// captured from a live run. Usage: node scripts/capture-sample.mjs [http://localhost:3000]
import { writeFileSync } from 'node:fs';

const BASE = process.argv[2] ?? 'http://localhost:3000';
const ADVISORS = { 'ADV-0017': 'AC-000417', 'ADV-0128': 'AC-000128' };
const get = async (path, init) => {
  const r = await fetch(BASE + path, init);
  const j = await r.json();
  if (!r.ok) throw new Error(`${path}: ${j.error}`);
  return j;
};

const out = { capturedAt: new Date().toISOString().slice(0, 10), books: {}, accounts: {}, recon: {}, loadTests: [], briefs: {} };
for (const [adv, story] of Object.entries(ADVISORS)) {
  const book = await get(`/api/book?advisor=${adv}&q=`);
  out.books[adv] = { ...book, source: 'captured' };
  const recon = await get(`/api/recon?advisor=${adv}`);
  out.recon[adv] = { ...recon, source: 'captured' };
  const ids = [...new Set([story, ...recon.breaks.map((b) => b.ACCOUNT_ID), ...book.rows.slice(0, 10).map((r) => r.ACCOUNT_ID)])];
  for (const id of ids) {
    out.accounts[`${adv}|${id}`] = { ...(await get(`/api/account?advisor=${adv}&account=${id}`)), source: 'captured' };
    out.briefs[`${adv}|${id}`] = (await get(`/api/brief?advisor=${adv}&account=${id}`)).text;
    console.log('captured', adv, id);
  }
  // Keep the book list to accounts with a bundled page, so every row opens in Sample mode.
  out.books[adv].rows = book.rows.filter((r) => ids.includes(r.ACCOUNT_ID)).concat(
    ids.filter((id) => !book.rows.some((r) => r.ACCOUNT_ID === id)).map((id) => {
      const s = out.accounts[`${adv}|${id}`].summary;
      return { ACCOUNT_ID: s.ACCOUNT_ID, ACCOUNT_NAME: s.ACCOUNT_NAME, ACCOUNT_TYPE: s.ACCOUNT_TYPE, MARKET_VALUE: s.MARKET_VALUE, YTD_RETURN: s.YTD_RETURN, LAST_ACTIVITY_TS: s.LAST_ACTIVITY_TS };
    }));
}
for (const [sessions, seconds, profile] of [[4, 20, 'steady'], [16, 20, 'steady'], [32, 20, 'steady'], [8, 30, 'burst'], [16, 30, 'burst'], [32, 30, 'burst']]) {
  const r = await get('/api/loadtest', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sessions, seconds, profile }) });
  out.loadTests.push({ ...r, source: 'captured' });
  console.log('load test', sessions, profile, r.p50, r.p95, r.p99, r.qps);
}
writeFileSync('lib/mock/sample.json', JSON.stringify(out, null, 1) + '\n');
console.log('wrote lib/mock/sample.json');
