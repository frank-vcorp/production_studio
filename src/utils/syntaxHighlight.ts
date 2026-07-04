/**
 * Syntax Highlight — tokenizador regex-based para prompts cinematográficos.
 * Spec: SPEC-S4-GRANULAR-EDIT §4.2.
 *
 * Categorías:
 *   - cinema   (azul)   → terminología cinematográfica
 *   - anchor   (verde)  → anclas visuales obligatorias (FROM/TO/NO INVENTES)
 *   - movement (amarillo)→ movimientos de cámara (dolly/crane/pan/zoom/macro)
 *   - plain              → resto del texto (gris/blanco)
 *
 * Diseño: split preservando whitespace/puntuación, lookup O(1) por Set.
 */

export type SegmentKind = 'plain' | 'cinema' | 'anchor' | 'movement';

export interface Segment {
  text: string;
  kind: SegmentKind;
}

export interface HighlightResult {
  segments: Segment[];
}

export const KEYWORDS: Record<Exclude<SegmentKind, 'plain'>, readonly string[]> = {
  cinema: [
    'camera',
    'lens',
    'lighting',
    'composition',
    'fps',
    '24fps',
    '30fps',
    '60fps',
    '120fps',
    'cinematic',
    'commercial',
    'documentary',
    'shallow',
    'depth',
    'aperture',
    'iso',
    'exposure',
    'white balance',
    'contrast',
    'saturation',
  ],
  anchor: [
    'INICIAL',
    'FINAL',
    'FRAME 0',
    'FRAME FINAL',
    'FROM',
    'TO',
    'NO INVENTES',
    'NO INVENTAR',
    'REGLA ABSOLUTA',
    'MISMO',
    'MISMA',
    'IGUAL',
    'ANCLA',
    'NO CAMBIAR',
  ],
  movement: [
    'dolly',
    'truck',
    'crane',
    'pan',
    'zoom',
    'macro',
    'steadicam',
    'handheld',
    'fpv',
    'orbit',
    'whip-pan',
    'crash-zoom',
    'tilt',
    'pedestal',
    'push-in',
    'pull-out',
    'roll',
    'tracking',
  ],
};

/** Sets para lookup O(1) — precomputados. */
const CINEMA_SET: Set<string> = new Set(KEYWORDS.cinema.map((k) => k.toLowerCase()));
const ANCHOR_SET: Set<string> = new Set(KEYWORDS.anchor);
const MOVEMENT_SET: Set<string> = new Set(KEYWORDS.movement.map((k) => k.toLowerCase()));

/** Split que preserva whitespace y separadores. */
const SPLIT_RE = /(\s+|[,;:.])/;

function classifyToken(token: string): SegmentKind {
  if (!token) return 'plain';
  // Cinema y movement son case-insensitive
  const lower = token.toLowerCase();
  if (CINEMA_SET.has(lower)) return 'cinema';
  if (MOVEMENT_SET.has(lower)) return 'movement';
  // Anchors son case-sensitive (palabras en MAYÚSCULAS por convención)
  if (ANCHOR_SET.has(token)) return 'anchor';
  return 'plain';
}

/**
 * Tokeniza un prompt y devuelve segmentos coloreables.
 * Cada token se clasifica independientemente; tokens contiguos del mismo
 * "plain" se acumulan para reducir el número de spans.
 */
export function highlightPrompt(text: string): HighlightResult {
  if (!text) return { segments: [] };

  const tokens = text.split(SPLIT_RE);
  const segments: Segment[] = [];
  let plainBuffer = '';

  const flushPlain = (): void => {
    if (plainBuffer) {
      segments.push({ text: plainBuffer, kind: 'plain' });
      plainBuffer = '';
    }
  };

  for (const token of tokens) {
    const kind = classifyToken(token);
    if (kind === 'plain') {
      plainBuffer += token;
    } else {
      flushPlain();
      segments.push({ text: token, kind });
    }
  }

  flushPlain();
  return { segments };
}