'use client';

import { BarChart3, ChevronDown, Gauge, GitCompareArrows, LayoutList, Menu, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { AppStateProvider, useAppState } from '@/components/AppState';
import { ModeChip } from '@/components/ModeChip';
import { LogoMark } from '@/components/ui';
import { HOSTED_EXAMPLE } from '@/lib/hosted';
import { ADVISOR_IDS, ADVISORS } from '@/lib/personas';
import type { AdvisorId } from '@/lib/types';

const REPO = 'https://github.com/sfc-gh-ooral/sfguide-client-account-views';
const NAV = [
  { href: '/', label: 'Account desk', icon: LayoutList },
  { href: '/architecture', label: 'Architecture', icon: GitCompareArrows },
  { href: '/load-test', label: 'Load lab', icon: Gauge },
  { href: '/cost', label: 'Cost model', icon: BarChart3 },
];

function AdvisorChip() {
  const { advisor, setAdvisor } = useAppState();
  const a = ADVISORS[advisor];
  return (
    <label className="chip-dark relative cursor-pointer" title="Viewing as: the API scopes every query to this advisor's book">
      <span className="w-6 h-6 rounded-md grid place-items-center text-[11px] font-bold" style={{ background: '#2e333d' }} aria-hidden>{a.initials}</span>
      <span className="hidden lg:flex flex-col leading-tight">
        <span className="text-[10px] uppercase tracking-wider" style={{ color: '#a8acb5' }}>Viewing as</span>
        <span className="font-medium">{a.name}</span>
      </span>
      <ChevronDown className="w-3.5 h-3.5" style={{ color: '#a8acb5' }} aria-hidden />
      <select aria-label="Viewing as advisor" className="absolute inset-0 opacity-0 cursor-pointer" value={advisor} onChange={(e) => setAdvisor(e.target.value as AdvisorId)}>
        {ADVISOR_IDS.map((id) => <option key={id} value={id}>{ADVISORS[id].name} · {id}</option>)}
      </select>
    </label>
  );
}

function EnvBadge() {
  const { live } = useAppState();
  if (live === undefined) return null;
  return <span className={`env-badge ${live ? 'env-live' : 'env-sample'}`}>{live ? 'Live · Snowflake' : HOSTED_EXAMPLE ? 'Hosted sample' : 'Sample data'}</span>;
}

/** The last account page's widget timings, as a segmented strip under the navigation. */
function TimingStrip() {
  const { lastTimings } = useAppState();
  const parts = lastTimings ? [
    { k: 'summary', v: lastTimings.summary, c: 'var(--saffron)' }, { k: 'holdings', v: lastTimings.holdings, c: 'var(--mint)' },
    { k: 'activity', v: lastTimings.activity, c: 'var(--sky)' }, { k: 'performance', v: lastTimings.performance, c: 'var(--plum)' },
  ] : [];
  const total = parts.reduce((s, p) => s + p.v, 0) || 1;
  return (
    <div className="timing-strip" aria-hidden>
      {parts.map((p) => <span key={p.k} style={{ width: `${(p.v / total) * 100}%`, background: p.c }} />)}
    </div>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const current = (href: string) => (href === '/' ? path === '/' : path.startsWith(href));
  return (
    <div className="min-h-screen flex flex-col">
      <header className="topbar sticky top-0 z-30">
        <div className="max-w-[1480px] mx-auto px-3 sm:px-5 flex items-center gap-3 h-14">
          <button className="md:hidden p-1.5 -ml-1 rounded-md" onClick={() => setOpen(!open)} aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open}>
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <Link href="/" className="flex items-center gap-2.5 shrink-0" aria-label="Quillstone Advisor Desk home">
            <LogoMark />
            <span className="leading-none">
              <span className="display font-semibold text-[16px] hidden min-[420px]:inline">Quillstone</span>
              <span className="hidden sm:inline ml-2 text-[10.5px] uppercase tracking-[0.16em]" style={{ color: '#a8acb5' }}>Advisor Desk</span>
            </span>
          </Link>
          <nav className="hidden md:flex items-center ml-4" aria-label="Main">
            {NAV.map(({ href, label, icon: I }) => (
              <Link key={href} href={href} className="navtab" aria-current={current(href) ? 'page' : undefined}><I className="w-4 h-4" aria-hidden />{label}</Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1.5 sm:gap-2 min-w-0">
            <span className="hidden sm:inline-flex"><EnvBadge /></span>
            <AdvisorChip />
            <ModeChip />
          </div>
        </div>
        {open && (
          <nav className="md:hidden border-t px-3 pb-3 pt-1 fade-up" style={{ borderColor: '#262a32' }} aria-label="Main">
            {NAV.map(({ href, label, icon: I }) => (
              <Link key={href} href={href} onClick={() => setOpen(false)} className="flex items-center gap-3 px-2 py-2.5 rounded-md"
                style={{ color: current(href) ? '#f2a93b' : '#eceae4' }} aria-current={current(href) ? 'page' : undefined}><I className="w-4 h-4" aria-hidden />{label}</Link>
            ))}
            <div className="px-2 pt-2"><EnvBadge /></div>
          </nav>
        )}
        <TimingStrip />
      </header>

      {HOSTED_EXAMPLE && (
        <div className="text-[12.5px] px-4 py-2 text-center" style={{ background: 'var(--plum-soft)' }}>
          <b>Hosted example, Sample mode.</b> <span className="text-2">Runs in your browser on synthetic data; timings and AI text were captured from a live run.</span>{' '}
          <a className="underline" href={`${REPO}#live-mode-deploy-to-your-account`}>Run it live in your own account</a>
        </div>
      )}

      <main className="flex-1 w-full max-w-[1480px] mx-auto px-3 sm:px-5 py-4 sm:py-5">{children}</main>

      <footer className="border-t text-[12px] text-2" style={{ borderColor: 'var(--line)' }}>
        <div className="max-w-[1480px] mx-auto px-3 sm:px-5 py-4 flex flex-col md:flex-row gap-2 md:items-center md:justify-between">
          <p><b style={{ color: 'var(--ink)' }}>Synthetic example.</b> Quillstone and every advisor, account and fund are fictional. Illustrative logic only:
            not production, investment, regulatory or compliance advice. Not an official Snowflake product.</p>
          <a className="underline shrink-0" href={REPO}>Repository and setup guide</a>
        </div>
      </footer>
    </div>
  );
}

export default function Shell({ children }: { children: React.ReactNode }) {
  return <AppStateProvider><Frame>{children}</Frame></AppStateProvider>;
}
