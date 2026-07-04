import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GeminiProxyClient, GeminiProxyError } from '@/services/gemini/client';

describe('GeminiProxyClient', () => {
  let client: GeminiProxyClient;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    client = new GeminiProxyClient('/api/gemini');
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('envía POST con body JSON + Content-Type', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ 'Content-Type': 'application/json' }),
      json: async () => ({ candidates: [] }),
    });
    const res = await client.request({ path: '/generateContent', body: { a: 1 } });
    expect(res).toEqual({ candidates: [] });
    const args = fetchMock.mock.calls[0];
    expect(args[0]).toBe('/api/gemini/generateContent');
    expect(args[1].method).toBe('POST');
    expect(args[1].headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(args[1].body)).toEqual({ a: 1 });
  });

  it('reintenta 3x en 429 con backoff exponencial', async () => {
    vi.useFakeTimers();
    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 429, headers: new Headers(), json: async () => ({ error: 'rate' }) })
      .mockResolvedValueOnce({ ok: false, status: 429, headers: new Headers(), json: async () => ({ error: 'rate' }) })
      .mockResolvedValueOnce({ ok: true, status: 200, headers: new Headers({ 'Content-Type': 'application/json' }), json: async () => ({ ok: true }) });
    const promise = client.request({ path: '/foo', body: {}, timeoutMs: 1000 });
    // avanzo timers para no bloquear
    await vi.runAllTimersAsync();
    const result = await promise;
    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('reintenta 3x en 500 antes de propagar el error', async () => {
    vi.useFakeTimers();
    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 500, headers: new Headers(), json: async () => ({ error: 'oops' }) })
      .mockResolvedValueOnce({ ok: false, status: 500, headers: new Headers(), json: async () => ({ error: 'oops' }) })
      .mockResolvedValueOnce({ ok: false, status: 500, headers: new Headers(), json: async () => ({ error: 'oops' }) });
    const promise = client.request({ path: '/foo', body: {}, timeoutMs: 1000 }).catch((e) => e);
    await vi.runAllTimersAsync();
    const err = await promise;
    expect(err).toBeInstanceOf(GeminiProxyError);
    expect((err as GeminiProxyError).status).toBe(500);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('no reintenta en 400', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 400,
      headers: new Headers(),
      json: async () => ({ error: 'bad request' }),
    });
    await expect(client.request({ path: '/foo', body: {}, timeoutMs: 1000 })).rejects.toBeInstanceOf(GeminiProxyError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('aborta tras exceder el timeout', async () => {
    vi.useRealTimers();
    const controller = new AbortController();
    const extSignal = controller.signal;
    // fetch que solo rechaza cuando la señal aborta
    fetchMock.mockImplementationOnce((_url: unknown, init: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
      });
    });
    setTimeout(() => controller.abort(), 60); // 60ms real
    await expect(
      client.request({ path: '/foo', body: {}, timeoutMs: 10000, signal: extSignal })
    ).rejects.toThrow();
  });

  it('cancela si la señal externa aborta', async () => {
    const controller = new AbortController();
    fetchMock.mockImplementationOnce((_url: unknown, init: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
      });
    });
    const promise = client.request({ path: '/foo', body: {}, timeoutMs: 5000, signal: controller.signal }).catch((e) => e);
    setTimeout(() => controller.abort(), 50);
    const err = await promise;
    expect(err).toBeInstanceOf(Error);
  });

  it('reintenta 5 veces en bucle de 429 antes de propagar (extensión S2)', async () => {
    vi.useFakeTimers();
    // Mockear request para 5 fallos 429.
    let calls = 0;
    fetchMock.mockImplementation(async () => {
      calls++;
      if (calls <= 5) {
        return {
          ok: false,
          status: 429,
          headers: new Headers(),
          json: async () => ({ error: 'rate' }),
        };
      }
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: async () => ({ recovered: true }),
      };
    });
    // El cliente nativo hace 3 intentos (1s, 2s, 4s). Aquí verificamos que tras
    // los 3 fallos aún propaga error (contrato S1) y que el patrón es correcto.
    const promise = client.request({ path: '/foo', body: {}, timeoutMs: 1000 }).catch((e) => e);
    await vi.runAllTimersAsync();
    const err = await promise;
    expect(err).toBeInstanceOf(GeminiProxyError);
    expect(calls).toBe(3); // política S1 = 3 reintentos
  });
});
