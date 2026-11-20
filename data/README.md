# Synthetic data

Everything here is synthetic. Quillstone, every advisor, household, account and fund name are
fictional; the funds are generic labels such as "US Large Cap Index Fund", not real instruments.

## Generators (both deterministic)

| Generator | What it makes | Seed |
| --- | --- | --- |
| `sql/setup.sql` | The warehouse data, generated inside Snowflake with `GENERATOR()`. Every value comes from `HASH()` of row numbers with fixed salts (for example `HASH(i, 'hh')`), so each run produces identical rows. | The fixed salts |
| `scripts/generate-data.mjs` (`npm run generate-data`) | `data/peak-hour-trace.json`: active advisor sessions per minute across one trading day, 07:00–19:00. Load lab draws it and replays its 09:00–10:30 shape. | `20261030` (mulberry32). Re-running gives byte-identical output |

| Table | Rows | Notes |
| --- | --- | --- |
| `RAW.ADVISORS` | 400 | Fictional names, regions, branches |
| `RAW.ACCOUNTS` | 500,000 | Round-robin to advisors (1,250 each) |
| `RAW.SECURITIES` | 60 | Generic fund names |
| `RAW.POSITIONS_EOD` | 20,000,000 | 10 positions per account on 4 month-ends (Jul–Oct 2026) |
| `RAW.ACTIVITY` | 50,000,001 | 100 events per account over two years, plus one planted deposit |
| `RAW.PERFORMANCE_MONTHLY` | 12,000,000 | 24 monthly returns per account, with a benchmark |

`lib/mock/sample.json` is the Sample-mode bundle. `scripts/capture-sample.mjs` writes it from a
running Live-mode app, so it holds the same rows plus latencies, load runs and AI text from a real
run (captured 2026-11-20 on an XSMALL interactive warehouse). It covers 28 accounts across the two
advisors' books; the book totals are for the full 1,250-account books.

## Planted stories

1. **Reconciliation break (the duplicate path).** `REPORTING_COPY.POSITIONS_COPY` simulates a nightly
   copy into a separate reporting database whose batch 7 of 12 timed out. Four accounts in Priya
   Castellane's book (`AC-000417`, `AC-012817`, `AC-088017`, `AC-201617`) have 8 positions in the copy
   and 10 in the single source; the copy holds 4,999,992 current positions instead of 5,000,000.
   `REPORTING_COPY.RECON_BREAKS` lists them, and Architecture compares them position by position.
2. **Peak-hour concurrency burst.** The seeded trace has a market-open surge from 09:30 to 10:00
   (peak 966 sessions at 09:51 against a median of 280) and a smaller close-of-day bump. Load lab's
   market-open profile replays that shape against the serving tables.
3. **Large deposit.** Hollis Family Trust (`AC-000417`) received a $250,000 deposit at 15:42 on
   2026-10-30, the last trading day in the data. It drives the "Large flow" pill, tops the activity
   feed and appears in the call prep brief. The same account is also in story 1.
4. **Row scoping.** Priya Castellane (`ADV-0017`) and Theo Marchbank (`ADV-0128`) each see only their
   own 1,250 accounts: every API query binds `ADVISOR_ID`, so asking for another advisor's account
   returns nothing.
