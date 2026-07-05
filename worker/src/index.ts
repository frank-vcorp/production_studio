/**
 * Bridge Gemini Proxy — Cloudflare Worker
 * Inyecta GEMINI_API_KEY server-side, CORS, rate limit básico.
 * Spec: ARCH-20260703-02 — versión simplificada S1 (sin hono para evitar deps).
 */

interface Env {
  GEMINI_API_KEY: string;
  RATE_LIMIT_RPM?: string;
  ALLOWED_ORIGINS?: string;
  LOG_LEVEL?: string;
}

// --- CORS helpers ---

const DEFAULT_ALLOWED = ['http://localhost:5173'];

function pickOrigin(req: Request, env: Env): string | null {
  const origin = req.headers.get('Origin');
  if (!origin) return null;
  const allowed = (env.ALLOWED_ORIGINS ?? DEFAULT_ALLOWED.join(','))
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return allowed.includes(origin) ? origin : null;
}

function corsHeaders(origin: string | null): Headers {
  const h = new Headers();
  if (origin) {
    h.set('Access-Control-Allow-Origin', origin);
    h.set('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    h.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    h.set('Access-Control-Expose-Headers', 'X-Request-ID, X-Latency-Ms, X-Safety-Flags');
    h.set('Access-Control-Max-Age', '86400');
    h.set('Vary', 'Origin');
  }
  return h;
}

// --- Rate limit (in-memory por instancia; S2+ mover a KV) ---

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string, limit: number): { allowed: boolean; remaining: number; retryAfter: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || entry.resetAt < now) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 60_000 });
    return { allowed: true, remaining: limit - 1, retryAfter: 0 };
  }
  if (entry.count >= limit) {
    return { allowed: false, remaining: 0, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }
  entry.count += 1;
  return { allowed: true, remaining: limit - (entry.count), retryAfter: 0 };
}

// --- Routes ---

function jsonResponse(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...extra },
  });
}

function withCorsHeaders(response: Response, origin: string | null): Response {
  const h = corsHeaders(origin);
  const newHeaders = new Headers(response.headers);
  h.forEach((v, k) => newHeaders.set(k, v));
  return new Response(response.body, { status: response.status, headers: newHeaders });
}

/**
 * Parse Gemini safety ratings from a response body and return a compact header value.
 * Format: "CATEGORY:PROBABILITY,CATEGORY:PROBABILITY" (only MEDIUM/HIGH included, lowercased category).
 * Per ADR-02: client must have visibility sobre posibles bloqueos de contenido.
 */
function parseSafetyFlags(body: string): string | null {
  try {
    const json = JSON.parse(body) as { candidates?: Array<{ safetyRatings?: Array<{ category: string; probability: string }> }> };
    const candidates = json.candidates;
    if (!Array.isArray(candidates)) return null;
    const flags: string[] = [];
    for (const candidate of candidates) {
      const ratings = candidate.safetyRatings;
      if (!Array.isArray(ratings)) continue;
      for (const rating of ratings) {
        // Only report MEDIUM/HIGH for cliente visibility (avoid noise)
        const prob = (rating.probability ?? '').toUpperCase();
        if (prob === 'MEDIUM' || prob === 'HIGH') {
          flags.push(`${rating.category.toLowerCase()}:${prob.toLowerCase()}`);
        }
      }
    }
    return flags.length > 0 ? flags.join(',') : null;
  } catch {
    return null;
  }
}

async function forwardToGemini(env: Env, path: string, body: unknown, origin: string | null, requestId: string): Promise<Response> {
  const url = `https://generativelanguage.googleapis.com/v1beta${path}?key=${env.GEMINI_API_KEY}`;
  const start = performance.now();
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Bridge-Creative-Engine/0.1.0',
        'X-Request-ID': requestId,
      },
      body: JSON.stringify(body),
    });
    const latencyMs = Math.round(performance.now() - start);
    const text = await res.text();
    const responseHeaders: Record<string, string> = {
      'Content-Type': res.headers.get('Content-Type') ?? 'application/json',
      'X-Request-ID': requestId,
      'X-Latency-Ms': latencyMs.toString(),
    };
    // H1: Parse Safety Ratings and expose via X-Safety-Flags header (only on 2xx with parseable JSON)
    if (res.ok) {
      const safetyFlags = parseSafetyFlags(text);
      if (safetyFlags) {
        responseHeaders['X-Safety-Flags'] = safetyFlags;
        console.log(JSON.stringify({ requestId, path, safetyFlags }));
      }
    }
    console.log(JSON.stringify({ requestId, path, status: res.status, latencyMs, origin }));
    const response = new Response(text, { status: res.status, headers: responseHeaders });
    return withCorsHeaders(response, origin);
  } catch (err) {
    const latencyMs = Math.round(performance.now() - start);
    console.error(JSON.stringify({ requestId, path, error: (err as Error).message, latencyMs }));
    return withCorsHeaders(jsonResponse({ error: 'Proxy upstream failed', detail: (err as Error).message }, 502), origin);
  }
}

async function pollOperation(env: Env, name: string, origin: string | null, requestId: string): Promise<Response> {
  const url = `https://generativelanguage.googleapis.com/v1beta/${name}?key=${env.GEMINI_API_KEY}`;
  const start = performance.now();
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Bridge-Creative-Engine/0.1.0',
        'X-Request-ID': requestId,
      },
    });
    const latencyMs = Math.round(performance.now() - start);
    const text = await res.text();
    console.log(JSON.stringify({ requestId, op: name, status: res.status, latencyMs, origin }));
    return withCorsHeaders(
      new Response(text, {
        status: res.status,
        headers: {
          'Content-Type': res.headers.get('Content-Type') ?? 'application/json',
          'X-Request-ID': requestId,
          'X-Latency-Ms': latencyMs.toString(),
        },
      }),
      origin,
    );
  } catch (err) {
    console.error(JSON.stringify({ requestId, op: name, error: (err as Error).message }));
    return withCorsHeaders(jsonResponse({ error: 'Poll failed', detail: (err as Error).message }, 502), origin);
  }
}

// --- Main handler ---

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const requestId = crypto.randomUUID();
    const url = new URL(request.url);
    const origin = pickOrigin(request, env);

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    // Health check (no auth required, no rate limit)
    if (url.pathname === '/health') {
      return withCorsHeaders(
        jsonResponse({
          status: 'ok',
          service: 'bridge-gemini-proxy',
          version: '0.1.0',
          timestamp: Date.now(),
        }),
        origin,
      );
    }

    // Rate limit (skip /health)
    const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
    const limit = parseInt(env.RATE_LIMIT_RPM ?? '10', 10);
    const rl = checkRateLimit(ip, limit);
    if (!rl.allowed) {
      return withCorsHeaders(
        jsonResponse({ error: 'Rate limit exceeded', retryAfter: rl.retryAfter }, 429, {
          'Retry-After': rl.retryAfter.toString(),
        }),
        origin,
      );
    }

    // Validar API key configurada
    if (!env.GEMINI_API_KEY) {
      return withCorsHeaders(jsonResponse({ error: 'Server misconfigured: GEMINI_API_KEY not set' }, 500), origin);
    }

    if (request.method !== 'POST' && request.method !== 'GET') {
      return withCorsHeaders(jsonResponse({ error: 'Method not allowed' }, 405), origin);
    }

    // Body
    let body: unknown = {};
    if (request.method === 'POST') {
      try {
        body = await request.json();
      } catch {
        return withCorsHeaders(jsonResponse({ error: 'Invalid JSON body' }, 400), origin);
      }
    }

    // Rutas
    switch (url.pathname) {
      case '/api/gemini/generateContent':
        return forwardToGemini(env, '/models/gemini-2.5-pro:generateContent', body, origin, requestId);
      case '/api/gemini/generateVideo':
        return forwardToGemini(env, '/models/veo-3.1:generateVideo', body, origin, requestId);
      case '/api/gemini/generateImage':
        return forwardToGemini(env, '/models/imagen-3.0-generate-002:predict', body, origin, requestId);
      case '/api/gemini/analyzeImage':
        // S5 §Worker fix: gemini-2.5-pro-vision NO EXISTE en la API actual.
        // Usamos gemini-2.5-flash que tiene capacidad multimodal (vision).
        return forwardToGemini(env, '/models/gemini-2.5-flash:generateContent', body, origin, requestId);
      case '/api/gemini/synthesizeSpeech':
        return forwardToGemini(env, '/models/gemini-2.5-flash-preview-tts:generateContent', body, origin, requestId);
      default: {
        const match = url.pathname.match(/^\/api\/gemini\/operations\/(.+)$/);
        if (match && request.method === 'GET') {
          return pollOperation(env, match[1], origin, requestId);
        }
        return withCorsHeaders(jsonResponse({ error: 'Not found', path: url.pathname }, 404), origin);
      }
    }
  },
};
