/**
 * Tipos de transición entre keyframes (corazón del Keyframe Chain).
 * Spec: ARCH-20260703-04 §4.
 */

import type { CameraSpec } from './keyframe';

export type AidaNodeKey = 'bumper' | 'atencion' | 'interes' | 'deseo' | 'accion' | 'cta';

export type TransitionStatus =
  | 'pending'
  | 'prompt_ready'
  | 'approved'
  | 'generating'
  | 'done'
  | 'failed';

export interface PromptVersion {
  version: number;
  prompt: string;
  approvedAt: number;
  approvedBy: string;            // 'user' o id agente
  diffFromPrevious?: string;
  changeReason?: string;
}

export interface KeyframeTransition {
  id: string;                    // trans_atencion, trans_interes...
  fromKeyframe: string;          // kf id
  toKeyframe: string;            // kf id
  nodeKey: AidaNodeKey;
  duration: number;              // segundos
  prompt: string;                // prompt original build
  promptFinal?: string;          // prompt aprobado por usuario
  cameraSpec: CameraSpec;
  status: TransitionStatus;
  videoBlob?: Blob;
  videoUrl?: string;
  veoOperationId?: string;
  errorMessage?: string;
  generatedAt?: number;
  /** Trazabilidad: original + N ediciones aprobadas */
  promptHistory: PromptVersion[];
}

/** Helper: nodeKey por defecto según pares de roles */
export const TRANSITION_DURATIONS: Record<AidaNodeKey, number> = {
  bumper: 3,
  atencion: 4,
  interes: 6,
  deseo: 7,
  accion: 4,
  cta: 3,
};

export const NODE_DURATION_CAP = 30; // segundos totales del master
