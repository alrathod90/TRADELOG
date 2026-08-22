/**
 * Announcements Page - Tijori-style timeline with filtering and smart summaries
 * Phase 3: Enhanced UI with timeline view, filtering, smart summaries
 */

import React, { useEffect, useState } from 'react';
import { sbFetchAnnouncements, sbFetchAnnouncementsBySymbol, sbFetchAnnouncementsByCategory, sbFetchAnnouncementsByImpact } from '../supabase.js';

const CATEGORIES = [
  'earnings', 'corporate_action', 'regulatory', 'management', 'expansion', 'acquisition', 'market'
];

const IMPACT_LEVELS = ['HIGH', 'MEDIUM', 'LOW'];

const SENTIMENTS = ['POSITIVE', 'NEGATIVE', 'NEUTRAL'];

const CATEGORY_EMOJIS = {
  earnings: '💰',
  corporate_action: '🏦',
  regulatory: '⚖️',
  management: '👔',
  expansion: '🚀',
  acquisition: '🤝',
  market: '📈',
  unknown: 'ℹ️',
};

const SENTIMENT_EMOJIS = {
  POSITIVE: '📈',
  NEGATIVE: '📉',
  NEUTRAL: '➡️',
};

const IMPACT_EMOJIS = {
  HIGH: '🚀',
  MEDIUM: '⚠️',
  LOW: 'ℹ️',
};

export function AnnouncementsPage({ username, userId }) {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState(null);
  
  // Filters
  const [filterSymbol, setFilterSymbol] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterImpact, setFilterImpact] = useState('');
  const [filterSentiment, setFilterSentiment] = useState('');
  const [searchText, setSearchText] = useState('');

  // Load announcements
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const data = await sbFetchAnnouncements(userId || username);
        setAnnouncements(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error('Failed to load announcements:', e);
        setAnnouncements([]);
      } finally {
        setLoading(false);
      }
    }
    if (userId || username) load();
  }, [userId, username]);

  // Apply filters
  const filteredAnnouncements = announcements.filter(a => {
    if (filterSymbol && a.symbol !== filterSymbol) return false;
    if (filterCategory && a.category !== filterCategory) return false;
    if (filterImpact && a.impact_level !== filterImpact) return false;
    if (filterSentiment && a.sentiment !== filterSentiment) return false;
    if (searchText) {
      const search = searchText.toLowerCase();
      const fullText = `${a.symbol} ${a.description} ${a.smart_summary}`.toLowerCase();
      if (!fullText.includes(search)) return false;
    }
    return true;
  });

  // Get unique symbols for filter
  const uniqueSymbols = [...new Set(announcements.map(a => a.symbol))];

  // Statistics
  const stats = {
    total: announcements.length,
    high: announcements.filter(a => a.impact_level === 'HIGH').length,
    positive: announcements.filter(a => a.sentiment === 'POSITIVE').length,
    negative: announcements.filter(a => a.sentiment === 'NEGATIVE').length,
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>📰 Financial News & Announcements</h1>
        <div style={styles.statsRow}>
          <div style={styles.stat}>
            <div style={styles.statLabel}>Total</div>
            <div style={styles.statValue}>{stats.total}</div>
          </div>
          <div style={styles.stat}>
            <div style={styles.statLabel}>🚀 High Impact</div>
            <div style={styles.statValue}>{stats.high}</div>
          </div>
          <div style={styles.stat}>
            <div style={styles.statLabel}>📈 Positive</div>
            <div style={styles.statValue}>{stats.positive}</div>
          </div>
          <div style={styles.stat}>
            <div style={styles.statLabel}>📉 Negative</div>
            <div style={styles.statValue}>{stats.negative}</div>
          </div>
        </div>
      </div>

      {/* Search & Filters */}
      <div style={styles.filterPanel}>
        <input
          type="text"
          placeholder="Search announcements..."
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
          style={styles.searchInput}
        />
        
        <select
          value={filterSymbol}
          onChange={e => setFilterSymbol(e.target.value)}
          style={styles.filterSelect}
        >
          <option value="">All Symbols</option>
          {uniqueSymbols.map(sym => (
            <option key={sym} value={sym}>{sym}</option>
          ))}
        </select>

        <select
          value={filterCategory}
          onChange={e => setFilterCategory(e.target.value)}
          style={styles.filterSelect}
        >
          <option value="">All Categories</option>
          {CATEGORIES.map(cat => (
            <option key={cat} value={cat}>
              {CATEGORY_EMOJIS[cat]} {cat.toUpperCase().replace('_', ' ')}
            </option>
          ))}
        </select>

        <select
          value={filterImpact}
          onChange={e => setFilterImpact(e.target.value)}
          style={styles.filterSelect}
        >
          <option value="">All Impact Levels</option>
          {IMPACT_LEVELS.map(level => (
            <option key={level} value={level}>
              {IMPACT_EMOJIS[level]} {level}
            </option>
          ))}
        </select>

        <select
          value={filterSentiment}
          onChange={e => setFilterSentiment(e.target.value)}
          style={styles.filterSelect}
        >
          <option value="">All Sentiments</option>
          {SENTIMENTS.map(sent => (
            <option key={sent} value={sent}>
              {SENTIMENT_EMOJIS[sent]} {sent}
            </option>
          ))}
        </select>

        {(filterSymbol || filterCategory || filterImpact || filterSentiment || searchText) && (
          <button
            onClick={() => {
              setFilterSymbol('');
              setFilterCategory('');
              setFilterImpact('');
              setFilterSentiment('');
              setSearchText('');
            }}
            style={styles.clearButton}
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Timeline */}
      <div style={styles.timeline}>
        {loading ? (
          <div style={styles.emptyState}>Loading announcements...</div>
        ) : filteredAnnouncements.length === 0 ? (
          <div style={styles.emptyState}>
            No announcements found {searchText ? 'matching your search' : ''}
          </div>
        ) : (
          filteredAnnouncements.map(ann => (
            <AnnouncementCard
              key={ann.id}
              announcement={ann}
              onClick={() => setSelectedAnnouncement(ann)}
              isSelected={selectedAnnouncement?.id === ann.id}
            />
          ))
        )}
      </div>

      {/* Detail Panel */}
      {selectedAnnouncement && (
        <AnnouncementDetailPanel
          announcement={selectedAnnouncement}
          onClose={() => setSelectedAnnouncement(null)}
        />
      )}
    </div>
  );
}

function AnnouncementCard({ announcement, onClick, isSelected }) {
  const date = announcement.announcement_date
    ? new Date(announcement.announcement_date).toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: 'short',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

  return (
    <div
      onClick={onClick}
      style={{
        ...styles.announcementCard,
        borderLeftColor: announcement.impact_level === 'HIGH' ? '#ef4444' : announcement.impact_level === 'MEDIUM' ? '#f59e0b' : '#10b981',
        backgroundColor: isSelected ? 'var(--bg2)' : 'var(--bg1)',
      }}
    >
      <div style={styles.cardHeader}>
        <div style={styles.symbolBadge}>
          {CATEGORY_EMOJIS[announcement.category]} {announcement.symbol}
        </div>
        <div style={styles.impactBadge}>
          {IMPACT_EMOJIS[announcement.impact_level]} {announcement.impact_level}
        </div>
      </div>

      <div style={styles.cardTitle}>
        {announcement.description || 'Announcement'}
      </div>

      {announcement.smart_summary && (
        <div style={styles.cardSummary}>
          {announcement.smart_summary}
        </div>
      )}

      <div style={styles.cardFooter}>
        <span style={styles.cardDate}>{date}</span>
        <span style={styles.cardSentiment}>
          {SENTIMENT_EMOJIS[announcement.sentiment]} {announcement.sentiment}
        </span>
      </div>
    </div>
  );
}

function AnnouncementDetailPanel({ announcement, onClose }) {
  const fullDate = announcement.announcement_date
    ? new Date(announcement.announcement_date).toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        weekday: 'short',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

  return (
    <div style={styles.detailOverlay} onClick={onClose}>
      <div style={styles.detailPanel} onClick={e => e.stopPropagation()}>
        <div style={styles.detailHeader}>
          <h2 style={styles.detailTitle}>
            {CATEGORY_EMOJIS[announcement.category]} {announcement.symbol} — {announcement.category.toUpperCase().replace('_', ' ')}
          </h2>
          <button onClick={onClose} style={styles.closeButton}>✕</button>
        </div>

        {/* Metadata */}
        <div style={styles.metadataGrid}>
          <div style={styles.metadataItem}>
            <div style={styles.metadataLabel}>Impact</div>
            <div style={styles.metadataValue}>
              {IMPACT_EMOJIS[announcement.impact_level]} {announcement.impact_level}
            </div>
          </div>
          <div style={styles.metadataItem}>
            <div style={styles.metadataLabel}>Sentiment</div>
            <div style={styles.metadataValue}>
              {SENTIMENT_EMOJIS[announcement.sentiment]} {announcement.sentiment}
            </div>
          </div>
          <div style={styles.metadataItem}>
            <div style={styles.metadataLabel}>Date</div>
            <div style={styles.metadataValue}>{fullDate}</div>
          </div>
          <div style={styles.metadataItem}>
            <div style={styles.metadataLabel}>Impact Score</div>
            <div style={styles.metadataValue}>{announcement.impact_score}/10</div>
          </div>
        </div>

        {/* Description */}
        {announcement.description && (
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>📌 Original Description</h3>
            <p style={styles.sectionContent}>{announcement.description}</p>
          </div>
        )}

        {/* Smart Summary */}
        {announcement.smart_summary && (
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>🧾 AI Summary</h3>
            <p style={styles.sectionContent}>{announcement.smart_summary}</p>
          </div>
        )}

        {/* Extracted Text */}
        {announcement.extracted_text && (
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>📄 Full Filing Text</h3>
            <div style={styles.expandableText}>
              {announcement.extracted_text.slice(0, 500)}
              {announcement.extracted_text.length > 500 && '…'}
            </div>
          </div>
        )}

        {/* Links */}
        {(announcement.pdf_url || announcement.nse_url) && (
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>🔗 References</h3>
            <div style={styles.linkList}>
              {announcement.pdf_url && (
                <a href={announcement.pdf_url} target="_blank" rel="noopener noreferrer" style={styles.link}>
                  📄 PDF Filing
                </a>
              )}
              {announcement.nse_url && (
                <a href={announcement.nse_url} target="_blank" rel="noopener noreferrer" style={styles.link}>
                  🌐 NSE Link
                </a>
              )}
            </div>
          </div>
        )}

        {/* Processing Info */}
        {announcement.processed_at && (
          <div style={styles.processingInfo}>
            Processed at: {new Date(announcement.processed_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    padding: '1.5rem',
    background: 'var(--bg1)',
    minHeight: '100vh',
  },
  header: {
    marginBottom: '0.5rem',
  },
  title: {
    fontSize: '1.75rem',
    fontWeight: 'bold',
    color: 'var(--txt1)',
    margin: '0 0 1rem 0',
  },
  statsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
    gap: '1rem',
  },
  stat: {
    padding: '1rem',
    background: 'var(--bg2)',
    border: '1px solid var(--border)',
    borderRadius: '0.5rem',
    textAlign: 'center',
  },
  statLabel: {
    fontSize: '0.75rem',
    color: 'var(--txt3)',
    fontWeight: '500',
    marginBottom: '0.25rem',
  },
  statValue: {
    fontSize: '1.5rem',
    fontWeight: 'bold',
    color: 'var(--accent)',
  },
  filterPanel: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: '0.75rem',
    padding: '1rem',
    background: 'var(--bg2)',
    borderRadius: '0.5rem',
    border: '1px solid var(--border)',
  },
  searchInput: {
    gridColumn: '1 / -1',
    padding: '0.75rem',
    background: 'var(--bg1)',
    border: '1px solid var(--border)',
    borderRadius: '0.375rem',
    color: 'var(--txt1)',
    fontSize: '0.875rem',
  },
  filterSelect: {
    padding: '0.75rem',
    background: 'var(--bg1)',
    border: '1px solid var(--border)',
    borderRadius: '0.375rem',
    color: 'var(--txt1)',
    fontSize: '0.875rem',
  },
  clearButton: {
    padding: '0.75rem 1rem',
    background: 'var(--red)',
    color: 'white',
    border: 'none',
    borderRadius: '0.375rem',
    cursor: 'pointer',
    fontSize: '0.875rem',
    fontWeight: '500',
  },
  timeline: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  emptyState: {
    padding: '3rem 1rem',
    textAlign: 'center',
    color: 'var(--txt3)',
    fontSize: '1rem',
  },
  announcementCard: {
    padding: '1rem',
    background: 'var(--bg1)',
    border: '1px solid var(--border)',
    borderLeft: '4px solid',
    borderRadius: '0.5rem',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0.75rem',
  },
  symbolBadge: {
    padding: '0.35rem 0.75rem',
    background: 'var(--bg2)',
    border: '1px solid var(--border)',
    borderRadius: '0.375rem',
    fontSize: '0.85rem',
    fontWeight: 'bold',
    color: 'var(--txt1)',
  },
  impactBadge: {
    padding: '0.35rem 0.75rem',
    background: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid #ef4444',
    borderRadius: '0.375rem',
    fontSize: '0.85rem',
    fontWeight: 'bold',
    color: '#ef4444',
  },
  cardTitle: {
    fontSize: '0.95rem',
    fontWeight: 'bold',
    color: 'var(--txt1)',
    marginBottom: '0.5rem',
  },
  cardSummary: {
    fontSize: '0.85rem',
    color: 'var(--txt2)',
    marginBottom: '0.75rem',
    lineHeight: '1.4',
  },
  cardFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '0.8rem',
    color: 'var(--txt3)',
  },
  cardDate: {
    color: 'var(--txt3)',
  },
  cardSentiment: {
    fontWeight: '500',
    color: 'var(--accent)',
  },
  detailOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    justifyContent: 'flex-end',
    zIndex: 1000,
  },
  detailPanel: {
    width: '100%',
    maxWidth: '600px',
    height: '100%',
    background: 'var(--bg1)',
    overflowY: 'auto',
    padding: '1.5rem',
    boxShadow: '-2px 0 8px rgba(0, 0, 0, 0.2)',
  },
  detailHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '1.5rem',
    paddingBottom: '1rem',
    borderBottom: '1px solid var(--border)',
  },
  detailTitle: {
    fontSize: '1.3rem',
    fontWeight: 'bold',
    color: 'var(--txt1)',
    margin: 0,
  },
  closeButton: {
    background: 'none',
    border: 'none',
    fontSize: '1.5rem',
    cursor: 'pointer',
    color: 'var(--txt3)',
    padding: '0',
  },
  metadataGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '1rem',
    marginBottom: '1.5rem',
    padding: '1rem',
    background: 'var(--bg2)',
    borderRadius: '0.5rem',
  },
  metadataItem: {
    display: 'flex',
    flexDirection: 'column',
  },
  metadataLabel: {
    fontSize: '0.75rem',
    color: 'var(--txt3)',
    fontWeight: '500',
    marginBottom: '0.25rem',
  },
  metadataValue: {
    fontSize: '0.95rem',
    fontWeight: 'bold',
    color: 'var(--txt1)',
  },
  section: {
    marginBottom: '1.5rem',
  },
  sectionTitle: {
    fontSize: '0.95rem',
    fontWeight: 'bold',
    color: 'var(--txt1)',
    marginBottom: '0.5rem',
  },
  sectionContent: {
    fontSize: '0.9rem',
    color: 'var(--txt2)',
    lineHeight: '1.6',
    margin: 0,
  },
  expandableText: {
    fontSize: '0.85rem',
    color: 'var(--txt2)',
    lineHeight: '1.5',
    background: 'var(--bg2)',
    padding: '0.75rem',
    borderRadius: '0.375rem',
    maxHeight: '200px',
    overflowY: 'auto',
  },
  linkList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  link: {
    color: 'var(--accent)',
    textDecoration: 'none',
    fontSize: '0.9rem',
    fontWeight: '500',
    padding: '0.5rem',
    background: 'var(--bg2)',
    borderRadius: '0.375rem',
    textAlign: 'center',
  },
  processingInfo: {
    fontSize: '0.75rem',
    color: 'var(--txt3)',
    padding: '0.75rem',
    background: 'var(--bg2)',
    borderRadius: '0.375rem',
    marginTop: '1rem',
  },
};

export default AnnouncementsPage;
