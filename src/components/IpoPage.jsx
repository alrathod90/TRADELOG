import { useCallback, useEffect, useState } from 'react';

const API_BASE = typeof window !== 'undefined' &&
  (window.location.protocol === 'capacitor:' || window.location.protocol === 'file:')
  ? (import.meta.env?.VITE_API_BASE || '').replace(/\/$/, '')
  : '';
const DEFAULT_SOURCE_URL = 'https://www.investorgain.com/report/live-ipo-gmp/331/ipo/';

function displayDate(iso, fallback) {
  if (!iso) return fallback || '—';
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    .format(new Date(`${iso}T00:00:00+05:30`));
}

export function IpoPage() {
  const [ipos, setIpos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatedAt, setUpdatedAt] = useState('');
  const [sourceUrl, setSourceUrl] = useState(DEFAULT_SOURCE_URL);

  const loadIpos = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE}/api/ipos`, { signal: AbortSignal.timeout(15000) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not load IPO data');
      setIpos(Array.isArray(data.ipos) ? data.ipos : []);
      setUpdatedAt(data.updatedAt || '');
      setSourceUrl(data.sourceUrl || DEFAULT_SOURCE_URL);
    } catch (loadError) {
      setError(loadError.message || 'Could not load IPO data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(loadIpos, 0);
    return () => clearTimeout(timer);
  }, [loadIpos]);

  return (
    <div style={{ maxWidth: 1180, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
        <div>
          <div style={{ fontFamily: "'Syne'", fontSize: 28, fontWeight: 800, color: 'var(--txt1)' }}>Mainboard IPOs</div>
          <div style={{ color: 'var(--txt3)', fontSize: 13, marginTop: 6 }}>Live GMP, opening and closing dates for mainboard public issues.</div>
        </div>
        <button onClick={loadIpos} disabled={loading} style={{ padding: '9px 14px', borderRadius: 9, border: '1px solid var(--border2)', background: 'var(--bg2)', color: 'var(--txt2)', cursor: loading ? 'wait' : 'pointer', fontSize: 12 }}>
          {loading ? '⟳ Refreshing…' : '⟳ Refresh'}
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
        <span style={{ padding: '5px 10px', borderRadius: 20, background: 'rgba(0,229,160,.09)', color: 'var(--accent)', fontFamily: "'DM Mono'", fontSize: 10, border: '1px solid rgba(0,229,160,.2)' }}>MAINBOARD ONLY</span>
        <span style={{ padding: '5px 10px', borderRadius: 20, background: 'var(--bg4)', color: 'var(--txt3)', fontFamily: "'DM Mono'", fontSize: 10 }}>{ipos.length} IPO{ipos.length === 1 ? '' : 's'}</span>
        {updatedAt && <span style={{ padding: '5px 2px', color: 'var(--txt4)', fontFamily: "'DM Mono'", fontSize: 10 }}>Updated {new Date(updatedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} IST</span>}
      </div>

      {error && <div className="card" style={{ padding: 18, color: 'var(--red)', fontSize: 13 }}>{error}</div>}
      {!error && loading && <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--txt3)', fontFamily: "'DM Mono'", fontSize: 12 }}>Loading the latest mainboard IPOs…</div>}
      {!error && !loading && !ipos.length && <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--txt3)', fontSize: 13 }}>No current mainboard IPOs are reported right now.</div>}
      {!error && !loading && ipos.length > 0 && (
        <div className="card table-scroll">
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 620 }}>
            <thead><tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['IPO', 'Latest GMP', 'Opening date', 'Closing date'].map(label => <th key={label} style={{ textAlign: 'left', padding: '13px 16px', color: 'var(--txt4)', fontFamily: "'DM Mono'", fontSize: 10, letterSpacing: '.06em', fontWeight: 500 }}>{label.toUpperCase()}</th>)}
            </tr></thead>
            <tbody>{ipos.map(ipo => <tr key={`${ipo.name}-${ipo.rawOpenDate}`} style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={{ padding: '16px', color: 'var(--txt1)', fontWeight: 600, fontSize: 13 }}>{ipo.name}</td>
              <td style={{ padding: '16px', color: 'var(--accent)', fontFamily: "'DM Mono'", fontWeight: 700, fontSize: 13 }}>{ipo.gmp}</td>
              <td style={{ padding: '16px', color: 'var(--txt2)', fontSize: 13 }}>{displayDate(ipo.openDate, ipo.rawOpenDate)}</td>
              <td style={{ padding: '16px', color: 'var(--txt2)', fontSize: 13 }}>{displayDate(ipo.closeDate, ipo.rawCloseDate)}</td>
            </tr>)}</tbody>
          </table>
        </div>
      )}
      <div style={{ marginTop: 14, color: 'var(--txt4)', fontSize: 10, lineHeight: 1.6 }}>
        GMP is unofficial and indicative only, not investment advice. Data: <a href={sourceUrl} target="_blank" rel="noreferrer">InvestorGain</a>.
      </div>
    </div>
  );
}
