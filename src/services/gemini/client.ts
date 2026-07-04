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
          const message = String(errBody.error ?? `HTTP ${res.status}`);

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
    return this.request<GenerateContentResponse>({ path: '/generateContent', body: req });
  }

  generateVideo(req: GenerateVideoRequest): Promise<VideoOperation> {
    return this.request<VideoOperation>({ path: '/generateVideo', body: req });
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
      path: `/${op}`,
      method: 'GET',
      timeoutMs: 30_000,
    });
  }

  generateImage(req: GenerateImageRequest): Promise<GenerateImageResponse> {
    return this.request<GenerateImageResponse>({ path: '/generateImage', body: req });
  }

  analyzeImage(req: GenerateContentRequest): Promise<GenerateContentResponse> {
    return this.request<GenerateContentResponse>({ path: '/analyzeImage', body: req });
  }

  synthesizeSpeech(req: TTSRequest): Promise<TTSResponse> {
    return this.request<TTSResponse>({ path: '/synthesizeSpeech', body: req });
  }
}

export const geminiClient = new GeminiProxyClient();
