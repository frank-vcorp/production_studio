/**
 * telemetry — servicio opt-in (GDPR-safe) que persiste eventos localmente.
 * Spec: SPEC-S3-EXPORT §Tarea 3.9.
 *
 * Diseño:
 * - OFF por default (privacidad primero). Solo escribe si el usuario hace opt-in.
 * - Persiste últimos 100 eventos en localStorage ('bridge_telemetry').
 * - Toggle lee localStorage 'bridge_telemetry_optin' === 'true'.
 * - Desactivar (setOptIn(false)) limpia los eventos almacenados.
 */

import type { AspectRatio } from '@/types/export';
export type TelemetryAspectRatio = AspectRatio;

export type TelemetryEvent =
  | {
      type: 'fallback_activated';
      jobId: string;
      reason: string;
      ratio: TelemetryAspectRatio;
      strategy: string;
      timestamp: number;
    }
  | {
      type: 'job_completed';
      jobId: string;
      durationMs: number;
      timestamp: number;
    }
  | {
      type: 'export_pack_generated';
      ratios: TelemetryAspectRatio[];
      totalMB: number;
      timestamp: number;
    };

const OPTIN_KEY = 'bridge_telemetry_optin';
const EVENTS_KEY = 'bridge_telemetry';
const MAX_EVENTS = 100;

class TelemetryService {
  private events: TelemetryEvent[] = [];
  private loaded = false;

  private load(): void {
    if (this.loaded) return;
    this.loaded = true;
    if (typeof localStorage === 'undefined') return;
    try {
      const raw = localStorage.getItem(EVENTS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) this.events = parsed as TelemetryEvent[];
      }
    } catch {
      this.events = [];
    }
  }

  private persist(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const slice = this.events.slice(-MAX_EVENTS);
      localStorage.setItem(EVENTS_KEY, JSON.stringify(slice));
    } catch {
      /* quota o serialización — silencioso */
    }
  }

  /** True si el usuario dio opt-in explícito. OFF por default. */
  isEnabled(): boolean {
    if (typeof localStorage === 'undefined') return false;
    return localStorage.getItem(OPTIN_KEY) === 'true';
  }

  /** Cambia el opt-in. Si desactiva, limpia los eventos almacenados. */
  setOptIn(enabled: boolean): void {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(OPTIN_KEY, String(enabled));
    if (!enabled) {
      this.events = [];
      localStorage.removeItem(EVENTS_KEY);
    } else {
      this.persist();
    }
  }

  /** Registra un evento. Silencioso si opt-in está OFF. */
  record(event: TelemetryEvent): void {
    if (!this.isEnabled()) return;
    this.load();
    this.events.push(event);
    this.persist();
  }

  /** Devuelve los últimos N eventos (defensor copy: spread para evitar mutación externa). */
  getEvents(): TelemetryEvent[] {
    this.load();
    return [...this.events];
  }

  /** Cuenta eventos (útil para UI "N eventos almacenados"). */
  count(): number {
    this.load();
    return this.events.length;
  }

  /** Hard reset (testing/debug). */
  clearAll(): void {
    this.events = [];
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(EVENTS_KEY);
    }
  }
}

export const telemetry = new TelemetryService();
