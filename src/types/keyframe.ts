/**
 * Tipos del Keyframe Chain (arquitectura anti-alucinación).
 * Spec: SPEC-S1-FOUNDATION §1.3 + ARCH-20260703-04.
 */

/** Roles fijos del storyboard (6 base + 4 auto OUT) */
export type KeyframeRole =
  | 'bumper_start'  // KF0 Logo
  | 'atencion_in'   // KF1_IN Problema
  | 'atencion_out'  // KF1_OUT Generada por Imagen 3
  | 'interes_in'    // KF2_IN Taller/Espacio
  | 'interes_out'   // KF2_OUT Generada
  | 'deseo_in'      // KF3_IN Solución
  | 'deseo_out'     // KF3_OUT Generada
  | 'accion_in'     // KF4 CTA Base
  | 'cta_final';    // KF5 CTA Final / recepción

export type KeyframeStatus =
  | 'empty'
  | 'uploaded'
  | 'analyzed'
  | 'generating'
  | 'generated'
  | 'approved'
  | 'failed';

export type KeyframeSource =
  | 'user_upload'
  | 'generated_imagen3'
  | 'cta_render'
  | 'previous_output';

/** Specs de cámara para mantener continuidad visual entre keyframes */
export interface CameraSpec {
  movement: string;        // "dolly out", "crane up", "pan left"...
  framing: string;         // "macro", "wide", "medium close-up"
  angle: string;           // "low angle", "eye level", "top down"
  speed: 'slow' | 'medium' | 'fast';
}

/** Análisis visual Gemini Vision — inyectado en TODOS los prompts Veo/Imagen 3 */
export interface VisualAnalysis {
  subject: string;
  environment: string;
  lighting: string;
  composition: string;
  colorPalette: string[];    // hex aprox
  textures: string[];
  cameraPosition: string;
  depthOfField: 'shallow' | 'medium' | 'deep';
  dominantShapes: string[];
  technicalNotes: string;
  analyzedAt: number;
  model: 'gemini-2.5-pro-vision';
  /** 0-1, alerta si < 0.4 */
  confidence: number;
}

/** Keyframe individual */
export interface Keyframe {
  id: string;
  role: KeyframeRole;
  label: string;          // "Logo", "Problema", "Taller OUT (Auto)"
  description: string;    // prompt UI: "Foto real: el problema..."
  source: KeyframeSource;
  blob?: Blob;
  base64?: string;        // serialización para IDB
  mimeType?: string;
  visualAnalysis?: VisualAnalysis;
  humanIntent?: string;   // "abrir a motor sucio"
  humanDescription?: string;
  generationPrompt?: string;
  cameraSpec?: CameraSpec;
  /** Posición en timeline final */
  timestamp: number;
  status: KeyframeStatus;
  error?: string;
}

/** Slots fijos del storyboard (constante inmutable, exportada) */
/**
 * STORYBOARD_STRUCTURE — S5 fix: organizar slots por categorías AIDA
 * para que el usuario entienda visualmente qué parte del video está creando.
 *
 * Estructura jerárquica:
 *   1. GENERALES (Negocio): Logo + fotos del lugar
 *   2. AIDA - ATENCIÓN: IN (problema) + OUT (solución auto)
 *   3. AIDA - INTERÉS: IN (autoridad) + OUT (auto)
 *   4. AIDA - DESEO: IN (transformación) + OUT (auto)
 *   5. AIDA - CTA: Base (tarjeta) + Final (cierre)
 */
export type StoryboardCategoryId =
  | 'generales'
  | 'atencion'
  | 'interes'
  | 'deseo'
  | 'cta';

export interface StoryboardCategory {
  id: StoryboardCategoryId;
  /** Emoji grande para identificar visualmente la categoría */
  emoji: string;
  /** Nombre corto (1-3 palabras) */
  name: string;
  /** Descripción pedagógica de qué se logra en esta categoría */
  description: string;
  /** Color de acento (Tailwind color) para el header */
  accent: 'sky' | 'emerald' | 'indigo' | 'fuchsia' | 'rose';
  /** Slots que pertenecen a esta categoría */
  slots: ReadonlyArray<{
    role: KeyframeRole;
    label: string;
    hint: string;
    autoGenerate?: boolean; // true si el sistema genera la imagen con Imagen 3
  }>;
}

export const STORYBOARD_STRUCTURE: ReadonlyArray<StoryboardCategory> = [
  {
    id: 'generales',
    emoji: '📁',
    name: 'Generales del Negocio',
    description: 'Logo y fotos del lugar/equipo. No se usan directamente en AIDA pero dan identidad.',
    accent: 'sky',
    slots: [
      { role: 'bumper_start', label: 'Logo', hint: 'PNG/SVG para cortinilla inicial' },
      { role: 'interes_in',   label: 'Tu Espacio', hint: 'Foto real: tu taller, oficina, equipo' },
    ],
  },
  {
    id: 'atencion',
    emoji: '🎬',
    name: 'AIDA · Atención',
    description: 'Gancho visual (primeros 5s). El problema que el cliente siente.',
    accent: 'emerald',
    slots: [
      { role: 'atencion_in',  label: 'IN — Estado actual', hint: 'Foto del "antes" o problema que resuelves' },
      { role: 'atencion_out', label: 'OUT — Tu marca aparece', hint: 'Auto-generada con Imagen 3', autoGenerate: true },
    ],
  },
  {
    id: 'interes',
    emoji: '🎯',
    name: 'AIDA · Interés',
    description: 'Autoridad y credibilidad (5-15s). Tu espacio, certificaciones, equipo.',
    accent: 'indigo',
    slots: [
      { role: 'interes_in',  label: 'IN — Tu taller/equipo', hint: 'Foto real: espacio, herramientas, equipo' },
      { role: 'interes_out', label: 'OUT — Detalle de autoridad', hint: 'Auto-generada con Imagen 3', autoGenerate: true },
    ],
  },
  {
    id: 'deseo',
    emoji: '✨',
    name: 'AIDA · Deseo',
    description: 'Transformación (15-25s). El resultado final, antes/después, métrica visible.',
    accent: 'fuchsia',
    slots: [
      { role: 'deseo_in',  label: 'IN — Solución/resultado', hint: 'Foto real: el "después" de tu servicio' },
      { role: 'deseo_out', label: 'OUT — Métrica/anuncio', hint: 'Auto-generada con Imagen 3', autoGenerate: true },
    ],
  },
  {
    id: 'cta',
    emoji: '📲',
    name: 'AIDA · CTA (cierre)',
    description: 'Llamada a la acción. Tarjeta de contacto + fachada del negocio.',
    accent: 'rose',
    slots: [
      { role: 'accion_in', label: 'CTA Base', hint: 'Foto fondo de la tarjeta final (opcional)' },
      { role: 'cta_final', label: 'CTA Final', hint: 'Foto real: recepción, fachada, contacto' },
    ],
  },
] as const;

/**
 * STORYBOARD_SLOTS — deprecated alias para compatibilidad con código legacy.
 * Mantiene la firma plana anterior (6 roles base, sin categoría).
 * Nuevo código debe usar STORYBOARD_STRUCTURE.
 */
export const STORYBOARD_SLOTS: ReadonlyArray<{
  role: Exclude<KeyframeRole, 'atencion_out' | 'interes_out' | 'deseo_out'>;
  label: string;
  description: string;
  allowUserUpload: boolean;
}> = [
  { role: 'bumper_start', label: 'Logo',                description: 'Logo PNG/SVG para cortinilla',                allowUserUpload: true },
  { role: 'atencion_in',  label: 'Problema',            description: 'Foto real: el problema que resuelves',         allowUserUpload: true },
  { role: 'interes_in',   label: 'Taller',              description: 'Foto real: tu espacio / equipo',              allowUserUpload: true },
  { role: 'deseo_in',     label: 'Solución',            description: 'Foto real: el resultado final',                allowUserUpload: true },
  { role: 'accion_in',    label: 'CTA Base',            description: 'Foto fondo tarjeta final (opcional)',          allowUserUpload: true },
  { role: 'cta_final',    label: 'CTA Final',           description: 'Foto real: recepción / fachada',               allowUserUpload: true },
] as const;
