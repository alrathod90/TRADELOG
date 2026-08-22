const MAINBOARD_GMP_URL = 'https://www.investorgain.com/report/live-ipo-gmp/331/ipo/';

function stripHtml(value = '') {
  return value
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function dateKey(value, now = new Date()) {
  const clean = String(value || '').replace(/\s+/g, ' ').trim();
  if (!clean || clean === '-' || clean === '--') return null;

  const match = clean.match(/(\d{1,2})[-\s]([A-Za-z]{3,9})(?:[-\s,]+(\d{4}))?/);
  if (!match) return null;
  const month = new Date(`${match[2]} 1, 2000`).getMonth();
  if (Number.isNaN(month)) return null;

  const year = match[3] ? Number(match[3]) : now.getUTCFullYear();
  let parsed = new Date(Date.UTC(year, month, Number(match[1])));
  // InvestorGain normally omits the year. IPOs are short-lived, so use the
  // closest occurrence of that date to today at the December/January boundary.
  if (!match[3]) {
    const diffDays = (parsed - now) / 86400000;
    if (diffDays > 183) parsed = new Date(Date.UTC(year - 1, month, Number(match[1])));
    if (diffDays < -183) parsed = new Date(Date.UTC(year + 1, month, Number(match[1])));
  }
  return parsed.toISOString().slice(0, 10);
}

export function parseMainboardIpos(html, now = new Date()) {
  const tables = html.match(/<table\b[^>]*>[\s\S]*?<\/table>/gi) || [];
  for (const table of tables) {
    const rows = table.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi) || [];
    if (rows.length < 2) continue;

    const headerCells = rows[0].match(/<th\b[^>]*>[\s\S]*?<\/th>/gi) || [];
    const headers = headerCells.map(stripHtml);
    const nameIndex = headers.findIndex(h => /^name/i.test(h));
    const gmpIndex = headers.findIndex(h => /^gmp/i.test(h));
    const openIndex = headers.findIndex(h => /^open/i.test(h));
    const closeIndex = headers.findIndex(h => /^close/i.test(h));

    if ([nameIndex, gmpIndex, openIndex, closeIndex].some(i => i < 0)) continue;

    return rows.slice(1).map(row => {
      const cells = row.match(/<td\b[^>]*>[\s\S]*?<\/td>/gi) || [];
      if (cells.length <= closeIndex) return null;
      const name = stripHtml(cells[nameIndex]);
      // This endpoint is already the mainboard report. This safety check prevents
      // a source markup change from leaking an SME row into the app or alerts.
      if (!name || /\bSME\b/i.test(name)) return null;
      return {
        name: name.replace(/\s+IPO\s*$/i, ' IPO'),
        gmp: stripHtml(cells[gmpIndex]) || '—',
        openDate: dateKey(stripHtml(cells[openIndex]), now),
        closeDate: dateKey(stripHtml(cells[closeIndex]), now),
        rawOpenDate: stripHtml(cells[openIndex]) || '—',
        rawCloseDate: stripHtml(cells[closeIndex]) || '—',
      };
    }).filter(Boolean);
  }
  return [];
}

export function getIpoAlertEvents(ipos, today) {
  return ipos.flatMap(ipo => [
    ...(ipo.openDate === today ? [{ ipo, event: 'opening' }] : []),
    ...(ipo.closeDate === today ? [{ ipo, event: 'closing' }] : []),
  ]);
}

export async function fetchMainboardIpos() {
  const response = await fetch(MAINBOARD_GMP_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; TradeLogIPO/1.0)',
      'Accept': 'text/html,application/xhtml+xml',
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`IPO source returned HTTP ${response.status}`);
  const ipos = parseMainboardIpos(await response.text());
  return { ipos, sourceUrl: MAINBOARD_GMP_URL };
}
