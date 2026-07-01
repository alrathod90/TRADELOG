import { describe, expect, it } from 'vitest';
import { resolveSupabaseConfig } from './supabase.js';

describe('resolveSupabaseConfig', () => {
  it('accepts valid Supabase URLs and keys', () => {
    const result = resolveSupabaseConfig('https://demo.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');

    expect(result).toEqual({
      isConfigured: true,
      normalizedUrl: 'https://demo.supabase.co',
      anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
      reason: null,
    });
  });

  it('rejects invalid or incomplete values', () => {
    expect(resolveSupabaseConfig('', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9')).toMatchObject({ isConfigured: false });
    expect(resolveSupabaseConfig('http://demo.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9')).toMatchObject({ isConfigured: false });
    expect(resolveSupabaseConfig('https://example.com', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9')).toMatchObject({ isConfigured: false });
  });
});
