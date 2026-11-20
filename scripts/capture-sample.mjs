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

const out = { capturedAt: new Date().toISOString().slice(0, 10), warehouse: 'CAV_IWH', books: {}, accounts: {}, recon: {}, reconDetail: {}, loadTests: [], briefs: {} };
for (const [adv, story] of Object.entries(ADVISORS)) {
  const byValue = await get(`/api/book?advisor=${adv}&q=&sort=value`);
  const byFlow = await get(`/api/book?advisor=${adv}&q=&sort=flow`);
  const byYtd = await get(`/api/book?advisor=${adv}&q=&sort=ytd`);
  const recon = await get(`/api/recon?advisor=${adv}`);
  out.recon[adv] = { ...recon, source: 'captured' };
  for (const b of recon.breaks) out.reconDetail[`${adv}|${b.ACCOUNT_ID}`] = { ...(await get(`/api/recon-detail?advisor=${adv}&account=${b.ACCOUNT_ID}`)), source: 'captured' };
  const ids = [...new Set([story, ...recon.breaks.map((b) => b.ACCOUNT_ID), ...byValue.rows.slice(0, 6).map((r) => r.ACCOUNT_ID),
    ...byFlow.rows.slice(0, 4).map((r) => r.ACCOUNT_ID), ...byYtd.rows.slice(-2).map((r) => r.ACCOUNT_ID)])];
  for (const id of ids) {
    out.accounts[`${adv}|${id}`] = { ...(await get(`/api/account?advisor=${adv}&account=${id}`)), source: 'captured' };
    const { text, citations } = await get(`/api/brief?advisor=${adv}&account=${id}`);
    out.briefs[`${adv}|${id}`] = { text, citations };
    console.log('captured', adv, id);
  }
  // Keep the book list to accounts with a bundled page, so every row opens in Sample mode. Stats stay for the full book.
  const all = [...byValue.rows, ...byFlow.rows, ...byYtd.rows];
  const rows = ids.map((id) => all.find((r) => r.ACCOUNT_ID === id) ?? (() => {
    const s = out.accounts[`${adv}|${id}`].summary;
    return { ACCOUNT_ID: s.ACCOUNT_ID, ACCOUNT_NAME: s.ACCOUNT_NAME, ACCOUNT_TYPE: s.ACCOUNT_TYPE, RISK_PROFILE: s.RISK_PROFILE, MARKET_VALUE: s.MARKET_VALUE,
      YTD_RETURN: s.YTD_RETURN, BENCH_YTD_RETURN: s.BENCH_YTD_RETURN, NET_FLOW_7D: s.NET_FLOW_7D, POSITION_COUNT: s.POSITION_COUNT, LAST_ACTIVITY_TS: s.LAST_ACTIVITY_TS };
  })());
  out.books[adv] = { rows, total: byValue.total, stats: byValue.stats, latencyMs: byValue.latencyMs, source: 'captured' };
}
for (const [sessions, seconds, profile] of [[8, 30, 'peak'], [16, 30, 'peak'], [32, 30, 'peak'], [16, 30, 'burst'], [32, 30, 'burst'], [8, 20, 'steady'], [32, 20, 'steady']]) {
  const r = await get('/api/loadtest', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sessions, seconds, profile }) });
  out.loadTests.push({ ...r, source: 'captured' });
  console.log('load test', sessions, profile, r.p50, r.p95, r.p99, r.qps, r.errors);
}
writeFileSync('lib/mock/sample.json', JSON.stringify(out, null, 1) + '\n');
console.log('wrote lib/mock/sample.json');
