// Live mode: a pool of Snowflake connections on the interactive warehouse. Server only.
// Every statement uses bind variables; nothing user-supplied is concatenated into SQL.
import snowflake from 'snowflake-sdk';

snowflake.configure({ logLevel: 'ERROR' });

export const INTERACTIVE_WH = process.env.SNOWFLAKE_WAREHOUSE ?? 'CAV_IWH';
export const STANDARD_WH = process.env.SNOWFLAKE_STANDARD_WAREHOUSE ?? 'CAV_WH';
const POOL_MAX = Number(process.env.SNOWFLAKE_POOL_MAX ?? 32);

export function isSnowflakeConfigured(): boolean {
  return !!(process.env.SNOWFLAKE_ACCOUNT && process.env.SNOWFLAKE_USERNAME &&
    (process.env.SNOWFLAKE_PRIVATE_KEY_PATH || process.env.SNOWFLAKE_TOKEN));
}

function options(): snowflake.ConnectionOptions {
  const base: snowflake.ConnectionOptions = {
    account: process.env.SNOWFLAKE_ACCOUNT!,
    username: process.env.SNOWFLAKE_USERNAME!,
    role: process.env.SNOWFLAKE_ROLE ?? 'CAV_DEMO_ROLE',
    warehouse: INTERACTIVE_WH,
    database: process.env.SNOWFLAKE_DATABASE ?? 'CLIENT_VIEWS_DEMO',
    schema: 'SERVING',
    clientSessionKeepAlive: true,
  };
  if (process.env.SNOWFLAKE_PRIVATE_KEY_PATH) return { ...base, authenticator: 'SNOWFLAKE_JWT', privateKeyPath: process.env.SNOWFLAKE_PRIVATE_KEY_PATH };
  return { ...base, authenticator: 'PROGRAMMATIC_ACCESS_TOKEN', token: process.env.SNOWFLAKE_TOKEN };
}

type Pool = ReturnType<typeof snowflake.createPool>;
const g = globalThis as unknown as { __cavPool?: Pool };

function pool(): Pool {
  // One pool per server process (kept across dev hot reloads). Connections are reused, so
  // only the first call pays for authentication.
  if (!g.__cavPool) g.__cavPool = snowflake.createPool(options(), { max: POOL_MAX, min: 0, evictionRunIntervalMillis: 60_000, idleTimeoutMillis: 600_000 });
  return g.__cavPool;
}

function exec<T>(conn: snowflake.Connection, sqlText: string, binds?: snowflake.Binds): Promise<T[]> {
  return new Promise((resolve, reject) => {
    conn.execute({ sqlText, binds, complete: (err, _s, rows) => (err ? reject(new Error(err.message)) : resolve((rows ?? []) as T[])) });
  });
}

const prepared = new WeakSet<snowflake.Connection>();

/** Runs one statement on a pooled connection and returns rows plus the measured round trip. */
export async function query<T = Record<string, unknown>>(sqlText: string, binds?: snowflake.Binds, warehouse = INTERACTIVE_WH): Promise<{ rows: T[]; ms: number }> {
  return pool().use(async (conn) => {
    if (!prepared.has(conn)) {
      // Measure real query work: no result cache, and only the example role's privileges.
      await exec(conn, 'ALTER SESSION SET USE_CACHED_RESULT = FALSE');
      await exec(conn, 'USE SECONDARY ROLES NONE');
      prepared.add(conn);
    }
    if (warehouse !== INTERACTIVE_WH) await exec(conn, `USE WAREHOUSE IDENTIFIER(?)`, [warehouse]);
    try {
      const t0 = performance.now();
      const rows = await exec<T>(conn, sqlText, binds);
      return { rows, ms: Math.round(performance.now() - t0) };
    } finally {
      if (warehouse !== INTERACTIVE_WH) await exec(conn, `USE WAREHOUSE IDENTIFIER(?)`, [INTERACTIVE_WH]);
    }
  });
}
