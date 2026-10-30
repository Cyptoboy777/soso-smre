'use client';

import { useCallback, useEffect, useState } from 'react';
import { Radio } from 'lucide-react';

type Row = {
  name: string;
  provider: string;
  url: string;
  status: number | 'error';
  ok: boolean;
  ms: number;
  note?: string;
};

export function ApiDiagnostics() {
  const [rows, setRows] = useState<Row[]>([]);
  const [keys, setKeys] = useState<Record<string, boolean>>({});
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [model, setModel] = useState<string | null>(null);
  const [asOf, setAsOf] = useState<string>('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/diag', { cache: 'no-store' });
      const json = (await res.json()) as {
        rows: Row[];
        keys: Record<string, boolean>;
        labels: Record<string, string>;
        geminiModel: string | null;
        asOf: string;
      };
      setRows(json.rows || []);
      setKeys(json.keys || {});
      setLabels(json.labels || {});
      setModel(json.geminiModel);
      setAsOf(json.asOf);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="diag-panel glass-card" aria-label="API diagnostics">
      <header className="diag-head">
        <div>
          <p className="eyebrow">
            <Radio size={14} aria-hidden /> API diagnostics
          </p>
          <h2>Live endpoint probes</h2>
          <p className="muted" style={{ margin: 0 }}>
            Exact SoSoValue / SoDEX paths this desk calls. {asOf ? `As of ${new Date(asOf).toLocaleTimeString()}.` : ''}
          </p>
        </div>
        <button type="button" className="btn btn-ghost" onClick={() => void load()} disabled={busy}>
          {busy ? 'Probing…' : 'Re-probe'}
        </button>
      </header>
      <div className="diag-keys">
        <span className={`mode-pill ${keys.sosovalue ? 'live' : 'sim'}`}>SoSoValue {keys.sosovalue ? 'key' : 'fallback'}</span>
        <span className={`mode-pill ${keys.gemini ? 'live' : 'sim'}`}>Gemini {keys.gemini ? model || 'on' : 'off'}</span>
        <span className={`mode-pill ${keys.sodexTrade ? 'live' : 'sim'}`}>
          Orders {labels.orders || (keys.sodexTrade ? 'TESTNET' : 'DRY-RUN')}
        </span>
      </div>
      <div className="diag-table-wrap">
        <table className="diag-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Status</th>
              <th>Latency</th>
              <th>URL</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name + r.url} className={r.ok ? 'ok' : 'bad'}>
                <td>
                  <strong>{r.name}</strong>
                  {r.note ? <div className="muted">{r.note}</div> : null}
                </td>
                <td className="tabular">{String(r.status)}</td>
                <td className="tabular">{r.ms}ms</td>
                <td className="diag-url">{r.url.replace('https://', '')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
