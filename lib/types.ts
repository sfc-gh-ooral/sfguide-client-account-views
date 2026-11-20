export type AdvisorId = 'ADV-0017' | 'ADV-0128';
export type Source = 'live' | 'captured';

export interface AccountSummary {
  ADVISOR_ID: string; ACCOUNT_ID: string; ACCOUNT_NAME: string; ACCOUNT_TYPE: string; RISK_PROFILE: string;
  OPENED_ON: string; MARKET_VALUE: number; POSITION_COUNT: number; LAST_ACTIVITY_TS: string;
  NET_FLOWS_2Y: number; YTD_RETURN: number; BENCH_YTD_RETURN: number; NET_FLOW_7D: number;
}
export interface Holding { SECURITY_ID: string; SECURITY_NAME: string; ASSET_CLASS: string; QUANTITY: number; PRICE: number; MARKET_VALUE: number; AS_OF_DATE: string }
export interface Activity { ACTIVITY_ID: number; ACTIVITY_TS: string; ACTIVITY_TYPE: string; SECURITY_ID: string | null; AMOUNT: number }
export interface PerfPoint { MONTH_END: string; RETURN_PCT: number; BENCHMARK_PCT: number }

/** Round trip in ms for each widget query, measured on the app server. */
export interface Timings { summary: number; holdings: number; activity: number; performance: number }

export interface AccountPage {
  summary: AccountSummary | null; holdings: Holding[]; activity: Activity[]; performance: PerfPoint[];
  timings: Timings; source: Source; warehouse: string; capturedAt?: string;
}

export interface BookRow {
  ACCOUNT_ID: string; ACCOUNT_NAME: string; ACCOUNT_TYPE: string; RISK_PROFILE: string; MARKET_VALUE: number;
  YTD_RETURN: number; BENCH_YTD_RETURN: number; NET_FLOW_7D: number; POSITION_COUNT: number; LAST_ACTIVITY_TS: string;
}
export interface BookStats { accounts: number; aum: number; avgYtd: number; flows7d: number }
export interface Book { rows: BookRow[]; total: number; stats: BookStats; latencyMs: number; source: Source }

export interface ReconBreak { ACCOUNT_ID: string; ACCOUNT_NAME: string; SERVING_POSITIONS: number; COPY_POSITIONS: number; SERVING_VALUE: number; COPY_VALUE: number }
export interface Recon {
  breaks: ReconBreak[]; totalBreaks: number; copyLoadedAt: string; copySourceAsOf: string; copyStatus: string; copyRows: number;
  servingTargetLag: string; servingRefreshedAt: string | null; servingRows: number; source: Source;
}
/** One position compared across the serving table and the duplicate copy. */
export interface ReconLine { SECURITY_ID: string; SECURITY_NAME: string; SERVING_QTY: number | null; COPY_QTY: number | null; SERVING_VALUE: number | null; COPY_VALUE: number | null }
export interface ReconDetail { accountId: string; lines: ReconLine[]; latencyMs: number; source: Source }

export type LoadProfile = 'steady' | 'burst' | 'peak';
export interface LoadTestResult {
  sessions: number; seconds: number; queries: number; errors: number; qps: number;
  p50: number; p95: number; p99: number; max: number;
  /** Per second of the run, for the timeline chart. */
  timeline: { t: number; p50: number; p95: number; qps: number; active: number }[];
  /** Latency histogram: bucket upper bound in ms and query count. */
  histogram: { le: number; n: number }[];
  warehouse: string; warehouseSize: string; profile: LoadProfile; rowsScanned: string;
  startedAt: string; source: Source; capturedAt?: string;
}

export interface Citation { id: string; label: string }
export interface AiBrief { text: string; citations: Citation[]; latencyMs: number; model: string; source: 'live' | 'sample' }

export interface Trace { seed: number; burst: { start: string; end: string }; peak: { t: string; sessions: number }; median: number; minutes: { t: string; sessions: number }[] }
