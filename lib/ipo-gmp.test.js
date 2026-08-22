import { describe, expect, it } from 'vitest';
import { getIpoAlertEvents, parseMainboardIpos } from './ipo-gmp.js';

const validTable = `
  <table><thead><tr>
    <th>Name▲▼</th><th>GMP▲▼</th><th>Price (₹)</th><th>Open</th><th>Close</th>
  </tr></thead><tbody>
    <tr><td>Acme Industries IPO</td><td>₹42 (10.00%)</td><td>₹420</td><td>21-Aug</td><td>25-Aug</td></tr>
    <tr><td>Small Works SME IPO</td><td>₹10</td><td>₹100</td><td>21-Aug</td><td>25-Aug</td></tr>
  </tbody></table>`;

describe('mainboard IPO parser', () => {
  it('finds the IPO table, retains GMP and excludes SME listings', () => {
    const html = `<table><tr><th>Ignore</th></tr></table>${validTable}`;
    expect(parseMainboardIpos(html, new Date('2026-08-21T00:00:00Z'))).toEqual([
      {
        name: 'Acme Industries IPO',
        gmp: '₹42 (10.00%)',
        openDate: '2026-08-21',
        closeDate: '2026-08-25',
        rawOpenDate: '21-Aug',
        rawCloseDate: '25-Aug',
      },
    ]);
  });

  it('uses the nearest year when the source omits it at the year boundary', () => {
    const html = validTable.replaceAll('21-Aug', '02-Jan').replaceAll('25-Aug', '06-Jan');
    const [ipo] = parseMainboardIpos(html, new Date('2026-12-28T00:00:00Z'));
    expect(ipo.openDate).toBe('2027-01-02');
    expect(ipo.closeDate).toBe('2027-01-06');
  });

  it('returns an empty list for a source response without a compatible table', () => {
    expect(parseMainboardIpos('<p>No data available</p>')).toEqual([]);
  });
});

describe('IPO alert event selection', () => {
  it('selects only today’s opening and closing events', () => {
    const events = getIpoAlertEvents([
      { name: 'Opening IPO', openDate: '2026-08-21', closeDate: '2026-08-25' },
      { name: 'Closing IPO', openDate: '2026-08-18', closeDate: '2026-08-21' },
      { name: 'Later IPO', openDate: '2026-08-22', closeDate: '2026-08-26' },
    ], '2026-08-21');
    expect(events.map(({ ipo, event }) => `${ipo.name}:${event}`)).toEqual([
      'Opening IPO:opening',
      'Closing IPO:closing',
    ]);
  });
});
