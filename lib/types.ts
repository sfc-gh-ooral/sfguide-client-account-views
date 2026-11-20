export type AdvisorId = 'ADV-0017' | 'ADV-0128';

export interface AccountSummary {
  ADVISOR_ID: string; ACCOUNT_ID: string; ACCOUNT_NAME: string; ACCOUNT_TYPE: string; RISK_PROFILE: string;
  OPENED_ON: string; MARKET_VALUE: number; POSITION_COUNT: number; LAST_ACTIVITY_TS: string;
  NET_FLOWS_2Y: number; YTD_RETURN: number;
}
export interface Holding { SECURITY_ID: string; SECURITY_NAME: string; ASSET_CLASS: string; QUANTITY: number; PRICE: number; MARKET_VALUE: number; AS_OF_DATE: string }
export interface Activity { ACTIVITY_ID: number; ACTIVITY_TS: string; ACTIVITY_TYPE: string; SECURITY_ID: string | null; AMOUNT: number }
export interface PerfPoint { MONTH_END: string; RETURN_PCT: number; BENCHMARK_PCT: number }

/** Round trip in ms for each widget query, measured on the app server. */
export interface Timings { summary: number; holdings: number; activity: number; performance: number }

export interface AccountPage {
  summary: AccountSummary | null; holdings: Holding[]; activity: Activity[]; performance: PerfPoint[];
  timings: Timings; source: 'live' | 'captured'; warehouse: string; capturedAt?: string;
}

export interface BookRow { ACCOUNT_ID: string; ACCOUNT_NAME: string; ACCOUNT_TYPE: string; MARKET_VALUE: number; YTD_RETURN: number; LAST_ACTIVITY_TS: string }
export interface Book { rows: BookRow[]; total: number; latencyMs: number; source: 'live' | 'captured' }

export interface ReconBreak { ACCOUNT_ID: string; SERVING_POSITIONS: number; COPY_POSITIONS: number }
export interface Recon {
  breaks: ReconBreak[]; totalBreaks: number; copyLoadedAt: string; copySourceAsOf: string; copyStatus: string;
  servingTargetLag: string; servingRefreshedAt: string | null; source: 'live' | 'captured';
}

export interface LoadTestResult {
  sessions: number; seconds: number; queries: number; errors: number; qps: number;
  p50: number; p95: number; p99: number; max: number;
  /** p95 per second of the run, for the timeline chart. */
  timeline: { t: number; p95: number; qps: number; active: number }[];
  warehouse: string; warehouseSize: string; profile: 'steady' | 'burst';
  source: 'live' | 'captured'; capturedAt?: string;
}

export interface AiBrief { text: string; latencyMs: number; model: string; source: 'live' | 'sample' }
