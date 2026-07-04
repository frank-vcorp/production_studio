/**
 * Tests para tokenCounter.
 * Spec: SPEC-S4-GRANULAR-EDIT §4.2 — 5 tests mínimos.
 */

import { describe, it, expect } from 'vitest';
import { countTokens, tokenStatus, TOKEN_LIMIT, TOKEN_WARNING } from '@/utils/tokenCounter';

describe('tokenCounter', () => {
  it('countTokens("Hola mundo") → 3 (11 chars / 4 ≈ 2.75 → ceil 3)', () => {
    expect(countTokens('Hola mundo')).toBe(3);
  });

  it('countTokens de string 2000 chars → 500 tokens', () => {
    const text = 'a'.repeat(2000);
    expect(countTokens(text)).toBe(500);
  });

  it('countTokens("") → 0', () => {
    expect(countTokens('')).toBe(0);
  });

  it('tokenStatus(TOKEN_LIMIT) → danger / red', () => {
    const status = tokenStatus(TOKEN_LIMIT);
    expect(status.level).toBe('danger');
    expect(status.color).toBe('red');
    expect(status.message).toBe('Excede límite');
  });

  it('tokenStatus(TOKEN_WARNING) → warning / amber', () => {
    const status = tokenStatus(TOKEN_WARNING);
    expect(status.level).toBe('warning');
    expect(status.color).toBe('amber');
    expect(status.message).toBe('Cerca del límite');
  });

  it('tokenStatus(500) → safe / emerald', () => {
    const status = tokenStatus(500);
    expect(status.level).toBe('safe');
    expect(status.color).toBe('emerald');
    expect(status.message).toBe('OK');
  });

  it('TOKEN_LIMIT=2048 y TOKEN_WARNING=1800 (constantes exportadas)', () => {
    expect(TOKEN_LIMIT).toBe(2048);
    expect(TOKEN_WARNING).toBe(1800);
  });

  it('tokenStatus entre warning y limit sigue siendo warning', () => {
    const status = tokenStatus(2000);
    expect(status.level).toBe('warning');
  });
});