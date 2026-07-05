/**
 * Tests para extractErrorMessage — ARCH-20260705-03.
 * Verifica que el helper NO devuelva "[object Object]" cuando el body
 * tiene error como objeto {code, message, status}.
 */

import { describe, it, expect } from 'vitest';
import { extractErrorMessage } from '@/services/gemini/client';

describe('extractErrorMessage — ARCH-20260705-03', () => {
  it('extrae message de {error: {message, code}}', () => {
    expect(
      extractErrorMessage(
        { error: { code: 429, message: 'Cuota agotada', status: 'RESOURCE_EXHAUSTED' } },
        429,
      ),
    ).toBe('Cuota agotada');
  });

  it('extrae message de {error: "string"}', () => {
    expect(extractErrorMessage({ error: 'fail' }, 500)).toBe('fail');
  });

  it('usa code si no hay message', () => {
    expect(extractErrorMessage({ error: { code: 503 } }, 503)).toBe('HTTP 503');
  });

  it('fallback a HTTP status si no hay error', () => {
    expect(extractErrorMessage({}, 500)).toBe('Error HTTP 500');
  });

  it('NO devuelve "[object Object]" para error object', () => {
    const result = extractErrorMessage({ error: { code: 429, message: 'x' } }, 429);
    expect(result).not.toBe('[object Object]');
    expect(result).toBe('x');
  });

  it('ignora strings vacíos en error.message', () => {
    expect(
      extractErrorMessage({ error: { code: 429, message: '   ' } }, 429),
    ).toBe('HTTP 429');
  });

  it('ignora string vacío en error top-level', () => {
    expect(extractErrorMessage({ error: '' }, 400)).toBe('Error HTTP 400');
  });
});