import type { NextRequest } from 'next/server';
import { getAccount } from '@/lib/live-data';
import { live } from '../_shared';

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  return live(p.get('advisor'), (a) => getAccount(a, (p.get('account') ?? '').slice(0, 12)));
}
