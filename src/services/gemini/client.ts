/**
 * GeminiProxyClient — fetch wrapper hacia /api/gemini/*.
 * - NUNCA recibe API keys; el proxy las inyecta.
 * - Backoff exponencial 3x para 429/5xx/timeout.
 * - AbortController para timeouts configurables.
 * Spec: SPEC-S1-FOUNDATION §1.6 + ARCH-20260703-02.
 */

import type {
  GenerateContentRequest,
  GenerateContentResponse,
  GenerateVideoRequest,
  VideoOperation,
  GenerateImageRequest,
  GenerateImageResponse,
  TTSRequest,
  TTSResponse,
} from '@/types/gemini';

const DEFAULT_BASE_URL = '/api/gemini';
const DEFAULT_TIMEOUT_MS = 180_000; // 3 min para Veo

/**
 * Extrae un mensaje legible del body de error de Gemini API.
 * Maneja los dos formatos comunes:
 *   - { error: "string error" }
 *   - { error: { code, message, status } }
 * ARCH-20260705-03.
 */
export function extractErrorMessage(
  errBody: Record<string, unknown>,
  httpStatus: number,
): string {
  const e = errBody.error;
  if (typeof e === 'string' && e.trim()) return e;
  if (e && typeof e === 'object') {
    const obj = e as { message?: string; code?: number };
    if (typeof obj.message === 'string' && obj.message.trim()) return obj.message;
    if (typeof obj.code === 'number') return `HTTP ${obj.code}`;
  }
  return `Error HTTP ${httpStatus}`;
}

export class GeminiProxyError extends Error {
  constructor(
    public status: number,
    message: string,
    public details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'GeminiProxyError';
  }
}

interface RequestOptions {
  path: string;
  body?: unknown;
  method?: 'POST' | 'GET';
  signal?: AbortSignal;
  timeoutMs?: number;
  /** Override base URL per request (e.g. ops polling uses absolute path) */
  baseOverride?: string;
}

export class GeminiProxyClient {
  private baseUrl: string;

  constructor(baseUrl: string = import.meta.env.VITE_PROXY_BASE || DEFAULT_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  /** Fetch genérico con backoff 3x (1s, 2s, 4s) para 429/5xx/timeout */
  async request<T>(opts: RequestOptions): Promise<T> {
    const {
      path,
      body,
      method = 'POST',
      signal: externalSignal,
      timeoutMs = DEFAULT_TIMEOUT_MS,
      baseOverride,
    } = opts;

    let lastError: unknown = null;
    const base = baseOverride ?? this.baseUrl;
    const url = `${base}${path}`;

    for (let attempt = 0; attempt < 3; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      const signal = externalSignal
        ? AbortSignal.any([externalSignal, controller.signal])
        : controller.signal;

      try {
        const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: method === 'POST' ? JSON.stringify(body) : undefined,
          signal,
        });

        clearTimeout(timeout);

        if (!res.ok) {
          const errBody = (await res.json().catch(() => ({}))) as Record<string, unknown>;
          const message = extractErrorMessage(errBody, res.status);

          if (this.shouldRetry(res.status)) {
            lastError = new GeminiProxyError(res.status, message, errBody);
            const wait = 1000 * Math.pow(2, attempt); // 1s, 2s, 4s
            await this.sleep(wait, externalSignal);
            continue;
          }
          throw new GeminiProxyError(res.status, message, errBody);
        }

        const ct = res.headers.get('Content-Type') ?? '';
        if (ct.includes('application/json')) {
          return (await res.json()) as T;
        }
        return (await res.text()) as unknown as T;
      } catch (err) {
        clearTimeout(timeout);
        if (err instanceof GeminiProxyError) throw err;

        if (err instanceof DOMException && err.name === 'AbortError') {
          if (externalSignal?.aborted) throw err;
          // timeout nuestro — retryable
          lastError = new GeminiProxyError(408, 'Request timeout', { timeoutMs });
          const wait = 1000 * Math.pow(2, attempt);
          await this.sleep(wait, externalSignal);
          continue;
        }
        lastError = err;
        const wait = 1000 * Math.pow(2, attempt);
        await this.sleep(wait, externalSignal);
      }
    }

    if (lastError instanceof Error) throw lastError;
    throw new GeminiProxyError(500, 'Unknown failure after retries');
  }

  private shouldRetry(status: number): boolean {
    return status === 408 || status === 425 || status === 429 || (status >= 500 && status < 600);
  }

  private sleep(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise((res, rej) => {
      const id = setTimeout(res, ms);
      if (signal) {
        signal.addEventListener(
          'abort',
          () => {
            clearTimeout(id);
            rej(new DOMException('Aborted', 'AbortError'));
          },
          { once: true },
        );
      }
    });
  }

  // ---------- Métodos semánticos ----------

  generateContent(req: GenerateContentRequest): Promise<GenerateContentResponse> {
    return this.request<GenerateContentResponse>({ path: '/api/gemini/generateContent', body: req });
  }

  generateVideo(req: GenerateVideoRequest): Promise<VideoOperation> {
    return this.request<VideoOperation>({ path: '/api/gemini/generateVideo', body: req });
  }

  /**
   * Descarga el video binario desde la URI firmada de Veo 3.1 a través del proxy.
   * El Worker hace el fetch server-side para mantener la API key fuera del cliente.
   * Spec: ARCH-20260704-11.
   */
  async downloadVideo(uri: string): Promise<Blob> {
    const encodedUri = encodeURIComponent(uri);
    const url = `${this.baseUrl}/api/gemini/downloadVideo?url=${encodedUri}`;
    const controller = new AbortController();
    // 5 min cap: el video MP4 puede pesar varios MB y la red del cliente puede ser lenta.
    const timeout = setTimeout(() => controller.abort(), 5 * 60_000);
    try {
      const res = await fetch(url, { method: 'GET', signal: controller.signal });
      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as Record<string, unknown>;
        const message = extractErrorMessage(errBody, res.status);
        throw new GeminiProxyError(res.status, message, errBody);
      }
      return await res.blob();
    } catch (err) {
      if (err instanceof GeminiProxyError) throw err;
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new GeminiProxyError(408, 'Download timeout', { timeoutMs: 5 * 60_000 });
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Poll de una operation name. La URL completa viene como `operations/...` o
   * ya con prefijo 'operations/...'. Si llega absoluta (e.g. 'projects/...'),
   * el proxy la trata como path.
   */
  pollOperation(name: string): Promise<VideoOperation> {
    // El worker expone como `/api/gemini/operations/{name}`; aquí normalizamos.
    const op = name.startsWith('operations/') ? name : `operations/${name}`;
    return this.request<VideoOperation>({
      path: `/api/gemini/${op}`,
      method: 'GET',
      timeoutMs: 30_000,
    });
  }

  generateImage(req: GenerateImageRequest): Promise<GenerateImageResponse> {
    return this.request<GenerateImageResponse>({ path: '/api/gemini/generateImage', body: req });
  }

  analyzeImage(req: GenerateContentRequest): Promise<GenerateContentResponse> {
    return this.request<GenerateContentResponse>({ path: '/api/gemini/analyzeImage', body: req });
  }

  synthesizeSpeech(req: TTSRequest): Promise<TTSResponse> {
    return this.request<TTSResponse>({ path: '/api/gemini/synthesizeSpeech', body: req });
  }
}

export const geminiClient = new GeminiProxyClient();
