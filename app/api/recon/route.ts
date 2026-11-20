import type { NextRequest } from 'next/server';
import { getRecon } from '@/lib/live-data';
import { live } from '../_shared';

export async function GET(req: NextRequest) {
  return live(req.nextUrl.searchParams.get('advisor'), (a) => getRecon(a));
}
