/**
 * apiKeysStore — cobertura S6: checkProxy (online/offline/safetyFlags).
 * Spec: SPEC-S6-TESTS-CICD §6.1.
 *
 * ID: IMPL-20260704-06.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useApiKeysStore } from '@/stores/apiKeysStore';

describe('apiKeysStore — checkProxy', () => {
  beforeEach(() => {
    useApiKeysStore.setState({
      proxyConnected: false,
      lastCheckedAt: null,
      latencyMs: null,
      safetyFlagsEnabled: true,
    });
    vi.restoreAllMocks();
  });

  it('checkProxy OK cuando fetch responde ok', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 200 })),
    );
    await useApiKeysStore.getState().checkProxy();
    const s = useApiKeysStore.getState();
    expect(s.proxyConnected).toBe(true);
    expect(s.lastCheckedAt).not.toBeNull();
    expect(typeof s.latencyMs).toBe('number');
  });

  it('checkProxy failure cuando fetch rechaza', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network'); }));
    await useApiKeysStore.getState().checkProxy();
    const s = useApiKeysStore.getState();
    expect(s.proxyConnected).toBe(false);
    expect(s.lastCheckedAt).not.toBeNull();
    expect(s.latencyMs).toBeNull();
  });

  it('checkProxy failure cuando fetch responde 500', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('boom', { status: 500 })),
    );
    await useApiKeysStore.getState().checkProxy();
    expect(useApiKeysStore.getState().proxyConnected).toBe(false);
  });

  it('setSafetyFlags toggles flag', () => {
    expect(useApiKeysStore.getState().safetyFlagsEnabled).toBe(true);
    useApiKeysStore.getState().setSafetyFlags(false);
    expect(useApiKeysStore.getState().safetyFlagsEnabled).toBe(false);
    useApiKeysStore.getState().setSafetyFlags(true);
    expect(useApiKeysStore.getState().safetyFlagsEnabled).toBe(true);
  });
});
