/**
 * Tests para syntaxHighlight.
 * Spec: SPEC-S4-GRANULAR-EDIT §4.2 — 6 tests mínimos.
 */

import { describe, it, expect } from 'vitest';
import { highlightPrompt, KEYWORDS } from '@/utils/syntaxHighlight';

describe('syntaxHighlight', () => {
  it('"dolly out" → "dolly"=movement + " out"=plain', () => {
    const { segments } = highlightPrompt('dolly out');
    expect(segments).toEqual([
      { text: 'dolly', kind: 'movement' },
      { text: ' out', kind: 'plain' },
    ]);
  });

  it('"FRAME INICIAL" → "FRAME"=plain + " "=plain + "INICIAL"=anchor', () => {
    const { segments } = highlightPrompt('FRAME INICIAL');
    // "FRAME" no es keyword → plain; " " plain; "INICIAL" anchor
    const kinds = segments.map((s) => s.kind);
    expect(kinds).toContain('anchor');
    expect(kinds).toContain('plain');
    const anchorSeg = segments.find((s) => s.kind === 'anchor');
    expect(anchorSeg?.text).toBe('INICIAL');
  });

  it('"24fps" → cinema (no movement aunque fps podría confundirse)', () => {
    const { segments } = highlightPrompt('24fps');
    expect(segments).toEqual([{ text: '24fps', kind: 'cinema' }]);
  });

  it('Case-insensitive en movement: "Dolly" funciona igual que "dolly"', () => {
    const { segments } = highlightPrompt('Dolly');
    expect(segments[0]).toEqual({ text: 'Dolly', kind: 'movement' });
  });

  it('Case-insensitive en cinema: "Camera" funciona', () => {
    const { segments } = highlightPrompt('Camera');
    expect(segments[0]).toEqual({ text: 'Camera', kind: 'cinema' });
  });

  it('Texto sin keywords → todos los segments son "plain"', () => {
    const { segments } = highlightPrompt('Este es un texto normal sin palabras clave');
    expect(segments.every((s) => s.kind === 'plain')).toBe(true);
  });

  it('Prompt complejo: combina cinema + movement + anchor', () => {
    const text = 'Use camera dolly FROM INICIAL to final';
    const { segments } = highlightPrompt(text);
    const kinds = new Set(segments.map((s) => s.kind));
    expect(kinds.has('cinema')).toBe(true);
    expect(kinds.has('movement')).toBe(true);
    expect(kinds.has('anchor')).toBe(true);
  });

  it('String vacío → segments vacío', () => {
    const { segments } = highlightPrompt('');
    expect(segments).toEqual([]);
  });

  it('KEYWORDS exporta 3 categorías (cinema, anchor, movement)', () => {
    expect(Object.keys(KEYWORDS).sort()).toEqual(['anchor', 'cinema', 'movement']);
    expect(KEYWORDS.cinema.length).toBeGreaterThan(0);
    expect(KEYWORDS.anchor.length).toBeGreaterThan(0);
    expect(KEYWORDS.movement.length).toBeGreaterThan(0);
  });
});