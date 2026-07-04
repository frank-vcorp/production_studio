import { describe, it, expect, beforeEach } from 'vitest';
import { telemetry, type TelemetryEvent } from '@/services/telemetry';

describe('telemetry', () => {
  beforeEach(() => {
    localStorage.clear();
    telemetry.clearAll();
  });

  it('isEnabled OFF por default', () => {
    expect(telemetry.isEnabled()).toBe(false);
  });

  it('record es silencioso cuando opt-in OFF', () => {
    telemetry.record({
      type: 'job_completed',
      jobId: 'j1',
      durationMs: 1500,
      timestamp: Date.now(),
    });
    expect(telemetry.count()).toBe(0);
    expect(localStorage.getItem('bridge_telemetry')).toBeNull();
  });

  it('setOptIn(true) habilita, registra y persiste eventos', () => {
    telemetry.setOptIn(true);
    expect(telemetry.isEnabled()).toBe(true);
    const ev: TelemetryEvent = {
      type: 'export_pack_generated',
      ratios: ['9:16', '1:1'],
      totalMB: 35,
      timestamp: Date.now(),
    };
    telemetry.record(ev);
    expect(telemetry.count()).toBe(1);
    const stored = localStorage.getItem('bridge_telemetry');
    expect(stored).not.toBeNull();
    expect(JSON.parse(stored as string)).toHaveLength(1);
  });

  it('setOptIn(false) limpia los eventos', () => {
    telemetry.setOptIn(true);
    telemetry.record({
      type: 'job_completed',
      jobId: 'j2',
      durationMs: 100,
      timestamp: Date.now(),
    });
    expect(telemetry.count()).toBe(1);
    telemetry.setOptIn(false);
    expect(telemetry.count()).toBe(0);
    expect(localStorage.getItem('bridge_telemetry')).toBeNull();
    expect(telemetry.isEnabled()).toBe(false);
  });

  it('getEvents retorna copia (mutar no afecta storage)', () => {
    telemetry.setOptIn(true);
    telemetry.record({
      type: 'job_completed',
      jobId: 'j3',
      durationMs: 50,
      timestamp: Date.now(),
    });
    const evs = telemetry.getEvents();
    evs.push({
      type: 'job_completed',
      jobId: 'fake',
      durationMs: 0,
      timestamp: 0,
    });
    expect(telemetry.count()).toBe(1);
  });
});
