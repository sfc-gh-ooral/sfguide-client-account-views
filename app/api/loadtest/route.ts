import type { NextRequest } from 'next/server';
import { runLoadTest } from '@/lib/live-data';
import { live } from '../_shared';

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const sessions = Math.max(1, Math.min(32, Math.round(Number(body.sessions) || 8)));
  const seconds = Math.max(5, Math.min(60, Math.round(Number(body.seconds) || 20)));
  const profile = body.profile === 'burst' ? 'burst' : 'steady';
  return live('ADV-0017', () => runLoadTest(sessions, seconds, profile));
}
