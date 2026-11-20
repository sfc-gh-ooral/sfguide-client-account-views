-- =====================================================================================
-- Client Account Views at App Speed: Snowflake setup
-- Serves advisor account pages (summary, holdings, activity, performance) straight from
-- Snowflake with interactive tables on an interactive warehouse. Synthetic data only.
--
-- Run top to bottom in one Snowsight worksheet as ACCOUNTADMIN (no find-and-replace).
-- Creates: database CLIENT_VIEWS_DEMO, warehouses CAV_WH (standard XSMALL) and CAV_IWH
-- (interactive XSMALL), and role CAV_DEMO_ROLE. Changes nothing that already exists.
-- Needs a region where interactive warehouses are available (see the README).
-- Time: about 10-15 minutes on XSMALL, most of it generating 80M+ synthetic rows.
-- Remove everything with sql/cleanup.sql.
-- =====================================================================================

USE ROLE ACCOUNTADMIN;

-- ---------- Least-privilege role -------------------------------------------------------
CREATE ROLE IF NOT EXISTS CAV_DEMO_ROLE COMMENT = 'Client Account Views example: owns and serves the example objects';
SET my_user = CURRENT_USER();
GRANT ROLE CAV_DEMO_ROLE TO USER IDENTIFIER($my_user);
GRANT CREATE DATABASE ON ACCOUNT TO ROLE CAV_DEMO_ROLE;
GRANT CREATE WAREHOUSE ON ACCOUNT TO ROLE CAV_DEMO_ROLE;
-- Call prep brief uses AI_COMPLETE (Cortex AI).
GRANT DATABASE ROLE SNOWFLAKE.CORTEX_USER TO ROLE CAV_DEMO_ROLE;

-- Everything below runs as the example role, so it owns only what it creates.
USE ROLE CAV_DEMO_ROLE;

CREATE WAREHOUSE IF NOT EXISTS CAV_WH
  WAREHOUSE_SIZE = XSMALL AUTO_SUSPEND = 60 AUTO_RESUME = TRUE INITIALLY_SUSPENDED = TRUE
  COMMENT = 'Client Account Views example: data generation, dynamic table refresh, fallback';

CREATE DATABASE IF NOT EXISTS CLIENT_VIEWS_DEMO COMMENT = 'Client Account Views example (synthetic data)';
CREATE SCHEMA IF NOT EXISTS CLIENT_VIEWS_DEMO.RAW COMMENT = 'Analytics-side source tables';
CREATE SCHEMA IF NOT EXISTS CLIENT_VIEWS_DEMO.SERVING COMMENT = 'Serving tables built from RAW';
CREATE SCHEMA IF NOT EXISTS CLIENT_VIEWS_DEMO.REPORTING_COPY COMMENT = 'Simulated duplicate path: a nightly copy as a separate reporting database would hold it';
USE WAREHOUSE CAV_WH;
USE SCHEMA CLIENT_VIEWS_DEMO.RAW;

-- ---------- Synthetic data (deterministic: every value derives from HASH of row numbers) ----
-- 400 advisors
CREATE OR REPLACE TABLE ADVISORS AS
WITH n AS (SELECT ROW_NUMBER() OVER (ORDER BY SEQ4()) AS i FROM TABLE(GENERATOR(ROWCOUNT => 400))),
first_names AS (SELECT ARRAY_CONSTRUCT('Avery','Jordan','Morgan','Riley','Casey','Quinn','Taylor','Reese','Parker','Rowan','Sloane','Emerson','Hayden','Logan','Blair','Devon') a),
last_names AS (SELECT ARRAY_CONSTRUCT('Calloway','Brennan','Okafor','Lindqvist','Marchetti','Nakamura','Delacroix','Hargrove','Whitfield','Abernathy','Castellano','Pemberton','Ashworth','Vasquez','Thornbury','Kowalski') a)
SELECT 'ADV-' || LPAD(i, 4, '0') AS ADVISOR_ID,
       f.a[ABS(HASH(i, 'af')) % 16]::STRING || ' ' || l.a[ABS(HASH(i, 'al')) % 16]::STRING AS ADVISOR_NAME,
       ARRAY_CONSTRUCT('Northeast','Southeast','Midwest','Southwest','West')[i % 5]::STRING AS REGION,
       'BR-' || LPAD(1 + (i % 40), 3, '0') AS BRANCH_ID
FROM n, first_names f, last_names l;
-- Planted persona name for the walkthrough (fictional).
UPDATE ADVISORS SET ADVISOR_NAME = 'Priya Castellane' WHERE ADVISOR_ID = 'ADV-0017';
UPDATE ADVISORS SET ADVISOR_NAME = 'Theo Marchbank' WHERE ADVISOR_ID = 'ADV-0128';

-- 500,000 accounts, mapped round-robin to advisors
CREATE OR REPLACE TABLE ACCOUNTS AS
WITH n AS (SELECT ROW_NUMBER() OVER (ORDER BY SEQ4()) AS i FROM TABLE(GENERATOR(ROWCOUNT => 500000))),
s AS (SELECT ARRAY_CONSTRUCT('Abbott','Bellamy','Carrow','Dunmore','Ellery','Fairbanks','Garrison','Holloway','Ingram','Jessup','Kendall','Langford','Mercer','Northcott','Osgood','Prescott','Quill','Radcliffe','Sterling','Tolliver','Underhill','Vance','Winslow','Yardley') a)
SELECT 'AC-' || LPAD(i, 6, '0') AS ACCOUNT_ID,
       'ADV-' || LPAD(1 + MOD(i - 1, 400), 4, '0') AS ADVISOR_ID,
       s.a[ABS(HASH(i, 'hh')) % 24]::STRING || ' ' ||
         ARRAY_CONSTRUCT('Household','Family Trust','Joint','IRA','Roth IRA','Individual')[ABS(HASH(i, 'ty')) % 6]::STRING AS ACCOUNT_NAME,
       ARRAY_CONSTRUCT('Individual','Joint','Trust','Traditional IRA','Roth IRA','Rollover IRA')[ABS(HASH(i, 'ty')) % 6]::STRING AS ACCOUNT_TYPE,
       ARRAY_CONSTRUCT('Conservative','Moderate','Growth','Aggressive')[ABS(HASH(i, 'rk')) % 4]::STRING AS RISK_PROFILE,
       DATEADD(day, -(ABS(HASH(i, 'op')) % 5000), '2026-10-30'::DATE) AS OPENED_ON
FROM n, s;
UPDATE ACCOUNTS SET ACCOUNT_NAME = 'Hollis Family Trust', ACCOUNT_TYPE = 'Trust', RISK_PROFILE = 'Moderate' WHERE ACCOUNT_ID = 'AC-000417';
UPDATE ACCOUNTS SET ACCOUNT_NAME = 'Okonkwo Joint', ACCOUNT_TYPE = 'Joint', RISK_PROFILE = 'Growth' WHERE ACCOUNT_ID = 'AC-000017';

-- 60 synthetic securities (generic names, not real instruments)
CREATE OR REPLACE TABLE SECURITIES AS
WITH n AS (SELECT ROW_NUMBER() OVER (ORDER BY SEQ4()) AS i FROM TABLE(GENERATOR(ROWCOUNT => 60)))
SELECT 'SEC-' || LPAD(i, 3, '0') AS SECURITY_ID,
       ARRAY_CONSTRUCT('US Large Cap','US Small Cap','Intl Developed','Emerging Markets','US Aggregate Bond','Municipal Bond','Short Treasury','High Yield','Real Estate','Dividend Growth','Tech Sector','Healthcare Sector')[MOD(i - 1, 12)]::STRING
         || ' ' || ARRAY_CONSTRUCT('Index Fund','Fund A','Fund B','Portfolio','Strategy')[FLOOR((i - 1) / 12)]::STRING AS SECURITY_NAME,
       ARRAY_CONSTRUCT('Equity','Equity','Equity','Equity','Fixed Income','Fixed Income','Fixed Income','Fixed Income','Alternatives','Equity','Equity','Equity')[MOD(i - 1, 12)]::STRING AS ASSET_CLASS,
       ROUND(20 + ABS(HASH(i, 'px')) % 380 + (ABS(HASH(i, 'pc')) % 100) / 100, 2) AS BASE_PRICE
FROM n;

-- 20,000,000 end-of-day positions: 10 per account on 4 month-end dates
CREATE OR REPLACE TABLE POSITIONS_EOD AS
WITH a AS (SELECT ROW_NUMBER() OVER (ORDER BY ACCOUNT_ID) AS ai, ACCOUNT_ID FROM ACCOUNTS),
p AS (SELECT ROW_NUMBER() OVER (ORDER BY SEQ4()) - 1 AS slot FROM TABLE(GENERATOR(ROWCOUNT => 10))),
d AS (SELECT COLUMN1::DATE AS AS_OF_DATE, COLUMN2 AS k FROM VALUES ('2026-07-31', 0), ('2026-08-31', 1), ('2026-09-30', 2), ('2026-10-30', 3)),
base AS (
  SELECT a.ACCOUNT_ID, d.AS_OF_DATE, d.k,
         'SEC-' || LPAD(1 + MOD(ABS(HASH(a.ai, 'sx')) + p.slot * 7, 60), 3, '0') AS SECURITY_ID,
         10 + ABS(HASH(a.ai, p.slot, 'q')) % 2400 AS qty
  FROM a, p, d)
SELECT b.ACCOUNT_ID, b.AS_OF_DATE, b.SECURITY_ID, b.qty::NUMBER(18,2) AS QUANTITY,
       ROUND(s.BASE_PRICE * (1 + 0.012 * b.k + ((ABS(HASH(s.SECURITY_ID, b.k)) % 60) - 30) / 1000), 2) AS PRICE,
       ROUND(b.qty * s.BASE_PRICE * (1 + 0.012 * b.k + ((ABS(HASH(s.SECURITY_ID, b.k)) % 60) - 30) / 1000), 2) AS MARKET_VALUE
FROM base b JOIN SECURITIES s USING (SECURITY_ID);

-- 50,000,000 activity rows: 100 per account over two years
CREATE OR REPLACE TABLE ACTIVITY AS
WITH a AS (SELECT ROW_NUMBER() OVER (ORDER BY ACCOUNT_ID) AS ai, ACCOUNT_ID FROM ACCOUNTS),
e AS (SELECT ROW_NUMBER() OVER (ORDER BY SEQ4()) AS ei FROM TABLE(GENERATOR(ROWCOUNT => 100)))
SELECT a.ACCOUNT_ID,
       a.ai * 100 + e.ei AS ACTIVITY_ID,
       DATEADD(minute, -(ABS(HASH(a.ai, e.ei, 't')) % 1051200), '2026-10-30 16:00:00'::TIMESTAMP_NTZ) AS ACTIVITY_TS,
       ARRAY_CONSTRUCT('Buy','Sell','Dividend','Deposit','Withdrawal','Fee','Interest','Buy','Dividend','Deposit')[ABS(HASH(a.ai, e.ei, 'ty')) % 10]::STRING AS ACTIVITY_TYPE,
       'SEC-' || LPAD(1 + ABS(HASH(a.ai, e.ei, 's')) % 60, 3, '0') AS SECURITY_ID,
       ROUND((ABS(HASH(a.ai, e.ei, 'amt')) % 2500000) / 100 + 25, 2) AS AMOUNT
FROM a, e;

-- 12,000,000 monthly performance rows: 24 months per account
CREATE OR REPLACE TABLE PERFORMANCE_MONTHLY AS
WITH a AS (SELECT ROW_NUMBER() OVER (ORDER BY ACCOUNT_ID) AS ai, ACCOUNT_ID, RISK_PROFILE FROM ACCOUNTS),
m AS (SELECT ROW_NUMBER() OVER (ORDER BY SEQ4()) - 1 AS mi FROM TABLE(GENERATOR(ROWCOUNT => 24)))
SELECT a.ACCOUNT_ID,
       LAST_DAY(DATEADD(month, -m.mi, '2026-10-01'::DATE)) AS MONTH_END,
       ROUND(((ABS(HASH(a.ai, m.mi, 'r')) % 900) - 380) / 10000
             * DECODE(a.RISK_PROFILE, 'Conservative', 0.5, 'Moderate', 0.8, 'Growth', 1.1, 1.4), 4) AS RETURN_PCT,
       ROUND(((ABS(HASH(m.mi, 'bm')) % 700) - 280) / 10000, 4) AS BENCHMARK_PCT
FROM a, m;

-- Planted story 1: Hollis Family Trust (AC-000417) had a large deposit on the last trading day.
INSERT INTO ACTIVITY VALUES ('AC-000417', 1, '2026-10-30 15:42:00', 'Deposit', NULL, 250000.00);

-- ---------- Serving layer: dynamic tables, then interactive tables ----------------------
USE SCHEMA CLIENT_VIEWS_DEMO.SERVING;

-- Latest holdings per account, joined to security reference data.
CREATE OR REPLACE DYNAMIC TABLE HOLDINGS_CURRENT_DT
  TARGET_LAG = '1 hour' WAREHOUSE = CAV_WH
AS
SELECT a.ADVISOR_ID, p.ACCOUNT_ID, p.AS_OF_DATE, p.SECURITY_ID, s.SECURITY_NAME, s.ASSET_CLASS,
       p.QUANTITY, p.PRICE, p.MARKET_VALUE
FROM RAW.POSITIONS_EOD p
JOIN RAW.ACCOUNTS a ON a.ACCOUNT_ID = p.ACCOUNT_ID
JOIN RAW.SECURITIES s ON s.SECURITY_ID = p.SECURITY_ID
WHERE p.AS_OF_DATE = '2026-10-30';

-- One summary row per account: value, positions, last activity, year-to-date return.
CREATE OR REPLACE DYNAMIC TABLE ACCOUNT_SUMMARY_DT
  TARGET_LAG = '1 hour' WAREHOUSE = CAV_WH
AS
WITH h AS (SELECT ACCOUNT_ID, SUM(MARKET_VALUE) AS MV, COUNT(*) AS N_POS FROM HOLDINGS_CURRENT_DT GROUP BY ACCOUNT_ID),
act AS (SELECT ACCOUNT_ID, MAX(ACTIVITY_TS) AS LAST_TS,
               SUM(IFF(ACTIVITY_TYPE = 'Deposit', AMOUNT, 0)) - SUM(IFF(ACTIVITY_TYPE = 'Withdrawal', AMOUNT, 0)) AS NET_FLOWS_2Y
        FROM RAW.ACTIVITY GROUP BY ACCOUNT_ID),
perf AS (SELECT ACCOUNT_ID, EXP(SUM(LN(1 + RETURN_PCT))) - 1 AS YTD, EXP(SUM(LN(1 + BENCHMARK_PCT))) - 1 AS BENCH_YTD
         FROM RAW.PERFORMANCE_MONTHLY WHERE MONTH_END >= '2026-01-01' GROUP BY ACCOUNT_ID),
-- Net deposits minus withdrawals in the last 7 days of the data, for the book's "Large flow" pill.
flow7 AS (SELECT ACCOUNT_ID, SUM(DECODE(ACTIVITY_TYPE, 'Deposit', AMOUNT, 'Withdrawal', -AMOUNT, 0)) AS FLOW_7D
          FROM RAW.ACTIVITY WHERE ACTIVITY_TS >= '2026-10-23' GROUP BY ACCOUNT_ID)
SELECT a.ADVISOR_ID, a.ACCOUNT_ID, a.ACCOUNT_NAME, a.ACCOUNT_TYPE, a.RISK_PROFILE, a.OPENED_ON,
       ROUND(h.MV, 2) AS MARKET_VALUE, h.N_POS AS POSITION_COUNT, act.LAST_TS AS LAST_ACTIVITY_TS,
       ROUND(act.NET_FLOWS_2Y, 2) AS NET_FLOWS_2Y, ROUND(perf.YTD, 4) AS YTD_RETURN,
       ROUND(perf.BENCH_YTD, 4) AS BENCH_YTD_RETURN, ROUND(COALESCE(flow7.FLOW_7D, 0), 2) AS NET_FLOW_7D
FROM RAW.ACCOUNTS a
JOIN h ON h.ACCOUNT_ID = a.ACCOUNT_ID
JOIN act ON act.ACCOUNT_ID = a.ACCOUNT_ID
JOIN perf ON perf.ACCOUNT_ID = a.ACCOUNT_ID
LEFT JOIN flow7 ON flow7.ACCOUNT_ID = a.ACCOUNT_ID;

-- Interactive tables, clustered on the keys every API call filters by (advisor, account).
-- TARGET_LAG makes them refresh automatically from the dynamic tables and raw tables.
CREATE OR REPLACE INTERACTIVE TABLE ACCOUNT_SUMMARY_IT
  CLUSTER BY (ADVISOR_ID, ACCOUNT_ID) TARGET_LAG = '1 hour' WAREHOUSE = CAV_WH
AS SELECT * FROM ACCOUNT_SUMMARY_DT;

CREATE OR REPLACE INTERACTIVE TABLE HOLDINGS_IT
  CLUSTER BY (ADVISOR_ID, ACCOUNT_ID) TARGET_LAG = '1 hour' WAREHOUSE = CAV_WH
AS SELECT * FROM HOLDINGS_CURRENT_DT;

CREATE OR REPLACE INTERACTIVE TABLE ACTIVITY_IT
  CLUSTER BY (ADVISOR_ID, ACCOUNT_ID) TARGET_LAG = '1 hour' WAREHOUSE = CAV_WH
AS SELECT a.ADVISOR_ID, x.ACCOUNT_ID, x.ACTIVITY_ID, x.ACTIVITY_TS, x.ACTIVITY_TYPE, x.SECURITY_ID, x.AMOUNT
   FROM RAW.ACTIVITY x JOIN RAW.ACCOUNTS a ON a.ACCOUNT_ID = x.ACCOUNT_ID;

CREATE OR REPLACE INTERACTIVE TABLE PERFORMANCE_IT
  CLUSTER BY (ADVISOR_ID, ACCOUNT_ID) TARGET_LAG = '1 hour' WAREHOUSE = CAV_WH
AS SELECT a.ADVISOR_ID, p.ACCOUNT_ID, p.MONTH_END, p.RETURN_PCT, p.BENCHMARK_PCT
   FROM RAW.PERFORMANCE_MONTHLY p JOIN RAW.ACCOUNTS a ON a.ACCOUNT_ID = p.ACCOUNT_ID;

-- Interactive warehouse that keeps the four serving tables warm in its cache.
-- Minimum AUTO_SUSPEND for interactive warehouses is 3600 seconds, and each resume bills at least one hour.
CREATE INTERACTIVE WAREHOUSE IF NOT EXISTS CAV_IWH
  TABLES (ACCOUNT_SUMMARY_IT, HOLDINGS_IT, ACTIVITY_IT, PERFORMANCE_IT)
  WAREHOUSE_SIZE = XSMALL AUTO_SUSPEND = 3600 AUTO_RESUME = TRUE
  FALLBACK_WAREHOUSE = CAV_WH
  COMMENT = 'Client Account Views example: low-latency serving';
-- Creating a warehouse makes it current; switch back so the steps below run on the standard warehouse.
USE WAREHOUSE CAV_WH;

-- ---------- Planted story 2: the duplicate path ------------------------------------------
-- A nightly ETL copy, as a separate reporting database would hold it. It was loaded from the
-- prior close, and one batch partly failed, so some accounts are missing positions.
USE SCHEMA CLIENT_VIEWS_DEMO.REPORTING_COPY;
CREATE OR REPLACE TABLE POSITIONS_COPY AS
SELECT * FROM SERVING.HOLDINGS_CURRENT_DT
QUALIFY NOT (ACCOUNT_ID IN ('AC-000417', 'AC-012817', 'AC-088017', 'AC-201617')
             AND ROW_NUMBER() OVER (PARTITION BY ACCOUNT_ID ORDER BY SECURITY_ID) <= 2);
CREATE OR REPLACE TABLE LOAD_LOG (LOADED_AT TIMESTAMP_NTZ, SOURCE_AS_OF DATE, ROWS_LOADED NUMBER, STATUS STRING);
INSERT INTO LOAD_LOG SELECT '2026-10-31 02:14:00', '2026-10-30', COUNT(*), 'PARTIAL: batch 7 of 12 timed out' FROM POSITIONS_COPY;

-- Reconciliation view: per account, position counts and value on the copy vs the serving table.
CREATE OR REPLACE VIEW RECON_BREAKS AS
SELECT s.ADVISOR_ID, s.ACCOUNT_ID, a.ACCOUNT_NAME, s.N AS SERVING_POSITIONS, COALESCE(c.N, 0) AS COPY_POSITIONS,
       ROUND(s.MV, 2) AS SERVING_VALUE, ROUND(COALESCE(c.MV, 0), 2) AS COPY_VALUE
FROM (SELECT ADVISOR_ID, ACCOUNT_ID, COUNT(*) N, SUM(MARKET_VALUE) MV FROM SERVING.HOLDINGS_CURRENT_DT GROUP BY 1, 2) s
JOIN RAW.ACCOUNTS a ON a.ACCOUNT_ID = s.ACCOUNT_ID
LEFT JOIN (SELECT ACCOUNT_ID, COUNT(*) N, SUM(MARKET_VALUE) MV FROM POSITIONS_COPY GROUP BY 1) c ON c.ACCOUNT_ID = s.ACCOUNT_ID
WHERE s.N <> COALESCE(c.N, 0);

-- Quick check
SELECT COUNT(*) AS accounts FROM SERVING.ACCOUNT_SUMMARY_IT;
SELECT * FROM REPORTING_COPY.RECON_BREAKS ORDER BY ACCOUNT_ID;
