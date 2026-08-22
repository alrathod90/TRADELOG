import { useEffect, useMemo, useState } from 'react';

const STATUS_META = {
  U:  { label: 'Upcoming',      accentVar: '--amber' },
  O:  { label: 'Open',          accentVar: '--accent' },
  CT: { label: 'Closing Today', accentVar: '--red' },
  C:  { label: 'Closed',        accentVar: '--txt3' },
  LT: { label: 'Listed',        accentVar: '--blue' },
};

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'U',   label: 'Upcoming' },
  { id: 'O',   label: 'Open' },
  { id: 'CT',  label: 'Closing Today' },
  { id: 'C',   label: 'Closed' },
];

function StatusBadge({ status }) {
  const s = STATUS_META[status] || { label: status || '—', accentVar: '--txt3' };
  return (
    <span style={{
      display: 'inline-block', padding: '2px 10px', borderRadius: 999,
      fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
      background: `color-mix(in srgb, var(${s.accentVar}) 18%, transparent)`,
      color: `var(${s.accentVar})`,
      border: `1px solid color-mix(in srgb, var(${s.accentVar}) 40%, transparent)`,
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
  const colorVar = positive ? '--accent' : negative ? '--red' : '--txt3';
  return (
    <div>
      <div style={{ fontWeight: 700, color: `var(${colorVar})` }}>
        {positive ? '+' : ''}₹{gmp}
      </div>
      <div style={{ fontSize: 12, color: `var(${colorVar})` }}>
        {positive ? '▲' : negative ? '▼' : ''} {pct}%
      </div>
    </div>
  );
}

const cardStyle = {
  border: '1px solid var(--border)', borderRadius: 12, padding: 14,
  display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
  gap: 12, flexWrap: 'wrap', background: 'var(--bg2)',
};

export function IPOPage({ username, userId }) {
  const [ipos, setIpos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatedAt, setUpdatedAt] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [gmpSort, setGmpSort] = useState('none'); // 'none' | 'desc' | 'asc'

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

  const visibleIpos = useMemo(() => {
    let list = statusFilter === 'all' ? ipos : ipos.filter(i => i.status === statusFilter);
    if (gmpSort !== 'none') {
      list = [...list].sort((a, b) => {
        const diff = (Number(a.gmp) || 0) - (Number(b.gmp) || 0);
        return gmpSort === 'desc' ? -diff : diff;
      });
    }
    return list;
  }, [ipos, statusFilter, gmpSort]);

  const cycleGmpSort = () => {
    setGmpSort(s => s === 'none' ? 'desc' : s === 'desc' ? 'asc' : 'none');
  };

  return (
    <div style={{ padding: 16, maxWidth: 1100, margin: '0 auto', color: 'var(--txt1)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        <div>
          <h2 style={{ margin: 0, color: 'var(--txt1)' }}>📋 Mainboard IPOs</h2>
          <div style={{ fontSize: 13, color: 'var(--txt2)' }}>
            Live GMP · Grey Market Premium is unofficial and indicative only
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {updatedAt && (
            <span style={{ fontSize: 12, color: 'var(--txt3)' }}>
              Updated {new Date(updatedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            onClick={load}
            disabled={loading}
            style={{
              padding: '6px 14px', borderRadius: 8, border: '1px solid var(--border2)',
              background: 'var(--bg4)', color: 'var(--txt1)',
              cursor: loading ? 'default' : 'pointer', fontSize: 13,
            }}
          >
            {loading ? 'Refreshing…' : '↻ Refresh'}
          </button>
        </div>
      </div>

      {/* Filters + sort */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {FILTERS.map(f => {
            const active = statusFilter === f.id;
            return (
              <button
                key={f.id}
                onClick={() => setStatusFilter(f.id)}
                style={{
                  padding: '6px 12px', borderRadius: 999, fontSize: 13, cursor: 'pointer',
                  border: `1px solid ${active ? 'var(--accent)' : 'var(--border2)'}`,
                  background: active ? 'color-mix(in srgb, var(--accent) 18%, transparent)' : 'var(--bg4)',
                  color: active ? 'var(--accent)' : 'var(--txt2)',
                  fontWeight: active ? 700 : 500,
                }}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        <button
          onClick={cycleGmpSort}
          style={{
            padding: '6px 12px', borderRadius: 8, fontSize: 13, cursor: 'pointer',
            border: '1px solid var(--border2)', background: 'var(--bg4)', color: 'var(--txt1)',
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          Sort by GMP
          {gmpSort === 'desc' && ' · High → Low ▼'}
          {gmpSort === 'asc' && ' · Low → High ▲'}
          {gmpSort === 'none' && ' · Off'}
        </button>
      </div>

      {loading && ipos.length === 0 && (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--txt2)' }}>Loading IPO data…</div>
      )}

      {error && (
        <div style={{
          padding: 16, borderRadius: 8, marginBottom: 16,
          background: 'color-mix(in srgb, var(--red) 15%, transparent)',
          color: 'var(--red)', border: '1px solid color-mix(in srgb, var(--red) 40%, transparent)',
        }}>
          {error}
        </div>
      )}

      {!loading && !error && visibleIpos.length === 0 && (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--txt2)' }}>
          No mainboard IPOs match this filter right now.
        </div>
      )}

      <div style={{ display: 'grid', gap: 10 }}>
        {visibleIpos.map((ipo) => (
          <div key={ipo.slug || ipo.name} style={cardStyle}>
            <div style={{ minWidth: 200, flex: '1 1 auto' }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--txt1)' }}>{ipo.name}</div>
              <div style={{ fontSize: 12, color: 'var(--txt3)', marginBottom: 6 }}>{ipo.sector}</div>
              <StatusBadge status={ipo.status} />
              <div style={{ fontSize: 13, marginTop: 8, color: 'var(--txt2)' }}>
                <div>Price Band: <b style={{ color: 'var(--txt1)' }}>{ipo.priceBand ? `₹${ipo.priceBand}` : '—'}</b></div>
                <div>Issue Size: {ipo.ipoSize || '—'} · {ipo.listingAt || '—'}</div>
                {ipo.subscription && <div>Subscription: {ipo.subscription}</div>}
              </div>
            </div>

            <div style={{ textAlign: 'right', minWidth: 110 }}>
              <div style={{ fontSize: 11, color: 'var(--txt3)', marginBottom: 2 }}>GMP</div>
              <GmpCell ipo={ipo} />
            </div>

            <div style={{ fontSize: 13, color: 'var(--txt2)', minWidth: 150 }}>
              <div>Open: <b style={{ color: 'var(--txt1)' }}>{formatDate(ipo.openDate)}</b></div>
              <div>Close: <b style={{ color: 'var(--txt1)' }}>{formatDate(ipo.closeDate)}</b></div>
              <div>Listing: {formatDate(ipo.listingDate)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
