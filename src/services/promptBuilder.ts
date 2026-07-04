/**
 * promptBuilder — constructores de prompts con regla anti-alucinación inyectada.
 * Spec: SPEC-S1-FOUNDATION §1.9 + ARCH-20260703-04 (regla "NO INVENTES").
 */

import type { Keyframe, VisualAnalysis, CameraSpec } from '@/types/keyframe';
import type { AidaNodeKey } from '@/types/transition';
import type { MasterBrief, ServiceToAdvertise } from '@/types/brief';
import type { BrandKit } from '@/types/project';

const NO_INVENTE_RULE = `⚠️ REGLA ABSOLUTA — NO INVENTES: USA LA IMAGEN DE REFERENCIA COMO BASE VISUAL INICIAL.
NO INVENTES ni GENERES entornos, objetos, personas, texturas ni iluminación que NO estén presentes en AMBAS anclas visuales (FROM y TO).
Mantén la continuidad visual: mismas superficies, misma temperatura de color, misma escala, misma óptica.`;

export interface BuildTransitionPromptInput {
  fromKf: Keyframe;
  toKf: Keyframe;
  nodeKey: AidaNodeKey;
  cameraSpec: CameraSpec;
  humanIntent?: string;
  brief?: MasterBrief | null;
  brandKit?: BrandKit | null;
  serviceNodeText?: string;
}

/** Texto de ancla visual formateado para prompts */
export function formatVisualAnalysisForPrompt(va: VisualAnalysis | undefined, label: 'INICIAL' | 'FINAL'): string {
  if (!va) return `[ANCLA ${label}]: sin análisis visual disponible.`;
  return [
    `[ANCLA ${label}]`,
    `Sujeto: ${va.subject}`,
    `Entorno: ${va.environment}`,
    `Iluminación: ${va.lighting}`,
    `Composición: ${va.composition}`,
    `Paleta: ${va.colorPalette.join(', ')}`,
    `Texturas: ${va.textures.join(', ')}`,
    `Cámara: ${va.cameraPosition}, DoF ${va.depthOfField}.`,
    `Notas técnicas: ${va.technicalNotes}`,
  ].join('\n');
}

export function buildCameraMovement(spec: CameraSpec, _nodeKey?: AidaNodeKey): string {
  const speedMap: Record<CameraSpec['speed'], string> = {
    slow: 'slow-motion (24fps)',
    medium: 'steady',
    fast: 'fast energetic',
  };
  return [
    `Camera: ${spec.movement}, ${spec.framing}, ${spec.angle}, ${speedMap[spec.speed]}.`,
  ].join('');
}

/** Build prompt para Veo I2V (transition) */
export function buildKeyframeTransitionPrompt(input: BuildTransitionPromptInput): string {
  const { fromKf, toKf, nodeKey, cameraSpec, humanIntent, brandKit } = input;
  const fromAnchor = formatVisualAnalysisForPrompt(fromKf.visualAnalysis, 'INICIAL');
  const toAnchor = formatVisualAnalysisForPrompt(toKf.visualAnalysis, 'FINAL');
  const cam = buildCameraMovement(cameraSpec, nodeKey);
  const brand = brandKit ? `Brand voice: ${brandKit.tone.join(', ')}.` : '';
  const intent = humanIntent ? `Intención humana: ${humanIntent}.` : '';
  return [
    `Genera un clip de video de transición I2V (Image-to-Video), ${input.serviceNodeText ? `correspondiente al nodo ${nodeKey}: "${input.serviceNodeText}".` : `correspondiente al nodo ${nodeKey} del modelo AIDA.`}`,
    ``,
    NO_INVENTE_RULE,
    ``,
    fromAnchor,
    ``,
    toAnchor,
    ``,
    cam,
    brand,
    intent,
    `Duración objetivo: ~${nodeDurations(nodeKey)} segundos. Aspecto 9:16.`,
  ]
    .filter(Boolean)
    .join('\n');
}

function nodeDurations(nodeKey: AidaNodeKey): number {
  return { bumper: 3, atencion: 4, interes: 6, deseo: 7, accion: 4, cta: 3 }[nodeKey];
}

export interface BuildImage3PromptInput {
  kfIn: Keyframe;
  intent: string;
  cameraSpec: CameraSpec;
  visualAnalysis?: VisualAnalysis;
  brief?: MasterBrief | null;
  brandKit?: BrandKit | null;
}

/** Prompt para Imagen 3: keyframe OUT continuando desde KF_IN + análisis */
export function buildImage3Prompt(input: BuildImage3PromptInput): string {
  const { intent, cameraSpec, visualAnalysis, brandKit } = input;
  void input.kfIn;
  const anchor = formatVisualAnalysisForPrompt(visualAnalysis, 'INICIAL');
  const cam = buildCameraMovement(cameraSpec, 'deseo');
  const brand = brandKit ? `Estilo marca: ${brandKit.tone.join(', ')}.` : '';
  return [
    `GENERA una imagen CONTINUACIÓN DIRECTA de la referencia visual subida.`,
    `MISMO entorno físico, MISMO sujeto base, MISMA paleta de color, MISMA iluminación, MISMAS texturas y materiales.`,
    ``,
    NO_INVENTE_RULE,
    ``,
    anchor,
    ``,
    `Transformación solicitada: ${intent}.`,
    ``,
    cam,
    brand,
    `Salida 9:16 vertical, aspecto cinematográfico, sin marcas de agua, sin texto en pantalla.`,
  ]
    .filter(Boolean)
    .join('\n');
}

export interface BuildTTSPromptInput {
  voiceover: string;
  voice?: string;
  tone?: string;
}

/** Estructura para llamar Gemini TTS */
export function buildTTSPrompt(input: BuildTTSPromptInput) {
  return {
    text: input.voiceover,
    voiceName: input.voice ?? 'Kore',
    languageCode: 'es-MX',
    speakingRate: 1.0,
    pitch: 0,
  };
}

/** Helper para extraer el texto por nodo del servicio activo */
export function pickServiceNodeText(service: ServiceToAdvertise | null, nodeKey: AidaNodeKey): string {
  if (!service) return '';
  const map: Record<AidaNodeKey, string> = {
    bumper: service.name,
    atencion: service.stages.attention,
    interes: service.stages.interest,
    deseo: service.stages.desire,
    accion: service.stages.action,
    cta: service.stages.action,
  };
  return map[nodeKey];
}

/** Alias interno para tests */
export const __NO_INVENTE_RULE = NO_INVENTE_RULE;
