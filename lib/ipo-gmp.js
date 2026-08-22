// lib/ipo-gmp.js
// Fetches live mainboard IPO + GMP data from investorgain's JSON data endpoint
// (the public investorgain.com page renders this via client-side JS/AJAX, so we
// hit the underlying API directly rather than scraping HTML).

const GMP_DATA_URL = 'https://webnodejs.investorgain.com/cloud/v2/index/gmp-data';
const SOURCE_URL = 'https://www.investorgain.com/report/live-ipo-gmp/331/ipo/';

// ipo_status codes used by investorgain:
//   U  = upcoming (not yet open)
//   O  = open
//   CT = closing today (last day to apply)
//   C  = closed (subscription over, awaiting allotment/listing)
//   LT = listed
const STATUS_LABELS = {
  U: 'Upcoming',
  O: 'Open',
  CT: 'Closing Today',
  C: 'Closed',
  LT: 'Listed',
};

function decodeEntities(str) {
  if (!str) return str;
  return String(str)
    .replace(/&#8377;/g, '₹')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ');
}

function toNumber(val) {
  const n = parseFloat(val);
  return Number.isFinite(n) ? n : 0;
}

function mapIpo(raw) {
  return {
    name: raw.company_short_name || '',
    slug: (raw.href || '').replace(/^\/ipo\//, '').replace(/\/$/, ''),
    detailUrl: raw.href ? `https://www.investorgain.com${raw.href}` : '',
    logoUrl: raw.logo_url ? `https://www.investorgain.com/images/ipo/${raw.logo_url}` : '',
    priceBand: decodeEntities(raw.price_band) || '',
    ipoPrice: toNumber(raw.ipo_price),
    gmp: toNumber(raw.gmp),
    gmpPercent: toNumber(raw.gmp_perc),
    gmpRating: raw.gmp_rating || 0,
    subscription: raw.subscription || '',
    status: raw.ipo_status || '',
    statusLabel: STATUS_LABELS[raw.ipo_status] || raw.ipo_status || '',
    category: raw.ipo_category || '', // "IPO" = mainboard, "SME" = SME
    openDate: raw.open_date || '',
    closeDate: raw.close_date || '',
    allotmentDate: raw.allotment_dt || '',
    listingDate: raw.listing_date || '',
    ipoSize: decodeEntities(raw.ipo_size) || '',
    listingAt: raw.ipo_listing_at || '',
    sector: raw.company_sector || '',
  };
}

export async function fetchMainboardIpos() {
  const r = await fetch(GMP_DATA_URL, {
    headers: {
      'Referer': 'https://www.investorgain.com/',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
      'Accept': 'application/json',
    },
  });

  if (!r.ok) {
    throw new Error(`investorgain gmp-data request failed: ${r.status}`);
  }

  const data = await r.json();
  const list = Array.isArray(data?.gmpList) ? data.gmpList : [];

  const ipos = list
    .filter((item) => item.ipo_category === 'IPO') // mainboard only, excludes SME
    .map(mapIpo)
    .sort((a, b) => (b.openDate || '').localeCompare(a.openDate || ''));

  return { ipos, sourceUrl: SOURCE_URL };
}

// Returns [{ ipo, event }] for mainboard IPOs opening today or on their last
// closing day, given a list already filtered to mainboard (from fetchMainboardIpos)
// and today's date as 'YYYY-MM-DD' (IST). One event per IPO: if an IPO opens and
// closes on the same day, it's reported as 'opening' only, to avoid double-sending.
export function getIpoAlertEvents(ipos, todayKey) {
  const events = [];
  for (const ipo of ipos) {
    if (ipo.openDate === todayKey) {
      events.push({ ipo, event: 'opening' });
    } else if (ipo.closeDate === todayKey) {
      events.push({ ipo, event: 'closing' });
    }
  }
  return events;
}