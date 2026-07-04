/**
 * AnalyticsService — cobertura S6 de los 4 escenarios clave.
 * Spec: SPEC-S6-TESTS-CICD §6.6 — Privacy Opt-in tests.
 *
 * ID: IMPL-20260704-06.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { analytics } from '@/services/analytics';

describe('AnalyticsService — opt-in GDPR-safe', () => {
  beforeEach(() => {
    localStorage.clear();
    analytics._reset();
  });

  it('record sin opt-in NO persiste el evento', () => {
    expect(analytics.isEnabled()).toBe(false);
    analytics.record({ type: 'session_started', sessionId: 's1', timestamp: Date.now() });
    expect(analytics.getEvents()).toEqual([]);
    expect(localStorage.getItem('bridge_analytics_events')).toBeNull();
  });

  it('record con opt-in persiste el evento en localStorage', () => {
    analytics.setOptIn(true);
    analytics.record({
      type: 'brief_completed',
      sector: 'automotriz',
      servicesCount: 3,
      timestamp: Date.now(),
    });
    const events = analytics.getEvents();
    expect(events.length).toBe(1);
    expect(events[0].type).toBe('brief_completed');

    const stored = localStorage.getItem('bridge_analytics_events');
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored!);
    expect(parsed[0].sector).toBe('automotriz');
  });

  it('cap a 100 eventos (FIFO shift)', () => {
    analytics.setOptIn(true);
    for (let i = 0; i < 110; i++) {
      analytics.record({
        type: 'first_generation',
        nodeCount: i,
        timestamp: Date.now(),
      });
    }
    const events = analytics.getEvents();
    expect(events.length).toBe(100);
    // Los primeros 10 se descartaron; quedan los últimos 100.
    expect((events[0] as { nodeCount: number }).nodeCount).toBe(10);
    expect((events[99] as { nodeCount: number }).nodeCount).toBe(109);
  });

  it('setOptIn(false) limpia el buffer (right to be forgotten)', () => {
    analytics.setOptIn(true);
    analytics.record({ type: 'session_started', sessionId: 'x', timestamp: Date.now() });
    expect(analytics.getEvents().length).toBe(1);

    analytics.setOptIn(false);
    expect(analytics.isEnabled()).toBe(false);
    expect(analytics.getEvents()).toEqual([]);
    expect(localStorage.getItem('bridge_analytics_events')).toBeNull();
  });

  it('getEvents retorna copia del array (no comparte referencia interna)', () => {
    analytics.setOptIn(true);
    analytics.record({ type: 'session_ended', durationSec: 120, timestamp: Date.now() });
    const a = analytics.getEvents();
    const b = analytics.getEvents();
    expect(a).not.toBe(b); // diferentes referencias
    expect(a).toEqual(b); // mismos datos
    // Mutar copia local NO afecta el state interno
    a.push({
      type: 'fallback_activated',
      reason: 'mutated',
      ratio: '9:16',
      timestamp: 0,
    });
    expect(analytics.getEvents().length).toBe(1);
  });
});