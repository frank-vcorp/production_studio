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
export const STORYBOARD_SLOTS: ReadonlyArray<{
  role: Exclude<KeyframeRole, 'atencion_out' | 'interes_out' | 'deseo_out'>;
  label: string;
  description: string;
  allowUserUpload: boolean;
}> = [
  { role: 'bumper_start', label: 'Logo', description: 'Logo PNG/SVG para cortinilla', allowUserUpload: true },
  { role: 'atencion_in',  label: 'Problema', description: 'Foto real: el problema que resuelves', allowUserUpload: true },
  { role: 'interes_in',   label: 'Taller', description: 'Foto real: tu espacio / equipo', allowUserUpload: true },
  { role: 'deseo_in',     label: 'Solución', description: 'Foto real: el resultado final', allowUserUpload: true },
  { role: 'accion_in',    label: 'CTA Base', description: 'Foto fondo tarjeta final (opcional)', allowUserUpload: true },
  { role: 'cta_final',    label: 'CTA Final', description: 'Foto real: recepción / fachada', allowUserUpload: true },
] as const;
