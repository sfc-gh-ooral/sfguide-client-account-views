'use client';

// Browser-side data access. Sample mode reads the bundled capture (lib/mock/sample.json: the same
// synthetic rows and timings captured from a live run). Live mode calls the API routes, and a
// failed live call surfaces as an error: it never falls back to sample data.
import sample from '@/lib/mock/sample.json';
import { HOSTED_EXAMPLE } from '@/lib/hosted';
import { preferSample } from '@/lib/mode';
import type { AccountPage, AiBrief, Book, LoadTestResult, Recon } from '@/lib/types';

interface SampleBundle {
  capturedAt: string;
  books: Record<string, Book>;
  accounts: Record<string, AccountPage>;
  recon: Record<string, Recon>;
  loadTests: LoadTestResult[];
  briefs: Record<string, string>;
}
const S = sample as unknown as SampleBundle;
export const CAPTURED_AT = S.capturedAt;

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

export async function fetchBook(advisor: string, q: string): Promise<Book> {
  if (await isLive()) return api(`/api/book?advisor=${encodeURIComponent(advisor)}&q=${encodeURIComponent(q)}`);
  const b = S.books[advisor];
  const s = q.trim().toLowerCase();
  const rows = s ? b.rows.filter((r) => r.ACCOUNT_ID.toLowerCase().includes(s) || r.ACCOUNT_NAME.toLowerCase().includes(s)) : b.rows;
  return { ...b, rows, total: s ? rows.length : b.total, source: 'captured' };
}

export function sampleAccountIds(advisor: string): string[] {
  return Object.keys(S.accounts).filter((k) => k.startsWith(advisor + '|')).map((k) => k.split('|')[1]);
}

export async function fetchAccount(advisor: string, account: string): Promise<AccountPage> {
  if (await isLive()) return api(`/api/account?advisor=${encodeURIComponent(advisor)}&account=${encodeURIComponent(account)}`);
  const p = S.accounts[`${advisor}|${account}`];
  if (!p) throw new Error(`${account} isn’t in the bundled sample. Pick an account from the list, or run Live mode for the full book.`);
  return { ...p, source: 'captured', capturedAt: S.capturedAt };
}

export async function fetchRecon(advisor: string): Promise<Recon> {
  if (await isLive()) return api(`/api/recon?advisor=${encodeURIComponent(advisor)}`);
  return { ...S.recon[advisor], source: 'captured' };
}

export const SAMPLE_LOAD_TESTS = S.loadTests;

export async function runLoadTest(sessions: number, seconds: number, profile: 'steady' | 'burst'): Promise<LoadTestResult> {
  if (await isLive()) return api('/api/loadtest', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sessions, seconds, profile }) });
  // Replay the closest captured run, after a short pause so the staged steps can be read.
  const pick = [...S.loadTests].filter((t) => t.profile === profile).sort((a, b) => Math.abs(a.sessions - sessions) - Math.abs(b.sessions - sessions))[0] ?? S.loadTests[0];
  await wait(4200);
  return { ...pick, source: 'captured', capturedAt: S.capturedAt };
}

export async function fetchBrief(advisor: string, account: string): Promise<AiBrief> {
  if (await isLive()) return api(`/api/brief?advisor=${encodeURIComponent(advisor)}&account=${encodeURIComponent(account)}`);
  const text = S.briefs[`${advisor}|${account}`];
  if (!text) throw new Error('No sample brief is bundled for this account.');
  await wait(4500 + Math.round(Math.random() * 2500));
  return { text, latencyMs: 0, model: 'scripted', source: 'sample' };
}
