/**
 * AnalyticsService — eventos anónimos opt-in, GDPR-safe.
 * Spec: SPEC-S6-TESTS-CICD §6.6.
 *
 * Diseño:
 *  - Opt-in OFF por defecto (privacy-first).
 *  - Persistencia en localStorage (clave bridge_analytics_optin).
 *  - Eventos en localStorage (clave bridge_analytics_events) — cap 100.
 *  - Sin PII: solo contadores, sectores, sizes, IDs de sesión UUID.
 *  - setOptIn(false) limpia el buffer para "right to be forgotten".
 *
 * Tipos de eventos permitidos:
 *  - session_started    (id de sesión UUID)
 *  - brief_completed    (sector + count de servicios)
 *  - first_generation   (nodeCount)
 *  - export_completed   (ratio + sizeMB)
 *  - fallback_activated (razón + ratio)
 *  - session_ended      (duración en segundos)
 *
 * ID: IMPL-20260704-06.
 */

export type SectorId = string;

export type AnalyticsEvent =
  | { type: 'session_started'; sessionId: string; timestamp: number }
  | { type: 'brief_completed'; sector: SectorId; servicesCount: number; timestamp: number }
  | { type: 'first_generation'; nodeCount: number; timestamp: number }
  | { type: 'export_completed'; format: string; sizeMB: number; timestamp: number }
  | { type: 'fallback_activated'; reason: string; ratio: string; timestamp: number }
  | { type: 'session_ended'; durationSec: number; timestamp: number };

const OPTIN_KEY = 'bridge_analytics_optin';
const EVENTS_KEY = 'bridge_analytics_events';
const MAX_EVENTS = 100;

class AnalyticsService {
  private events: AnalyticsEvent[] = [];
  private loaded = false;

  /** Carga buffer desde localStorage (lazy, no en constructor para SSR-safe). */
  private load(): void {
    if (this.loaded) return;
    this.loaded = true;
    try {
      if (typeof localStorage === 'undefined') return;
      const raw = localStorage.getItem(EVENTS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.events = parsed as AnalyticsEvent[];
        }
      }
    } catch {
      this.events = [];
    }
  }

  private persist(): void {
    try {
      if (typeof localStorage === 'undefined') return;
      localStorage.setItem(EVENTS_KEY, JSON.stringify(this.events));
    } catch {
      // ignore quota / private mode
    }
  }

  isEnabled(): boolean {
    try {
      if (typeof localStorage === 'undefined') return false;
      return localStorage.getItem(OPTIN_KEY) === 'true';
    } catch {
      return false;
    }
  }

  setOptIn(enabled: boolean): void {
    try {
      if (typeof localStorage === 'undefined') return;
      localStorage.setItem(OPTIN_KEY, String(enabled));
      if (!enabled) {
        // Right to be forgotten: limpiar buffer completo al desactivar opt-in.
        this.events = [];
        localStorage.removeItem(EVENTS_KEY);
      }
    } catch {
      // ignore
    }
  }

  record(event: AnalyticsEvent): void {
    if (!this.isEnabled()) return;
    this.load();
    this.events.push(event);
    // Cap a últimos 100 eventos (FIFO shift)
    if (this.events.length > MAX_EVENTS) {
      this.events = this.events.slice(-MAX_EVENTS);
    }
    this.persist();
  }

  /** Snapshot defensivo (no comparte referencia interna). */
  getEvents(): AnalyticsEvent[] {
    this.load();
    return this.events.slice();
  }

  /** Limpia buffer (testing). */
  _reset(): void {
    this.events = [];
    this.loaded = false;
    try {
      if (typeof localStorage !== 'undefined') localStorage.removeItem(EVENTS_KEY);
    } catch {
      // ignore
    }
  }
}

export const analytics = new AnalyticsService();