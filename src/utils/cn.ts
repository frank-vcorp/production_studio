/**
 * cn — concat de className condicional.
 */

type ClassValue = string | number | null | false | undefined | Record<string, boolean | null | undefined> | ClassValue[];

export function cn(...inputs: ClassValue[]): string {
  const out: string[] = [];
  const walk = (val: ClassValue): void => {
    if (!val && val !== 0) return;
    if (typeof val === 'string' || typeof val === 'number') {
      out.push(String(val));
      return;
    }
    if (Array.isArray(val)) {
      val.forEach(walk);
      return;
    }
    if (typeof val === 'object') {
      for (const [k, v] of Object.entries(val)) {
        if (v) out.push(k);
      }
    }
  };
  inputs.forEach(walk);
  return out.join(' ');
}
