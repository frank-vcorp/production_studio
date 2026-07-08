# SPEC — Fix Veo 3.1 endpoint (404 generateVideo) + UX loader con blur overlay

**ID:** `ARCH-20260704-11`
**Fecha:** 2026-07-05
**Origen:** Usuario reporta error 404 al hacer clic en "Aprobar y generar":
```
[VeoClient] Intento 1 falló: unknown HTTP 404
bridge-gemini-proxy.vectoria-pstudio.workers.dev/api/gemini/generateVideo
```

## Causa raíz

El Worker está llamando al endpoint **incorrecto**:
```
POST https://generativelanguage.googleapis.com/v1beta/models/veo-3.1:generateVideo  ← 404
```

El endpoint **correcto** según docs oficiales de Gemini Developer API (jul-2026) es:
```
POST https://generativelanguage.googleapis.com/v1beta/models/veo-3.1-generate-preview:predictLongRunning
```

Y el body shape es completamente distinto:
- ❌ Actual: `{input_image, prompt, model, durationSeconds, aspectRatio, ...}` (root fields)
- ✅ Correcto: `{instances: [{prompt, image: {data, mimeType}}], parameters: {durationSeconds, aspectRatio, personGeneration}}`

Además:
- El modelo `veo-3.1` debe ser `veo-3.1-generate-preview` (preview suffix es obligatorio en la API pública).
- `fps` NO es parámetro soportado (Veo 3.1 usa 24 fps fijo).
- La respuesta es una operación asíncrona que se polea via `GET /v1beta/operations/{name}`.
- El video final viene en `response.generateVideoResponse.videos[0].uri` (URL firmada para descarga), NO inline.

## Cambios necesarios

### 1. Worker (`worker/src/index.ts`)

**Ruta `/api/gemini/generateVideo`:**
- Cambiar target de `'/models/veo-3.1:generateVideo'` a `'/models/veo-3.1-generate-preview:predictLongRunning'`.

**Ruta `/api/gemini/operations/{name}` (polling):**
- Actualmente llama a `https://generativelanguage.googleapis.com/v1beta/${name}?key=...`.
- Eso está BIEN — el polling endpoint es correcto.
- Verificar que `pollOperation` extrae `name` correctamente.

**Body transformation:**
- El Worker actualmente hace **forward crudo** del body al endpoint de Gemini.
- Como el body shape es completamente distinto, tenemos 2 opciones:
  - **A)** Hacer que el cliente envíe el body ya formateado para Gemini, y el Worker solo forwarde.
  - **B)** Hacer que el Worker transforme el body del shape "cliente" al shape "Gemini".

**Recomendación: Opción A** (más simple, menos acoplamiento). El cliente formatea el body, el Worker hace `forwardToGemini(env, '/models/veo-3.1-generate-preview:predictLongRunning', body, ...)`.

Esto requiere:
- Cambiar `geminiClient.generateVideo(opts)` para que devuelva el body shape de Gemini.
- Agregar headers/body logging en el Worker para debugging futuro.

### 2. Cliente (`services/gemini/video.ts`)

**`startVideoGeneration(opts)`:**
```ts
const geminiBody = {
  instances: [
    {
      prompt,
      image: fromKeyframe.base64 ? {
        data: fromKeyframe.base64,
        mimeType: fromKeyframe.mimeType ?? 'image/png',
      } : undefined,
    },
  ],
  parameters: {
    durationSeconds: Math.max(3, Math.min(8, transition.duration)),
    aspectRatio: '9:16',
    personGeneration: 'dont_allow',
  },
};

const op = await geminiClient.generateVideo(geminiBody);
// op debe contener { name: 'operations/...' }
return op;
```

**`pollVideoOperation(name)`:**
- Ya está llamando a `geminiClient.pollOperation(name)` que devuelve el response de `GET /v1beta/operations/{name}`.
- La estructura ya está bien: `done`, `response?.generateVideoResponse?.videos`.

**`extractVideoFromOperation(op)`:**
```ts
type InlinePair = { uri?: string; inlineData?: { mimeType: string; data: string } };
const videos: InlinePair[] = (op.response?.generateVideoResponse?.videos ?? [])
  .map((v): InlinePair | null => (v.uri ? { uri: v.uri } : null))
  .filter((v): v is InlinePair => v !== null);

const v = videos[0];
if (!v) throw new GeminiProxyError(500, 'Veo no devolvió videos', { op });

if (v.uri) {
  // Descargar desde la URI firmada (proxy de Cloudflare debe tener acceso)
  // Por seguridad de API key, hacer la descarga VIA el proxy de Cloudflare
  // Agregar nueva ruta: GET /api/gemini/downloadVideo?url=<uri>
  // O: hacer que el Worker descargue internamente y devuelva el binario
  ...
}
```

**Decisión sobre descarga:**
- Las URIs de Veo 3.1 público son URLs firmadas (`generativelanguage.googleapis.com/v1beta/...:download?alt=media&...`).
- Requieren la API key en la query (ya la tiene el proxy).
- **Recomendación:** agregar ruta `GET /api/gemini/downloadVideo?url=<encoded_uri>` al Worker que hace `fetch(uri)` con la key y devuelve el binario. El cliente llama esta ruta para obtener el MP4.

Alternativa más simple: que el Worker de `predictLongRunning` también haga la descarga cuando `done: true` y devuelva el binario inline. Pero esto complica el polling porque el cliente espera JSON.

**Recomendación final:** agregar ruta `/api/gemini/downloadVideo` separada.

### 3. Nuevas rutas en Worker

```ts
// GET /api/gemini/downloadVideo?url=<encoded>
case '/api/gemini/downloadVideo': {
  const targetUrl = url.searchParams.get('url');
  if (!targetUrl) return withCorsHeaders(jsonResponse({ error: 'Missing url param' }, 400), origin);
  if (!targetUrl.startsWith('https://generativelanguage.googleapis.com/')) {
    return withCorsHeaders(jsonResponse({ error: 'Invalid url host' }, 400), origin);
  }
  try {
    const res = await fetch(targetUrl);
    if (!res.ok) return withCorsHeaders(jsonResponse({ error: 'Download failed', status: res.status }, res.status), origin);
    const blob = await res.blob();
    return withCorsHeaders(
      new Response(blob, {
        status: 200,
        headers: {
          'Content-Type': res.headers.get('Content-Type') ?? 'video/mp4',
          'X-Request-ID': requestId,
        },
      }),
      origin,
    );
  } catch (err) {
    return withCorsHeaders(jsonResponse({ error: 'Download error', detail: (e as Error).message }, 502), origin);
  }
}
```

### 4. Cliente: agregar método `downloadVideo`

```ts
async downloadVideo(uri: string): Promise<Blob> {
  const encodedUri = encodeURIComponent(uri);
  const res = await this.fetch(`${VITE_PROXY_BASE}/api/gemini/downloadVideo?url=${encodedUri}`);
  if (!res.ok) throw new GeminiProxyError(res.status, `Download failed: ${res.statusText}`, {});
  return await res.blob();
}
```

### 5. UX loader — feedback visual

**Pedido del usuario:**
> "aprovechemso par mejroar la posicion del loader ahi no se ve muy bien porque no difuminas un poco el area de a iamgne y encima pones el cargador me entinedes?"

**Diseño:** El badge actual está flotando arriba del slot. El usuario quiere:
- Backdrop-blur sobre el área de la imagen (la `div` de `h-44` que contiene el thumbnail).
- Overlay centrado con spinner + texto "Generando clip con Veo 3.1… ~Xs".
- El textarea de intent y el análisis visual pueden quedar visibles abajo (no es necesario ocultarlos).

**Implementación:**

En `KeyframeStoryboard.tsx`, dentro del `div className="relative h-44 ... overflow-hidden ..."` que contiene la imagen:

```tsx
{kf?.blob && (
  <div className="absolute inset-0 ...">
    <img ... />
    {/* OVERLAY DURANTE GENERACIÓN */}
    {isGenerating && (
      <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-md flex flex-col items-center justify-center gap-3">
        <div className="loader-ring" style={{ width: 40, height: 40 }} />
        <p className="text-sm font-bold text-sky-300">
          Generando clip con Veo 3.1…
        </p>
        <p className="text-xs text-slate-400">
          ~{remainingSeconds}s
        </p>
      </div>
    )}
    <button className="absolute top-2 right-2 ...">Reemplazar</button>
  </div>
)}
```

Donde `isGenerating` se calcula leyendo el job de `generationJobs` para la transición saliente, y `remainingSeconds` se calcula con `max(10, min(180, 90 - elapsedSec))`.

Esto **reemplaza** al `GenerationProgressBadge` actual que está debajo del status. El badge podría ocultarse cuando hay overlay visual (o mantenerse para contexto — decisión: mantenerlo en el header pero quitar el texto redundante del overlay, solo dejar spinner grande + tiempo).

**Decisión:** mantener el `GenerationProgressBadge` simple (solo el tiempo restante en texto pequeño abajo) y agregar el overlay backdrop-blur como elemento principal. Esto da doble feedback: visual (overlay) y textual (badge).

### 6. Tests

#### Worker
- Test E2E (mockeando Gemini): POST `/api/gemini/generateVideo` con body shape nuevo → debe llamar a `/models/veo-3.1-generate-preview:predictLongRunning`.
- Test ruta `downloadVideo`: GET con `url` válida → debe hacer fetch y devolver blob. URL no-Google → 400.

#### Cliente
- `generateTransitionWithRetry` con mock del cliente → debe enviar body shape correcto.
- `extractVideoFromOperation` con respuesta mock de Veo 3.1 → debe extraer URI correctamente.
- Polling: con `done: true` y `response.generateVideoResponse.videos[0].uri` → debe llamar `downloadVideo`.

#### Componente
- `KeyframeSlotView` con `isGenerating=true` → renderiza overlay con backdrop-blur y spinner.
- `KeyframeSlotView` con `isGenerating=false` → no renderiza overlay.

### 7. Validar y commitear

```bash
pnpm typecheck
pnpm test --run
git add <archivos específicos>
git commit -m "fix(veo): usar predictLongRunning + instances[] body shape + descarga de URI + UX loader overlay"
git push origin main
```

Después del push:
```bash
# Verificar deploy Worker (wrangler)
cd worker && npx wrangler deploy
# Verificar deploy Vercel (auto)
curl -sS https://production-studio-gamma.vercel.app/
```

## Restricciones
- NO cambiar el comportamiento del resto de rutas del Worker (Vision, Image, TTS).
- NO romper el contrato del cliente `geminiClient.generateVideo` — debe seguir siendo el método público, solo cambia el body interno.
- NO agregar dependencias npm.
- NO pedir qodo (sunset). Self-review manual.
- El overlay debe ser accesible: `role="status"` + `aria-live="polite"` para screen readers.

## Pendientes v1.1 (no incluidos)
- AbortSignal para cancelación de jobs.
- Persistencia de videoBlob en IDB.
- Topología AIDA correcta.
- Feedback de reintentos en badge.

## Cierre
- ID: `ARCH-20260704-11`
- Pendiente: delegación a SOFIA, auditoría GEMINI, deploy.