/**
 * cn — concat de classNames condicional.
 * Spec: SPEC-S6-TESTS-CICD §6.1.
 *
 * ID: IMPL-20260704-06.
 */
import { describe, it, expect } from 'vitest';
import { cn } from '@/utils/cn';

describe('cn', () => {
  it('concatena strings y filtra falsy', () => {
    expect(cn('a', 'b', 'c')).toBe('a b c');
    expect(cn('a', null, undefined, false, 'b')).toBe('a b');
  });

  it('acepta 0 como valor válido (no es falsy aquí)', () => {
    expect(cn(0)).toBe('0');
  });

  it('procesa arrays recursivamente', () => {
    expect(cn(['a', null, 'b'], 'c')).toBe('a b c');
    expect(cn([['x', 'y'], 'z'])).toBe('x y z');
  });

  it('procesa objects (keys con valor truthy)', () => {
    expect(cn({ active: true, disabled: false, hidden: 1 })).toBe('active hidden');
  });

  it('mezcla todos los tipos', () => {
    expect(
      cn('base', [null, { active: true, no: false }, ['a', 'b']], undefined, 0),
    ).toBe('base active a b 0');
  });
});
