import type { NextRequest } from 'next/server';
import { getBook } from '@/lib/live-data';
import { live } from '../_shared';

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  return live(p.get('advisor'), (a) => getBook(a, (p.get('q') ?? '').slice(0, 40)));
}
