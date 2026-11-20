'use client';

import { AlertTriangle, Check, Loader2, Sparkles, Timer, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

// ---------- Formatting ----------
export const usd = (n: number, digits = 0) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: digits, minimumFractionDigits: digits });
export const usdShort = (n: number) => {
  const a = Math.abs(n);
  const s = a >= 1e9 ? `${(a / 1e9).toFixed(2)}B` : a >= 1e6 ? `${(a / 1e6).toFixed(2)}M` : a >= 1e3 ? `${(a / 1e3).toFixed(1)}K` : a.toFixed(0);
  return `${n < 0 ? '−' : ''}$${s}`;
};
export const pct = (n: number, digits = 1) => `${n >= 0 ? '+' : '−'}${Math.abs(n * 100).toFixed(digits)}%`;
export const int = (n: number) => Math.round(n).toLocaleString('en-US');

// ---------- Brand ----------
export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect x="1" y="1" width="30" height="30" rx="9" fill="#F2A93B" />
      <rect x="13" y="4" width="6" height="3" rx="1.5" fill="#15171B" />
      <circle cx="16" cy="18" r="9" fill="none" stroke="#15171B" strokeWidth="2.6" />
      <path d="M16 18 L21 13" stroke="#15171B" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}

// ---------- Layout ----------
export function Panel({ title, eyebrow, right, children, className = '', bodyClass = '' }: {
  title?: React.ReactNode; eyebrow?: string; right?: React.ReactNode; children: React.ReactNode; className?: string; bodyClass?: string;
}) {
  return (
    <section className={`panel fade-up min-w-0 ${className}`}>
      {(title || right) && (
        <header className="panel-head flex-wrap">
          <div className="min-w-0">
            {eyebrow && <div className="eyebrow mb-0.5">{eyebrow}</div>}
            {title && <h2 className="panel-title">{title}</h2>}
          </div>
          {right && <div className="flex items-center gap-2 flex-wrap">{right}</div>}
        </header>
      )}
      <div className={bodyClass}>{children}</div>
    </section>
  );
}

/** Counts up from 0 to the value on first show, unless reduced motion is on. */
export function useCountUp(target: number, ms = 600) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setV(target); return; }
    let raf = 0; const t0 = performance.now();
    const step = (t: number) => { const k = Math.min(1, (t - t0) / ms); setV(target * (1 - (1 - k) ** 3)); if (k < 1) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

export const latClass = (ms: number) => (ms < 150 ? 'lat-fast' : ms < 600 ? 'lat-mid' : 'lat-slow');

/** The latency chip on every widget: measured round trip, plus where it came from. */
export function LatencyChip({ ms, source, warehouse }: { ms: number; source: 'live' | 'captured'; warehouse?: string }) {
  const v = useCountUp(ms);
  const where = source === 'live' ? `live${warehouse ? ` · ${warehouse}` : ''}` : 'captured';
  return (
    <span className={`lat ${latClass(ms)}`} title={source === 'live' ? 'Measured on the app server for this request' : 'Measured in a live run and bundled with this example'}>
      <Timer className="w-3 h-3" aria-hidden /><b>{Math.round(v)} ms</b><span className="src">{where}</span>
    </span>
  );
}

export function Powered({ by }: { by: string }) {
  return <span className="powered">Powered by <b>{by}</b></span>;
}

export function Skel({ className = '' }: { className?: string }) {
  return <div className={`skel ${className}`} aria-hidden />;
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="m-4 p-3 rounded-lg flex items-start gap-3 text-sm" style={{ background: 'var(--coral-soft)', color: 'var(--coral)' }}>
      <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1"><div className="font-semibold">Couldn’t load this from Snowflake</div><div className="break-words" style={{ color: 'var(--ink)' }}>{message}</div></div>
      {onRetry && <button className="btn" onClick={onRetry}>Retry</button>}
    </div>
  );
}

export function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="p-8 text-center">
      <div className="font-semibold">{title}</div>
      {hint && <div className="text-sm text-2 mt-1">{hint}</div>}
    </div>
  );
}

export function Drawer({ open, onClose, title, subtitle, children }: { open: boolean; onClose: () => void; title: React.ReactNode; subtitle?: React.ReactNode; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    ref.current?.focus();
    return () => window.removeEventListener('keydown', k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="drawer" role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : 'Details'} tabIndex={-1} ref={ref}>
        <header className="panel-head">
          <div className="min-w-0"><h2 className="panel-title truncate">{title}</h2>{subtitle && <div className="text-xs text-2 mt-0.5">{subtitle}</div>}</div>
          <button className="btn !px-2" onClick={onClose} aria-label="Close"><X className="w-4 h-4" /></button>
        </header>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </>
  );
}

// ---------- AI ----------
export function SampleAiLabel() {
  return <span className="pill pill-plum"><Sparkles className="w-3 h-3" aria-hidden />Sample AI response</span>;
}

/**
 * Staged progress for a running call. Steps advance on a timer paced to `expectMs` (Sample mode
 * uses its scripted delay; Live uses a typical duration with no added wait) and the last step holds
 * until the answer arrives. Steps must describe work the live path really does.
 */
export function Steps({ steps, expectMs, done }: { steps: string[]; expectMs: number; done: boolean }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (done) return;
    const t0 = Date.now();
    const id = window.setInterval(() => setElapsed(Date.now() - t0), 100);
    return () => window.clearInterval(id);
  }, [done]);
  const at = done ? steps.length : Math.min(steps.length - 1, Math.floor(elapsed / (expectMs / steps.length)));
  return (
    <div role="status" aria-live="polite" className="space-y-1.5">
      {steps.map((s, i) => {
        const state = i < at ? 'done' : i === at ? 'active' : 'todo';
        return (
          <div key={s} className={`step ${state}`}>
            {state === 'done' ? <Check className="w-3.5 h-3.5" style={{ color: 'var(--mint)' }} aria-hidden />
              : state === 'active' ? <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: 'var(--plum)' }} aria-hidden />
              : <span className="w-3.5 h-3.5 rounded-full border" style={{ borderColor: 'var(--line)' }} aria-hidden />}
            <span>{s}</span>
          </div>
        );
      })}
      {!done && <div className="mono text-[11px] text-2 pt-1">{(elapsed / 1000).toFixed(1)} s</div>}
    </div>
  );
}

/** Reveals text word by word, like a streamed answer. Source tags such as [H] render as citation chips. */
export function StreamText({ text, onDone }: { text: string; onDone?: () => void }) {
  const words = text.split(/(\s+)/);
  const [n, setN] = useState(0);
  useEffect(() => {
    setN(0);
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setN(words.length); onDone?.(); return; }
    let i = 0;
    const id = window.setInterval(() => { i += 2; setN(i); if (i >= words.length) { window.clearInterval(id); onDone?.(); } }, 28);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);
  const shown = words.slice(0, n).join('');
  const lines = shown.split('\n').filter((l, i, a) => l.trim() || i < a.length - 1);
  return (
    <div className={`text-[13.5px] leading-relaxed space-y-1.5 ${n < words.length ? 'cursor' : ''}`}>
      {lines.map((l, i) => {
        const bullet = /^\s*[-•*]\s+/.test(l);
        const body = l.replace(/^\s*[-•*]\s+/, '').replace(/\*\*/g, '');
        const parts = body.split(/(\[[SHAP]\])/g);
        return (
          <p key={i} className={bullet ? 'pl-4 relative' : ''}>
            {bullet && <span className="absolute left-0" style={{ color: 'var(--plum)' }}>•</span>}
            {parts.map((p, j) => /^\[[SHAP]\]$/.test(p) ? <span key={j} className="cite">{p[1]}</span> : <span key={j}>{p}</span>)}
          </p>
        );
      })}
    </div>
  );
}

export function ChartTip({ active, payload, label, fmt }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string; fmt?: (v: number, name: string) => string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tip">
      <div className="mono text-[11px] text-2 mb-1">{label}</div>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} aria-hidden />
          <span className="text-2">{p.name}</span><span className="mono ml-auto pl-3">{fmt ? fmt(p.value, p.name) : p.value}</span>
        </div>
      ))}
    </div>
  );
}
