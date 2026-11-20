# Synthetic data

All data is generated inside Snowflake by `sql/setup.sql`. Every value comes from `HASH()` of row
numbers, so each run produces the same rows. No real people, firms, securities, or accounts.

| Table | Rows | Notes |
| --- | --- | --- |
| `RAW.ADVISORS` | 400 | Fictional advisor names, regions, branches |
| `RAW.ACCOUNTS` | 500,000 | Round-robin to advisors (1,250 each); fictional household names |
| `RAW.SECURITIES` | 60 | Generic fund names such as "US Large Cap Index Fund"; not real instruments |
| `RAW.POSITIONS_EOD` | 20,000,000 | 10 positions per account on 4 month-ends (Jul–Oct 2026) |
| `RAW.ACTIVITY` | 50,000,001 | 100 events per account over two years, plus one planted deposit |
| `RAW.PERFORMANCE_MONTHLY` | 12,000,000 | 24 monthly returns per account, with a benchmark |

`lib/mock/sample.json` is the Sample-mode bundle. `scripts/capture-sample.mjs` writes it from a
running Live-mode app, so it holds the same rows plus latencies and AI text from a real run.

## Planted stories

1. **Reconciliation break.** `REPORTING_COPY.POSITIONS_COPY` simulates a nightly copy into a separate
   reporting database whose batch 7 of 12 timed out. Four accounts in Dana Whitfield's book
   (`AC-000417`, `AC-012817`, `AC-088017`, `AC-201617`) show 8 positions in the copy and 10 in the
   single source. `REPORTING_COPY.RECON_BREAKS` lists them.
2. **Large deposit.** Hollis Family Trust (`AC-000417`) received a $250,000 deposit at 15:42 on
   2026-10-30, the last trading day in the data. It tops the activity feed and the call prep brief.
3. **Peak-hour burst.** The load test's burst profile runs a quarter of the sessions, then all of
   them for the middle third, then a quarter again. The bundled captures include 8, 16, and 32-session bursts.
4. **Row scoping.** Dana (`ADV-0017`) and Marcus Delacroix (`ADV-0128`) each see only their own
   1,250 accounts: every API query binds `ADVISOR_ID`.
