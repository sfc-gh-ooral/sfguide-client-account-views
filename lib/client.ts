'use client';

// Browser-side data access. Sample mode reads the bundled capture (lib/mock/sample.json: the same
// synthetic rows and timings captured from a live run). Live mode calls the API routes, and a
// failed live call surfaces as an error: it never falls back to sample data.
import sample from '@/lib/mock/sample.json';
import traceJson from '@/data/peak-hour-trace.json';
import { HOSTED_EXAMPLE } from '@/lib/hosted';
import { preferSample } from '@/lib/mode';
import type { AccountPage, AiBrief, Book, BookRow, LoadProfile, LoadTestResult, Recon, ReconDetail, Trace } from '@/lib/types';

export type BookSort = 'value' | 'ytd' | 'flow' | 'activity';

interface SampleBundle {
  capturedAt: string;
  warehouse: string;
  books: Record<string, Book>;
  accounts: Record<string, AccountPage>;
  recon: Record<string, Recon>;
  reconDetail: Record<string, ReconDetail>;
  loadTests: LoadTestResult[];
  briefs: Record<string, Omit<AiBrief, 'source'>>;
}
const S = sample as unknown as SampleBundle;
export const CAPTURED_AT = S.capturedAt;
export const TRACE = traceJson as Trace;
export const SAMPLE_LOAD_TESTS = S.loadTests.map((t) => ({ ...t, capturedAt: S.capturedAt }));

let modePromise: Promise<boolean> | undefined;
/** True when the server has a Snowflake connection and the reader hasn't chosen Sample. */
export function isLive(): Promise<boolean> {
  if (HOSTED_EXAMPLE) return Promise.resolve(false);
  modePromise ??= fetch('/api/mode').then((r) => r.json()).then((j) => j.mode === 'live' && !preferSample()).catch(() => false);
  return modePromise;
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(path, init);
  const j = await r.json().catch(() => ({ error: `HTTP ${r.status}` }));
  if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
  return j as T;
}
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const q = (o: Record<string, string>) => new URLSearchParams(o).toString();

const SORTERS: Record<BookSort, (a: BookRow, b: BookRow) => number> = {
  value: (a, b) => b.MARKET_VALUE - a.MARKET_VALUE,
  ytd: (a, b) => b.YTD_RETURN - a.YTD_RETURN,
  flow: (a, b) => Math.abs(b.NET_FLOW_7D) - Math.abs(a.NET_FLOW_7D),
  activity: (a, b) => b.LAST_ACTIVITY_TS.localeCompare(a.LAST_ACTIVITY_TS),
};

export async function fetchBook(advisor: string, search: string, sort: BookSort): Promise<Book> {
  if (await isLive()) return api(`/api/book?${q({ advisor, q: search, sort })}`);
  const b = S.books[advisor];
  const s = search.trim().toLowerCase();
  const rows = (s ? b.rows.filter((r) => r.ACCOUNT_ID.toLowerCase().includes(s) || r.ACCOUNT_NAME.toLowerCase().includes(s)) : b.rows).slice().sort(SORTERS[sort]);
  return { ...b, rows, source: 'captured' };
}

export async function fetchAccount(advisor: string, account: string): Promise<AccountPage> {
  if (await isLive()) return api(`/api/account?${q({ advisor, account })}`);
  const p = S.accounts[`${advisor}|${account}`];
  if (!p) throw new Error(`${account} isn’t in the bundled sample. Pick an account from the list, or run Live mode for the full book.`);
  await wait(250 + Math.max(...Object.values(p.timings))); // replay the captured slowest widget
  return { ...p, source: 'captured', capturedAt: S.capturedAt };
}

export async function fetchRecon(advisor: string): Promise<Recon> {
  if (await isLive()) return api(`/api/recon?${q({ advisor })}`);
  return { ...S.recon[advisor], source: 'captured' };
}

export async function fetchReconDetail(advisor: string, account: string): Promise<ReconDetail> {
  if (await isLive()) return api(`/api/recon-detail?${q({ advisor, account })}`);
  const d = S.reconDetail[`${advisor}|${account}`];
  if (!d) throw new Error('No captured comparison for this account.');
  await wait(300);
  return { ...d, source: 'captured' };
}

export async function runLoadTest(sessions: number, seconds: number, profile: LoadProfile): Promise<LoadTestResult> {
  if (await isLive()) return api('/api/loadtest', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sessions, seconds, profile }) });
  // Replay the closest captured run, after a pause so the staged steps can be read.
  const pick = SAMPLE_LOAD_TESTS.filter((t) => t.profile === profile).sort((a, b) => Math.abs(a.sessions - sessions) - Math.abs(b.sessions - sessions))[0] ?? SAMPLE_LOAD_TESTS[0];
  await wait(4200 + Math.round(Math.random() * 1200));
  return { ...pick, source: 'captured', capturedAt: S.capturedAt };
}

export async function fetchBrief(advisor: string, account: string): Promise<AiBrief> {
  if (await isLive()) return api(`/api/brief?${q({ advisor, account })}`);
  const b = S.briefs[`${advisor}|${account}`];
  if (!b) throw new Error('No sample brief is bundled for this account.');
  await wait(4800 + Math.round(Math.random() * 2400));
  return { ...b, latencyMs: 0, model: 'scripted', source: 'sample' };
}
