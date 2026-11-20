// Server-side queries for every screen. Each widget query filters on ADVISOR_ID first, so an
// advisor only ever reads rows from their own book (row scoping in the API, with bound values).
import { INTERACTIVE_WH, STANDARD_WH, query } from '@/lib/snowflake';
import type { AccountPage, AccountSummary, Activity, AiBrief, Book, BookRow, Holding, LoadTestResult, PerfPoint, Recon, ReconBreak } from '@/lib/types';

export const SQL = {
  summary: `SELECT ADVISOR_ID, ACCOUNT_ID, ACCOUNT_NAME, ACCOUNT_TYPE, RISK_PROFILE, TO_CHAR(OPENED_ON) AS OPENED_ON, MARKET_VALUE,
      POSITION_COUNT, TO_CHAR(LAST_ACTIVITY_TS, 'YYYY-MM-DD HH24:MI') AS LAST_ACTIVITY_TS, NET_FLOWS_2Y, YTD_RETURN
    FROM ACCOUNT_SUMMARY_IT WHERE ADVISOR_ID = ? AND ACCOUNT_ID = ?`,
  holdings: `SELECT SECURITY_ID, SECURITY_NAME, ASSET_CLASS, QUANTITY, PRICE, MARKET_VALUE, TO_CHAR(AS_OF_DATE) AS AS_OF_DATE
    FROM HOLDINGS_IT WHERE ADVISOR_ID = ? AND ACCOUNT_ID = ? ORDER BY MARKET_VALUE DESC`,
  activity: `SELECT ACTIVITY_ID, TO_CHAR(ACTIVITY_TS, 'YYYY-MM-DD HH24:MI') AS ACTIVITY_TS, ACTIVITY_TYPE, SECURITY_ID, AMOUNT
    FROM ACTIVITY_IT WHERE ADVISOR_ID = ? AND ACCOUNT_ID = ? ORDER BY ACTIVITY_TS DESC, ACTIVITY_ID DESC LIMIT 25`,
  performance: `SELECT TO_CHAR(MONTH_END) AS MONTH_END, RETURN_PCT, BENCHMARK_PCT
    FROM PERFORMANCE_IT WHERE ADVISOR_ID = ? AND ACCOUNT_ID = ? ORDER BY MONTH_END`,
  book: `SELECT ACCOUNT_ID, ACCOUNT_NAME, ACCOUNT_TYPE, MARKET_VALUE, YTD_RETURN, TO_CHAR(LAST_ACTIVITY_TS, 'YYYY-MM-DD HH24:MI') AS LAST_ACTIVITY_TS,
      COUNT(*) OVER () AS TOTAL
    FROM ACCOUNT_SUMMARY_IT WHERE ADVISOR_ID = ? AND (ACCOUNT_ID ILIKE ? OR ACCOUNT_NAME ILIKE ?)
    ORDER BY MARKET_VALUE DESC LIMIT 50`,
} as const;

const num = <T extends object>(r: T): T => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v) && !/(_ID|_TS|DATE|_ON|MONTH_END)$/.test(k) ? Number(v) : v])) as T;

export async function getBook(advisor: string, q: string): Promise<Book> {
  const like = `%${q}%`;
  const { rows, ms } = await query<BookRow & { TOTAL: number }>(SQL.book, [advisor, like, like]);
  return { rows: rows.map((r) => { const { TOTAL: _t, ...rest } = num(r); void _t; return rest; }), total: rows.length ? Number(rows[0].TOTAL) : 0, latencyMs: ms, source: 'live' };
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

export async function getRecon(advisor: string): Promise<Recon> {
  const [breaks, total, log, lag] = await Promise.all([
    query<ReconBreak>(`SELECT ACCOUNT_ID, SERVING_POSITIONS, COPY_POSITIONS FROM CLIENT_VIEWS_DEMO.REPORTING_COPY.RECON_BREAKS WHERE ADVISOR_ID = ? ORDER BY ACCOUNT_ID`, [advisor], STANDARD_WH),
    query<{ N: number }>(`SELECT COUNT(*) AS N FROM CLIENT_VIEWS_DEMO.REPORTING_COPY.RECON_BREAKS`, [], STANDARD_WH),
    query<{ LOADED_AT: string; SOURCE_AS_OF: string; STATUS: string }>(`SELECT TO_CHAR(LOADED_AT, 'YYYY-MM-DD HH24:MI') AS LOADED_AT, TO_CHAR(SOURCE_AS_OF) AS SOURCE_AS_OF, STATUS FROM CLIENT_VIEWS_DEMO.REPORTING_COPY.LOAD_LOG ORDER BY LOADED_AT DESC LIMIT 1`, [], STANDARD_WH),
    query<{ TS: string | null }>(`SELECT TO_CHAR(MAX(REFRESH_END_TIME), 'YYYY-MM-DD HH24:MI') AS TS FROM TABLE(CLIENT_VIEWS_DEMO.INFORMATION_SCHEMA.DYNAMIC_TABLE_REFRESH_HISTORY(NAME => 'CLIENT_VIEWS_DEMO.SERVING.ACCOUNT_SUMMARY_DT')) WHERE STATE = 'SUCCEEDED'`, [], STANDARD_WH),
  ]);
  return {
    breaks: breaks.rows.map(num), totalBreaks: Number(total.rows[0]?.N ?? 0),
    copyLoadedAt: log.rows[0]?.LOADED_AT ?? '', copySourceAsOf: log.rows[0]?.SOURCE_AS_OF ?? '', copyStatus: log.rows[0]?.STATUS ?? '',
    servingTargetLag: '1 hour', servingRefreshedAt: lag.rows[0]?.TS ?? null, source: 'live',
  };
}

const pct = (xs: number[], p: number) => { if (!xs.length) return 0; const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)]; };

/** N concurrent simulated sessions, each loading account-page widgets for random accounts in its advisor's book. */
export async function runLoadTest(sessions: number, seconds: number, profile: 'steady' | 'burst'): Promise<LoadTestResult> {
  const ids = await query<{ ADVISOR_ID: string; ACCOUNT_ID: string }>(
    `SELECT ADVISOR_ID, ACCOUNT_ID FROM ACCOUNT_SUMMARY_IT WHERE ADVISOR_ID IN ('ADV-0017','ADV-0128','ADV-0200','ADV-0333') LIMIT 2000`);
  const size = await query<{ size: string }>(`SHOW WAREHOUSES LIKE '${INTERACTIVE_WH.replace(/[^A-Z0-9_]/gi, '')}'`, [], INTERACTIVE_WH);
  const shapes = [SQL.summary, SQL.holdings, SQL.activity, SQL.performance];
  const samples: { t: number; ms: number }[] = [];
  let errors = 0;
  const t0 = Date.now(); const end = t0 + seconds * 1000;
  // Burst profile: a quarter of the sessions, then all of them for the middle third (the peak), then a quarter again.
  const activeAt = (ms: number) => profile === 'steady' ? sessions
    : ms < seconds * 333 || ms > seconds * 667 ? Math.max(1, Math.round(sessions / 4)) : sessions;
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
    return { t: sec + 1, p95: pct(xs, 95), qps: xs.length, active: activeAt(sec * 1000 + 500) };
  });
  return {
    sessions, seconds, queries: samples.length, errors, qps: Math.round((samples.length / seconds) * 10) / 10,
    p50: pct(lat, 50), p95: pct(lat, 95), p99: pct(lat, 99), max: lat.length ? Math.max(...lat) : 0,
    timeline, warehouse: INTERACTIVE_WH, warehouseSize: String((size.rows[0] as Record<string, unknown>)?.size ?? 'unknown'), profile, source: 'live',
  };
}

const MODEL = process.env.SNOWFLAKE_COMPLETE_MODEL ?? 'claude-sonnet-4-5';

/** Short pre-meeting brief for the advisor, from the same rows the page shows. Runs AI_COMPLETE on the standard warehouse. */
export async function getAiBrief(advisor: string, account: string): Promise<AiBrief> {
  const page = await getAccount(advisor, account);
  if (!page.summary) throw new Error('Account not found in this advisor’s book');
  const facts = JSON.stringify({ summary: page.summary, holdings: page.holdings, recentActivity: page.activity.slice(0, 10), last12Months: page.performance.slice(-12) });
  const prompt = `You are helping a wealth advisor prepare for a client call. Using only these facts, write 3 short bullet points ` +
    `(allocation, recent activity, performance vs benchmark) and one suggested question for the client. No advice or recommendations to buy or sell. Facts: ${facts}`;
  const { rows, ms } = await query<{ R: string }>(`SELECT AI_COMPLETE(?, ?) AS R`, [MODEL, prompt], STANDARD_WH);
  return { text: String(rows[0]?.R ?? '').replace(/^"|"$/g, '').replace(/\\n/g, '\n'), latencyMs: ms, model: MODEL, source: 'live' };
}
