import { NextResponse } from 'next/server';
import { isSnowflakeConfigured } from '@/lib/snowflake';
import { isAdvisorId } from '@/lib/personas';

/** Validates the advisor, runs a live handler, and reports errors instead of falling back to sample data. */
export async function live<T>(advisor: string | null, fn: (advisor: string) => Promise<T>) {
  if (!isSnowflakeConfigured()) return NextResponse.json({ error: 'No Snowflake connection is configured on this server.' }, { status: 503 });
  if (!isAdvisorId(advisor)) return NextResponse.json({ error: 'Unknown advisor' }, { status: 400 });
  try { return NextResponse.json(await fn(advisor)); }
  catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 }); }
}
