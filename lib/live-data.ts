// Server-side queries for every screen. Each widget query filters on ADVISOR_ID first, so an
// advisor only ever reads rows from their own book (row scoping in the API, with bound values).
import trace from '@/data/peak-hour-trace.json';
import { INTERACTIVE_WH, STANDARD_WH, query } from '@/lib/snowflake';
import type {
  AccountPage, AccountSummary, Activity, AiBrief, Book, BookRow, Citation, Holding, LoadProfile, LoadTestResult,
  PerfPoint, Recon, ReconBreak, ReconDetail, ReconLine, Trace,
} from '@/lib/types';

/** Sort keys the book rail can ask for, mapped to fixed SQL. User input never reaches the SQL text. */
export const BOOK_SORTS = {
  value: 'MARKET_VALUE DESC',
  ytd: 'YTD_RETURN DESC',
  flow: 'ABS(NET_FLOW_7D) DESC',
  activity: 'LAST_ACTIVITY_TS DESC',
} as const;
export type BookSort = keyof typeof BOOK_SORTS;

export const SQL = {
  summary: `SELECT ADVISOR_ID, ACCOUNT_ID, ACCOUNT_NAME, ACCOUNT_TYPE, RISK_PROFILE, TO_CHAR(OPENED_ON) AS OPENED_ON, MARKET_VALUE,
      POSITION_COUNT, TO_CHAR(LAST_ACTIVITY_TS, 'YYYY-MM-DD HH24:MI') AS LAST_ACTIVITY_TS, NET_FLOWS_2Y, YTD_RETURN, BENCH_YTD_RETURN, NET_FLOW_7D
    FROM ACCOUNT_SUMMARY_IT WHERE ADVISOR_ID = ? AND ACCOUNT_ID = ?`,
  holdings: `SELECT SECURITY_ID, SECURITY_NAME, ASSET_CLASS, QUANTITY, PRICE, MARKET_VALUE, TO_CHAR(AS_OF_DATE) AS AS_OF_DATE
    FROM HOLDINGS_IT WHERE ADVISOR_ID = ? AND ACCOUNT_ID = ? ORDER BY MARKET_VALUE DESC`,
  activity: `SELECT ACTIVITY_ID, TO_CHAR(ACTIVITY_TS, 'YYYY-MM-DD HH24:MI') AS ACTIVITY_TS, ACTIVITY_TYPE, SECURITY_ID, AMOUNT
    FROM ACTIVITY_IT WHERE ADVISOR_ID = ? AND ACCOUNT_ID = ? ORDER BY ACTIVITY_TS DESC, ACTIVITY_ID DESC LIMIT 25`,
  performance: `SELECT TO_CHAR(MONTH_END) AS MONTH_END, RETURN_PCT, BENCHMARK_PCT
    FROM PERFORMANCE_IT WHERE ADVISOR_ID = ? AND ACCOUNT_ID = ? ORDER BY MONTH_END`,
  book: (order: string) => `SELECT ACCOUNT_ID, ACCOUNT_NAME, ACCOUNT_TYPE, RISK_PROFILE, MARKET_VALUE, YTD_RETURN, BENCH_YTD_RETURN,
      NET_FLOW_7D, POSITION_COUNT, TO_CHAR(LAST_ACTIVITY_TS, 'YYYY-MM-DD HH24:MI') AS LAST_ACTIVITY_TS, TOTAL, AUM, AVG_YTD, FLOWS_7D
    FROM (SELECT *, COUNT(*) OVER () AS TOTAL, SUM(MARKET_VALUE) OVER () AS AUM, AVG(YTD_RETURN) OVER () AS AVG_YTD,
            SUM(NET_FLOW_7D) OVER () AS FLOWS_7D
          FROM ACCOUNT_SUMMARY_IT WHERE ADVISOR_ID = ?)
    WHERE ACCOUNT_ID ILIKE ? OR ACCOUNT_NAME ILIKE ?
    ORDER BY ${order} LIMIT 60`,
} as const;

const num = <T extends object>(r: T): T => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v) && !/(_ID|_TS|DATE|_ON|MONTH_END)$/.test(k) ? Number(v) : v])) as T;

export async function getBook(advisor: string, q: string, sort: BookSort = 'value'): Promise<Book> {
  const like = `%${q}%`;
  type Row = BookRow & { TOTAL: number; AUM: number; AVG_YTD: number; FLOWS_7D: number };
  const { rows, ms } = await query<Row>(SQL.book(BOOK_SORTS[sort] ?? BOOK_SORTS.value), [advisor, like, like]);
  const first = rows[0] ? num(rows[0]) : undefined;
  return {
    rows: rows.map((r) => { const { TOTAL: _a, AUM: _b, AVG_YTD: _c, FLOWS_7D: _d, ...rest } = num(r); void _a; void _b; void _c; void _d; return rest; }),
    total: first ? Number(first.TOTAL) : 0,
    stats: { accounts: first ? Number(first.TOTAL) : 0, aum: first ? Number(first.AUM) : 0, avgYtd: first ? Number(first.AVG_YTD) : 0, flows7d: first ? Number(first.FLOWS_7D) : 0 },
    latencyMs: ms, source: 'live',
  };
}

export async function getAccount(advisor: string, account: string): Promise<AccountPage> {
  const b = [advisor, account];
  const [s, h, a, p] = await Promise.all([
    query<AccountSummary>(SQL.summary, b), query<Holding>(SQL.holdings, b),
    query<Activity>(SQL.activity, b), query<PerfPoint>(SQL.performance, b),
  ]);
  return {
    summary: s.rows[0] ? num(s.rows[0]) : null, holdings: h.rows.map(num), activity: a.rows.map(num), performance: p.rows.map(num),
    timings: { summary: s.ms, holdings: h.ms, activity: a.ms, performance: p.ms }, source: 'live', warehouse: INTERACTIVE_WH,
  };
}

const RC = 'CLIENT_VIEWS_DEMO.REPORTING_COPY';

export async function getRecon(advisor: string): Promise<Recon> {
  const [breaks, total, log, lag, counts] = await Promise.all([
    query<ReconBreak>(`SELECT ACCOUNT_ID, ACCOUNT_NAME, SERVING_POSITIONS, COPY_POSITIONS, SERVING_VALUE, COPY_VALUE
      FROM ${RC}.RECON_BREAKS WHERE ADVISOR_ID = ? ORDER BY ACCOUNT_ID`, [advisor], STANDARD_WH),
    query<{ N: number }>(`SELECT COUNT(*) AS N FROM ${RC}.RECON_BREAKS`, [], STANDARD_WH),
    query<{ LOADED_AT: string; SOURCE_AS_OF: string; STATUS: string; ROWS_LOADED: number }>(
      `SELECT TO_CHAR(LOADED_AT, 'YYYY-MM-DD HH24:MI') AS LOADED_AT, TO_CHAR(SOURCE_AS_OF) AS SOURCE_AS_OF, STATUS, ROWS_LOADED
       FROM ${RC}.LOAD_LOG ORDER BY LOADED_AT DESC LIMIT 1`, [], STANDARD_WH),
    query<{ TS: string | null }>(`SELECT TO_CHAR(MAX(REFRESH_END_TIME), 'YYYY-MM-DD HH24:MI') AS TS
      FROM TABLE(CLIENT_VIEWS_DEMO.INFORMATION_SCHEMA.DYNAMIC_TABLE_REFRESH_HISTORY(NAME => 'CLIENT_VIEWS_DEMO.SERVING.ACCOUNT_SUMMARY_DT'))
      WHERE STATE = 'SUCCEEDED'`, [], STANDARD_WH),
    query<{ N: number }>(`SELECT COUNT(*) AS N FROM CLIENT_VIEWS_DEMO.SERVING.HOLDINGS_CURRENT_DT`, [], STANDARD_WH),
  ]);
  const l = log.rows[0] ? num(log.rows[0]) : undefined;
  return {
    breaks: breaks.rows.map(num), totalBreaks: Number(total.rows[0]?.N ?? 0),
    copyLoadedAt: l?.LOADED_AT ?? '', copySourceAsOf: l?.SOURCE_AS_OF ?? '', copyStatus: l?.STATUS ?? '', copyRows: Number(l?.ROWS_LOADED ?? 0),
    servingTargetLag: '1 hour', servingRefreshedAt: lag.rows[0]?.TS ?? null, servingRows: Number(counts.rows[0]?.N ?? 0), source: 'live',
  };
}

/** Position-by-position comparison for one account, scoped to the advisor. */
export async function getReconDetail(advisor: string, account: string): Promise<ReconDetail> {
  const { rows, ms } = await query<ReconLine>(`
    SELECT COALESCE(s.SECURITY_ID, c.SECURITY_ID) AS SECURITY_ID, COALESCE(s.SECURITY_NAME, c.SECURITY_NAME) AS SECURITY_NAME,
           s.QUANTITY AS SERVING_QTY, c.QUANTITY AS COPY_QTY, s.MARKET_VALUE AS SERVING_VALUE, c.MARKET_VALUE AS COPY_VALUE
    FROM (SELECT * FROM CLIENT_VIEWS_DEMO.SERVING.HOLDINGS_CURRENT_DT WHERE ADVISOR_ID = ? AND ACCOUNT_ID = ?) s
    FULL OUTER JOIN (SELECT * FROM ${RC}.POSITIONS_COPY WHERE ADVISOR_ID = ? AND ACCOUNT_ID = ?) c
      ON c.SECURITY_ID = s.SECURITY_ID
    ORDER BY (s.QUANTITY IS NULL OR c.QUANTITY IS NULL) DESC, s.MARKET_VALUE DESC NULLS LAST`,
  [advisor, account, advisor, account], STANDARD_WH);
  return { accountId: account, lines: rows.map(num), latencyMs: ms, source: 'live' };
}

const pct = (xs: number[], p: number) => { if (!xs.length) return 0; const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)]; };
export const HIST_BUCKETS = [25, 50, 75, 100, 150, 200, 300, 500, 750, 1000, 2000, 5000];

/** Share of the peak (0–1) at a point in the 09:00–10:30 window of the seeded trace, for the peak replay. */
function peakShape(): number[] {
  const t = trace as Trace;
  const w = t.minutes.filter((m) => m.t >= '09:00' && m.t < '10:30').map((m) => m.sessions);
  const max = Math.max(...w);
  return w.map((s) => s / max);
}

/** N concurrent simulated sessions, each loading account-page widgets for random accounts in its advisor's book. */
export async function runLoadTest(sessions: number, seconds: number, profile: LoadProfile): Promise<LoadTestResult> {
  const ids = await query<{ ADVISOR_ID: string; ACCOUNT_ID: string }>(
    `SELECT ADVISOR_ID, ACCOUNT_ID FROM ACCOUNT_SUMMARY_IT WHERE ADVISOR_ID IN ('ADV-0017','ADV-0128','ADV-0200','ADV-0333') LIMIT 2000`);
  const size = await query<{ size: string }>(`SHOW WAREHOUSES LIKE '${INTERACTIVE_WH.replace(/[^A-Z0-9_]/gi, '')}'`, [], INTERACTIVE_WH);
  const shapes = [SQL.summary, SQL.holdings, SQL.activity, SQL.performance];
  const shape = peakShape();
  const samples: { t: number; ms: number }[] = [];
  let errors = 0;
  const startedAt = new Date().toISOString();
  const t0 = Date.now(); const end = t0 + seconds * 1000;
  // steady: all sessions throughout. burst: a quarter, then all for the middle third, then a quarter.
  // peak: the seeded trace's 09:00–10:30 curve compressed into the run, scaled so its peak = sessions.
  const activeAt = (ms: number) => {
    if (profile === 'steady') return sessions;
    if (profile === 'burst') return ms < seconds * 333 || ms > seconds * 667 ? Math.max(1, Math.round(sessions / 4)) : sessions;
    const i = Math.min(shape.length - 1, Math.floor((ms / (seconds * 1000)) * shape.length));
    return Math.max(1, Math.round(sessions * shape[i]));
  };
  const worker = async (w: number) => {
    let i = w;
    while (Date.now() < end) {
      if (w >= activeAt(Date.now() - t0)) { await new Promise((r) => setTimeout(r, 50)); continue; }
      const acct = ids.rows[(i * 7919 + w * 104729) % ids.rows.length];
      try { const { ms } = await query(shapes[i % 4], [acct.ADVISOR_ID, acct.ACCOUNT_ID]); samples.push({ t: Date.now() - t0, ms }); }
      catch { errors++; }
      i++;
    }
  };
  await Promise.all(Array.from({ length: sessions }, (_, w) => worker(w)));
  const lat = samples.map((s) => s.ms);
  const timeline = Array.from({ length: seconds }, (_, sec) => {
    const xs = samples.filter((s) => s.t >= sec * 1000 && s.t < (sec + 1) * 1000).map((s) => s.ms);
    return { t: sec + 1, p50: pct(xs, 50), p95: pct(xs, 95), qps: xs.length, active: activeAt(sec * 1000 + 500) };
  });
  const histogram = HIST_BUCKETS.map((le, i) => ({ le, n: lat.filter((x) => x <= le && (i === 0 || x > HIST_BUCKETS[i - 1])).length }));
  return {
    sessions, seconds, queries: samples.length, errors, qps: Math.round((samples.length / seconds) * 10) / 10,
    p50: pct(lat, 50), p95: pct(lat, 95), p99: pct(lat, 99), max: lat.length ? Math.max(...lat) : 0,
    timeline, histogram, warehouse: INTERACTIVE_WH, warehouseSize: String((size.rows[0] as Record<string, unknown>)?.size ?? 'unknown'),
    profile, rowsScanned: '500,000 accounts · 5M current holdings · 50M activity rows', startedAt, source: 'live',
  };
}

const MODEL = process.env.SNOWFLAKE_COMPLETE_MODEL ?? 'claude-sonnet-4-5';
const CITES: Record<string, string> = { S: 'Account summary', H: 'Holdings', A: 'Activity feed', P: 'Performance' };

/** Pulls the [S]/[H]/[A]/[P] source tags the model was asked to add, in order of first use. */
export function citationsIn(text: string): Citation[] {
  const seen = new Set<string>();
  for (const m of text.matchAll(/\[([SHAP])\]/g)) seen.add(m[1]);
  return [...seen].map((id) => ({ id, label: CITES[id] }));
}

/** Short pre-meeting brief for the advisor, from the same rows the page shows. Runs AI_COMPLETE on the standard warehouse. */
export async function getAiBrief(advisor: string, account: string): Promise<AiBrief> {
  const page = await getAccount(advisor, account);
  if (!page.summary) throw new Error('Account not found in this advisor’s book');
  const facts = JSON.stringify({ S_summary: page.summary, H_holdings: page.holdings, A_recentActivity: page.activity.slice(0, 10), P_last12Months: page.performance.slice(-12) });
  const prompt = `You are helping a wealth advisor prepare for a client call. Using only these facts, write 3 short bullet points ` +
    `(allocation, recent activity, performance vs benchmark) and one suggested question for the client. ` +
    `End each bullet with the source tag of the facts it uses: [S] summary, [H] holdings, [A] activity, [P] performance. ` +
    `Use plain text bullets starting with "- ". No advice or recommendations to buy or sell. Facts: ${facts}`;
  const { rows, ms } = await query<{ R: string }>(`SELECT AI_COMPLETE(?, ?) AS R`, [MODEL, prompt], STANDARD_WH);
  const text = String(rows[0]?.R ?? '').replace(/^"|"$/g, '').replace(/\\n/g, '\n').replace(/\\"/g, '"');
  return { text, citations: citationsIn(text), latencyMs: ms, model: MODEL, source: 'live' };
}
