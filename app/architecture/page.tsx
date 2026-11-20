'use client';

import { AlertTriangle, ArrowRight, Check, Database, Download, Layers, MonitorSmartphone, Server, Workflow, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAppState } from '@/components/AppState';
import { Drawer, ErrorBox, LatencyChip, Panel, Powered, Skel, int, usd, usdShort } from '@/components/ui';
import { useAsync } from '@/components/useAsync';
import { fetchRecon, fetchReconDetail } from '@/lib/client';
import { ADVISORS } from '@/lib/personas';
import type { Recon, ReconBreak } from '@/lib/types';

type N = { icon: typeof Database; name: string; sub: string; kind?: 'snow' | 'break' };

function Rail({ nodes, wireColor, slow }: { nodes: N[]; wireColor: string; slow?: boolean }) {
  return (
    <div className="flex flex-col md:flex-row md:items-stretch gap-2 md:gap-0">
      {nodes.map((n, i) => (
        <div key={n.name} className="contents">
          <div className={`node md:flex-1 ${n.kind === 'snow' ? 'node-snow' : n.kind === 'break' ? 'node-break' : ''}`}>
            <div className="flex items-center gap-2">
              <n.icon className="w-4 h-4 shrink-0" style={{ color: n.kind === 'break' ? 'var(--coral)' : n.kind === 'snow' ? 'var(--mint)' : 'var(--ink-2)' }} aria-hidden />
              <span className="font-semibold text-[13px] truncate">{n.name}</span>
            </div>
            <span className="text-[11.5px] text-2 leading-snug">{n.sub}</span>
          </div>
          {i < nodes.length - 1 && <div className={`wire hidden md:block self-center ${slow ? 'slow' : ''}`} style={{ ['--wire' as string]: wireColor }} aria-hidden />}
        </div>
      ))}
    </div>
  );
}

function Compare({ r }: { r: Recon }) {
  const rows: [string, string, string, boolean][] = [
    ['Systems on the read path', '5', '3', true],
    ['Extra pipelines to run and monitor', '1 (nightly ETL into the copy)', 'None (dynamic tables refresh in place)', true],
    ['Freshness', `Nightly: loaded ${r.copyLoadedAt} from the ${r.copySourceAsOf} close`, `Target lag ${r.servingTargetLag}; last refresh ${r.servingRefreshedAt ?? 'n/a'}`, true],
    ['Current positions held', int(r.copyRows), int(r.servingRows), r.copyRows === r.servingRows],
    ['Accounts that disagree with the source', int(r.totalBreaks), '0 (it is the source)', r.totalBreaks === 0],
  ];
  return (
    <div className="overflow-x-auto">
      <table className="tbl">
        <thead><tr><th>Measure</th><th>Duplicate reporting copy</th><th>Served from Snowflake</th></tr></thead>
        <tbody>{rows.map(([m, b, a]) => (
          <tr key={m}><td className="text-2">{m}</td><td className="mono text-[12.5px]">{b}</td><td className="mono text-[12.5px]" style={{ color: 'var(--mint)' }}>{a}</td></tr>
        ))}</tbody>
      </table>
    </div>
  );
}

const SENT_KEY = (adv: string) => `qs-recon-sent:${adv}`;

function BreakDrawer({ advisor, brk, onClose }: { advisor: string; brk?: ReconBreak; onClose: () => void }) {
  const d = useAsync(() => (brk ? fetchReconDetail(advisor, brk.ACCOUNT_ID) : new Promise<never>(() => {})), [advisor, brk?.ACCOUNT_ID]);
  return (
    <Drawer open={!!brk} onClose={onClose} title={brk ? `${brk.ACCOUNT_NAME} · ${brk.ACCOUNT_ID}` : ''}
      subtitle={brk && <>Copy holds <b>{brk.COPY_POSITIONS}</b> of <b>{brk.SERVING_POSITIONS}</b> positions · {usdShort(brk.SERVING_VALUE - brk.COPY_VALUE)} missing</>}>
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">{d.data && <LatencyChip ms={d.data.latencyMs} source={d.data.source} warehouse="CAV_WH" />}<Powered by="Dynamic Tables" /></div>
        {d.loading && <Skel className="h-48" />}
        {d.error && <ErrorBox message={d.error} onRetry={d.reload} />}
        {d.data && (
          <table className="tbl">
            <thead><tr><th>Fund</th><th className="num">Snowflake</th><th className="num">Copy</th><th /></tr></thead>
            <tbody>{d.data.lines.map((l) => {
              const missing = l.COPY_QTY === null;
              return (
                <tr key={l.SECURITY_ID} style={missing ? { background: 'var(--coral-soft)' } : undefined}>
                  <td><div className="font-medium text-[12.5px]">{l.SECURITY_NAME}</div><div className="mono text-[11px] text-2">{l.SECURITY_ID}</div></td>
                  <td className="num mono text-[12.5px]">{l.SERVING_VALUE === null ? '—' : usd(l.SERVING_VALUE)}</td>
                  <td className="num mono text-[12.5px]">{l.COPY_VALUE === null ? '—' : usd(l.COPY_VALUE)}</td>
                  <td>{missing ? <span className="pill pill-coral">Missing</span> : <Check className="w-4 h-4" style={{ color: 'var(--mint)' }} aria-label="Matches" />}</td>
                </tr>
              );
            })}</tbody>
          </table>
        )}
        <p className="text-[12px] text-2">Planted on this synthetic data set: batch 7 of 12 of the nightly copy timed out, dropping two positions for each affected account. An advisor page reading the copy would understate this account.</p>
      </div>
    </Drawer>
  );
}

export default function Architecture() {
  const { advisor, live } = useAppState();
  const ready = live !== undefined;
  const recon = useAsync(() => (ready ? fetchRecon(advisor) : new Promise<never>(() => {})), [advisor, ready]);
  const [open, setOpen] = useState<ReconBreak>();
  const [sent, setSent] = useState<string | null>(null);
  useEffect(() => setSent(window.localStorage.getItem(SENT_KEY(advisor))), [advisor]);
  const r = recon.data;

  const exportCsv = () => {
    if (!r) return;
    const lines = ['account_id,account_name,serving_positions,copy_positions,serving_value,copy_value',
      ...r.breaks.map((b) => [b.ACCOUNT_ID, `"${b.ACCOUNT_NAME}"`, b.SERVING_POSITIONS, b.COPY_POSITIONS, b.SERVING_VALUE, b.COPY_VALUE].join(','))];
    const url = URL.createObjectURL(new Blob([lines.join('\n') + '\n'], { type: 'text/csv' }));
    const el = document.createElement('a'); el.href = url; el.download = `recon-breaks-${advisor}.csv`; el.click(); URL.revokeObjectURL(url);
  };
  const markSent = () => { const at = new Date().toLocaleString(); window.localStorage.setItem(SENT_KEY(advisor), at); setSent(at); };

  return (
    <div className="space-y-4">
      <div>
        <div className="eyebrow">Architecture compare</div>
        <h1 className="text-[26px] font-semibold leading-tight">One fewer system between the data and the advisor</h1>
        <p className="text-[13px] text-2 mt-0.5 max-w-3xl">The same account page, fed two ways. On the left of each rail is where the data lives; on the right is what the advisor sees.</p>
      </div>

      <Panel eyebrow="Before" title="Warehouse → nightly ETL → reporting database → API" right={<span className="pill pill-coral"><AlertTriangle className="w-3 h-3" aria-hidden />Batch 7 of 12 timed out</span>}>
        <div className="p-4 dotgrid">
          <Rail slow wireColor="var(--coral)" nodes={[
            { icon: Database, name: 'Analytics warehouse', sub: 'Positions, activity, performance' },
            { icon: Workflow, name: 'Nightly ETL', sub: r ? `Loaded ${r.copyLoadedAt}` : 'Loads the prior close', kind: 'break' },
            { icon: Server, name: 'Reporting database', sub: 'Separate copy, separate bill' },
            { icon: Zap, name: 'Account API', sub: 'Reads the copy' },
            { icon: MonitorSmartphone, name: 'Advisor app', sub: 'Shows the copy' },
          ]} />
        </div>
      </Panel>
      <Panel eyebrow="After" title="Snowflake → API" right={<><Powered by="Dynamic Tables" /><Powered by="Interactive tables" /></>}>
        <div className="p-4 dotgrid">
          <Rail wireColor="var(--mint)" nodes={[
            { icon: Database, name: 'Raw tables', sub: '20M positions · 50M activity', kind: 'snow' },
            { icon: Layers, name: 'Dynamic tables', sub: 'Holdings + summary, target lag 1 hour', kind: 'snow' },
            { icon: Zap, name: 'Interactive tables', sub: 'Clustered by advisor, account; XSMALL interactive warehouse', kind: 'snow' },
            { icon: MonitorSmartphone, name: 'Account API → app', sub: 'Pooled, bound, scoped by advisor' },
          ]} />
        </div>
      </Panel>

      {recon.error && <div className="panel"><ErrorBox message={recon.error} onRetry={recon.reload} /></div>}
      <div className="grid xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] gap-4 items-start">
        <Panel eyebrow="Side by side" title="What each path costs you in moving parts and trust"
          right={r && <span className="pill pill-quiet mono">{r.source === 'live' ? 'live · CAV_WH' : 'captured'}</span>}>
          {r ? <Compare r={r} /> : <div className="p-4"><Skel className="h-40" /></div>}
        </Panel>
        <Panel eyebrow="Reconciliation" title={r ? `${r.breaks.length} accounts in ${ADVISORS[advisor].name}’s book disagree` : 'Reconciliation'}
          right={r && <><button className="btn" onClick={exportCsv}><Download className="w-4 h-4" aria-hidden />CSV</button>
            <button className="btn btn-primary" onClick={markSent} disabled={!r.breaks.length}>{sent ? 'Re-send' : 'Send to data ops'}</button></>}>
          {!r && <div className="p-4"><Skel className="h-40" /></div>}
          {r && r.breaks.length === 0 && <div className="p-6 text-sm text-2 text-center">No mismatches in this book. Switch advisor to see the planted break in {ADVISORS['ADV-0017'].name}’s book.</div>}
          {r && r.breaks.length > 0 && (
            <>
              <div className="overflow-x-auto">
                <table className="tbl">
                  <thead><tr><th>Account</th><th className="num">Positions</th><th className="num">Missing value</th><th /></tr></thead>
                  <tbody>{r.breaks.map((b) => (
                    <tr key={b.ACCOUNT_ID} className="cursor-pointer" onClick={() => setOpen(b)}>
                      <td><div className="font-medium">{b.ACCOUNT_NAME}</div><div className="mono text-[11px] text-2">{b.ACCOUNT_ID}</div></td>
                      <td className="num mono"><span style={{ color: 'var(--coral)' }}>{b.COPY_POSITIONS}</span> / {b.SERVING_POSITIONS}</td>
                      <td className="num mono">{usdShort(b.SERVING_VALUE - b.COPY_VALUE)}</td>
                      <td className="text-right"><button className="btn !h-7" onClick={(e) => { e.stopPropagation(); setOpen(b); }} aria-label={`Compare positions for ${b.ACCOUNT_NAME}`}>Compare <ArrowRight className="w-3.5 h-3.5" aria-hidden /></button></td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
              <div className="px-4 py-3 border-t text-[12px] text-2 flex flex-wrap gap-2 items-center" style={{ borderColor: 'var(--line)' }}>
                <span>Copy load status: <span className="mono" style={{ color: 'var(--coral)' }}>{r.copyStatus}</span></span>
                {sent && <span className="pill pill-mint ml-auto">Sent to data ops {sent}</span>}
              </div>
            </>
          )}
        </Panel>
      </div>
      <BreakDrawer advisor={advisor} brk={open} onClose={() => setOpen(undefined)} />
    </div>
  );
}
