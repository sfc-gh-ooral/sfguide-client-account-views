import type { NextRequest } from 'next/server';
import { BOOK_SORTS, type BookSort, getBook } from '@/lib/live-data';
import { live } from '../_shared';

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const sort = (p.get('sort') ?? 'value') as BookSort;
  return live(p.get('advisor'), (a) => getBook(a, (p.get('q') ?? '').slice(0, 40), sort in BOOK_SORTS ? sort : 'value'));
}
