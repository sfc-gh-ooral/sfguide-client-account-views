import type { NextRequest } from 'next/server';
import { getReconDetail } from '@/lib/live-data';
import { live } from '../_shared';

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  return live(p.get('advisor'), (a) => getReconDetail(a, (p.get('account') ?? '').slice(0, 12)));
}
