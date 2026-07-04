/**
 * Helpers de formato: bytes, duración, USD.
 * Spec: SPEC-S6-TESTS-CICD §6.1.
 *
 * ID: IMPL-20260704-06.
 */
import { describe, it, expect } from 'vitest';
import { formatBytes, formatDuration, formatUSD } from '@/utils/format';

describe('formatBytes', () => {
  it('casos básicos', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(500)).toBe('500 B');
    expect(formatBytes(1024)).toBe('1.00 KB');
    expect(formatBytes(1024 * 1024)).toBe('1.00 MB');
    expect(formatBytes(1024 * 1024 * 1024)).toBe('1.00 GB');
  });

  it('ajusta decimales según tamaño', () => {
    expect(formatBytes(15 * 1024)).toMatch(/KB$/);
    expect(formatBytes(150 * 1024)).toMatch(/KB$/);
    expect(formatBytes(1500 * 1024)).toMatch(/MB$/);
  });

  it('edge cases negativos/no finitos', () => {
    expect(formatBytes(-1)).toBe('0 B');
    expect(formatBytes(Number.NaN)).toBe('0 B');
    expect(formatBytes(Number.POSITIVE_INFINITY)).toBe('0 B');
  });
});

describe('formatDuration', () => {
  it('mm:ss básico', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(5)).toBe('0:05');
    expect(formatDuration(65)).toBe('1:05');
    expect(formatDuration(125)).toBe('2:05');
  });

  it('edge cases', () => {
    expect(formatDuration(Number.NaN)).toBe('0:00');
    expect(formatDuration(-5)).toBe('0:00');
  });

  it('no negativos ni overflow', () => {
    expect(formatDuration(3599)).toBe('59:59');
    expect(formatDuration(3600)).toBe('60:00');
  });
});

describe('formatUSD', () => {
  it('formato USD con máximo 3 decimales', () => {
    expect(formatUSD(0)).toContain('$');
    expect(formatUSD(1.5)).toContain('$');
    expect(formatUSD(100)).toContain('$');
  });
});
