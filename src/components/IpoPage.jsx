import { useEffect, useState } from 'react';

const STATUS_STYLES = {
  U:  { label: 'Upcoming',      bg: '#fef3c7', fg: '#92400e' },
  O:  { label: 'Open',          bg: '#d1fae5', fg: '#065f46' },
  CT: { label: 'Closing Today', bg: '#fee2e2', fg: '#991b1b' },
  C:  { label: 'Closed',        bg: '#e5e7eb', fg: '#374151' },
  LT: { label: 'Listed',        bg: '#dbeafe', fg: '#1e40af' },
};

function StatusBadge({ status }) {
  const s = STATUS_STYLES[status] || { label: status || '—', bg: '#e5e7eb', fg: '#374151' };
  return (
    <span style={{
      display: 'inline-block', padding: '2px 10px', borderRadius: 999,
      fontSize: 12, fontWeight: 600, background: s.bg, color: s.fg, whiteSpace: 'nowrap',
    }}>
      {s.label}
    </span>
  );
}

function formatDate(d) {
  if (!d) return '—';
  try {
    return new Date(`${d}T00:00:00`).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  } catch {
    return d;
  }
}

function GmpCell({ ipo }) {
  const gmp = Number(ipo.gmp) || 0;
  const pct = Number(ipo.gmpPercent) || 0;
  const positive = gmp > 0;
  const negative = gmp < 0;
  const color = positive ? '#16a34a' : negative ? '#dc2626' : '#6b7280';
  return (
    <div>
      <div style={{ fontWeight: 700, color }}>
        {positive ? '+' : ''}₹{gmp}
      </div>
      <div style={{ fontSize: 12, color }}>
        {positive ? '▲' : negative ? '▼' : ''} {pct}%
      </div>
    </div>
  );
}

export function IPOPage({ username, userId }) {
  const [ipos, setIpos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatedAt, setUpdatedAt] = useState(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const base = (typeof window !== 'undefined' &&
        (window.location.protocol === 'capacitor:' || window.location.protocol === 'file:'))
        ? (import.meta.env?.VITE_API_BASE || '').replace(/\/$/, '')
        : '';
      const r = await fetch(`${base}/api/ipos`);
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || 'Failed to load IPO data');
      setIpos(Array.isArray(data.ipos) ? data.ipos : []);
      setUpdatedAt(data.updatedAt || null);
    } catch (e) {
      setError(e.message || 'Could not load IPO data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <div style={{ padding: 16, maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0 }}>📋 Mainboard IPOs</h2>
          <div style={{ fontSize: 13, color: '#6b7280' }}>
            Live GMP · Grey Market Premium is unofficial and indicative only
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {updatedAt && (
            <span style={{ fontSize: 12, color: '#9ca3af' }}>
              Updated {new Date(updatedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            onClick={load}
            disabled={loading}
            style={{
              padding: '6px 14px', borderRadius: 8, border: '1px solid #d1d5db',
              background: '#fff', cursor: loading ? 'default' : 'pointer', fontSize: 13,
            }}
          >
            {loading ? 'Refreshing…' : '↻ Refresh'}
          </button>
        </div>
      </div>

      {loading && ipos.length === 0 && (
        <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>Loading IPO data…</div>
      )}

      {error && (
        <div style={{ padding: 16, background: '#fee2e2', color: '#991b1b', borderRadius: 8, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {!loading && !error && ipos.length === 0 && (
        <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>
          No mainboard IPO data found right now.
        </div>
      )}

      {ipos.length > 0 && (
        <>
          {/* Desktop table */}
          <div style={{ display: 'none' }} className="ipo-table-wrap">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '2px solid #e5e7eb', fontSize: 13, color: '#6b7280' }}>
                  <th style={{ padding: '8px 10px' }}>Company</th>
                  <th style={{ padding: '8px 10px' }}>Status</th>
                  <th style={{ padding: '8px 10px' }}>Price Band</th>
                  <th style={{ padding: '8px 10px' }}>GMP</th>
                  <th style={{ padding: '8px 10px' }}>Open</th>
                  <th style={{ padding: '8px 10px' }}>Close</th>
                  <th style={{ padding: '8px 10px' }}>Listing</th>
                  <th style={{ padding: '8px 10px' }}>Issue Size</th>
                </tr>
              </thead>
              <tbody>
                {ipos.map((ipo) => (
                  <tr key={ipo.slug || ipo.name} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '10px' }}>
                      <div style={{ fontWeight: 600 }}>{ipo.name}</div>
                      <div style={{ fontSize: 12, color: '#9ca3af' }}>{ipo.sector}</div>
                    </td>
                    <td style={{ padding: '10px' }}><StatusBadge status={ipo.status} /></td>
                    <td style={{ padding: '10px' }}>{ipo.priceBand ? `₹${ipo.priceBand}` : '—'}</td>
                    <td style={{ padding: '10px' }}><GmpCell ipo={ipo} /></td>
                    <td style={{ padding: '10px' }}>{formatDate(ipo.openDate)}</td>
                    <td style={{ padding: '10px' }}>{formatDate(ipo.closeDate)}</td>
                    <td style={{ padding: '10px' }}>{formatDate(ipo.listingDate)}</td>
                    <td style={{ padding: '10px' }}>{ipo.ipoSize || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Card list — works on all screen sizes */}
          <div style={{ display: 'grid', gap: 10 }}>
            {ipos.map((ipo) => (
              <div
                key={ipo.slug || ipo.name}
                style={{
                  border: '1px solid #e5e7eb', borderRadius: 12, padding: 14,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                  gap: 12, flexWrap: 'wrap', background: '#fff',
                }}
              >
                <div style={{ minWidth: 200, flex: '1 1 auto' }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{ipo.name}</div>
                  <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 6 }}>{ipo.sector}</div>
                  <StatusBadge status={ipo.status} />
                  <div style={{ fontSize: 13, marginTop: 8, color: '#374151' }}>
                    <div>Price Band: <b>{ipo.priceBand ? `₹${ipo.priceBand}` : '—'}</b></div>
                    <div>Issue Size: {ipo.ipoSize || '—'} · {ipo.listingAt || '—'}</div>
                    {ipo.subscription && <div>Subscription: {ipo.subscription}</div>}
                  </div>
                </div>

                <div style={{ textAlign: 'right', minWidth: 110 }}>
                  <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 2 }}>GMP</div>
                  <GmpCell ipo={ipo} />
                </div>

                <div style={{ fontSize: 13, color: '#374151', minWidth: 150 }}>
                  <div>Open: <b>{formatDate(ipo.openDate)}</b></div>
                  <div>Close: <b>{formatDate(ipo.closeDate)}</b></div>
                  <div>Listing: {formatDate(ipo.listingDate)}</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
