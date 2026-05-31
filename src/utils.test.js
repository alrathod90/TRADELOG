import { describe, it, expect } from 'vitest';
import { parseCSVLine, pnl, INR, PCT, today } from './utils.js';

describe('parseCSVLine', () => {
  it('parses simple comma-separated fields', () => {
    expect(parseCSVLine('A,B,C')).toEqual(['A','B','C']);
  });

  it('handles quoted commas inside fields', () => {
    expect(parseCSVLine('A,"B, C",D')).toEqual(['A','B, C','D']);
  });

  it('trims whitespace from fields', () => {
    expect(parseCSVLine(' A , " B " ,C ')).toEqual(['A','B','C']);
  });

  it('handles empty fields correctly', () => {
    expect(parseCSVLine('A,,C')).toEqual(['A','','C']);
  });
});

describe('pnl', () => {
  it('calculates profit for a BUY trade', () => {
    const result = pnl({entryPrice: 100, exitPrice: 120, qty: 10, brokerage: 5, dir: 'BUY'});
    expect(result).toEqual({ invest: 1000, gross: 200, net: 195, pct: 19.5 });
  });

  it('calculates profit for a SELL trade', () => {
    const result = pnl({entryPrice: 120, exitPrice: 100, qty: 10, brokerage: 5, dir: 'SELL'});
    expect(result).toEqual({ invest: 1200, gross: 200, net: 195, pct: 16.25 });
  });

  it('returns zero pct if invest is zero', () => {
    const result = pnl({entryPrice: 0, exitPrice: 0, qty: 0, brokerage: 0, dir: 'BUY'});
    expect(result).toEqual({ invest: 0, gross: 0, net: 0, pct: 0 });
  });
});

describe('INR', () => {
  it('formats positive numbers with currency symbol', () => {
    expect(INR(1234.5, 2)).toBe('₹1,234.50');
  });

  it('formats negative numbers using minus sign', () => {
    expect(INR(-1234.5, 1)).toBe('−₹1,234.5');
  });
});

describe('PCT', () => {
  it('formats positive percentages with plus sign', () => {
    expect(PCT(3.456)).toBe('+3.46%');
  });

  it('formats negative percentages with minus sign', () => {
    expect(PCT(-1.234)).toBe('-1.23%');
  });
});

describe('today', () => {
  it('returns current date in YYYY-MM-DD format', () => {
    expect(today()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
