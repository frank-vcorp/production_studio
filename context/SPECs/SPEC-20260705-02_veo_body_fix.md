# SPEC — Fix Veo body field `bytesBase64Encoded` + remover `personGeneration` + arreglar mensaje [object Object]

**ID:** `ARCH-20260705-02`
**Fecha:** 2026-07-05
**Origen:** Usuario reporta segundo intento de generación:
```
[VeoClient] Intento 1 falló: unknown [object Object]
HTTP 400
```

## Causa raíz (3 issues encadenados)

### 1. Body shape: campo de imagen incorrecto

El cliente envía:
```json
{
  "instances": [{
    "prompt": "...",
    "image": { "data": "<base64>", "mimeType": "image/png" }  // ❌ "data" no existe
  }],
  "parameters": { "durationSeconds": 4, "aspectRatio": "9:16", "personGeneration": "dont_allow" }
}
```

La API de Gemini Developer rechaza con:
> `"data" isn't supported by this model. Please remove it or refer to the Gemini API documentation for supported usage.`

**Correcto** (verificado con smoke test):
```json
{
  "instances": [{
    "prompt": "...",
    "image": { "bytesBase64Encoded": "<base64>", "mimeType": "image/png" }
  }],
  "parameters": { "durationSeconds": 4, "aspectRatio": "9:16" }
}
```

### 2. `personGeneration: "dont_allow"` no soportado en Veo 3.1 público

La API rechaza con:
> `dont_allow for personGeneration is currently not supported.`

Esto es solo válido en Vertex AI. En Gemini Developer API los valores son: `dont_allow` se omite (default), o `allow_adult`. **Decisión: omitir el campo completamente.** Para v1.1 considerar validar el contenido de la imagen con un moderation check antes de enviar.

### 3. Error UX: `[object Object]` en el toast/badge

El usuario ve "Falló: [object Object] Reintentar". Causa en `services/gemini/video.ts:122-126`:

```ts
export function classifyVeoError(err: unknown): VeoError {
  const e = err as { status?: number; message?: string; code?: string; details?: unknown };
  const status = typeof e?.status === 'number' ? e.status : 0;
  const message = String(e?.message ?? err ?? 'Unknown error');
```

Cuando el Worker responde 400 con body JSON `{error: {message: "..."}}`, el cliente recibe un objeto Error pero `e.message` es `undefined` (porque el mensaje real está en `e.body.error.message`). El fallback `String(err)` produce `"[object Object]"`.

**Fix:** extraer el mensaje del body JSON cuando esté disponible.

## Cambios

### 1. `src/services/gemini/video.ts`

a. **`startVideoGeneration(opts)`** — cambiar body:
   - `image.data` → `image.bytesBase64Encoded`
   - Eliminar `personGeneration` del body de parameters.

b. **`classifyVeoError(err)`** — mejorar extracción de mensaje:
   ```ts
   export function classifyVeoError(err: unknown): VeoError {
     const e = err as { status?: number; message?: string; code?: string; details?: unknown; body?: unknown };
     const status = typeof e?.status === 'number' ? e.status : 0;
     
     // Intentar extraer mensaje del body JSON estructurado
     let message = '';
     if (typeof e?.message === 'string' && e.message) {
       message = e.message;
     } else if (e?.body && typeof e.body === 'object') {
       const b = e.body as { error?: { message?: string }; message?: string };
       message = b.error?.message ?? b.message ?? '';
     } else if (typeof err === 'string') {
       message = err;
     }
     
     if (!message) {
       try {
         message = JSON.stringify(err);
       } catch {
         message = 'Error desconocido';
       }
     }
     // ...
   }
   ```

### 2. `src/types/gemini.ts`

Actualizar el tipo `GenerateVideoRequest`:
```ts
export interface GenerateVideoRequest {
  instances: Array<{
    prompt: string;
    image?: {
      bytesBase64Encoded: string;
      mimeType: string;
    };
  }>;
  parameters?: {
    durationSeconds?: number;
    aspectRatio?: '9:16' | '16:9' | '1:1';
    personGeneration?: 'allow_adult';  // dont_allow removido
    sampleCount?: number;
  };
}
```

### 3. `src/__tests__/geminiVideo.test.ts`

- Actualizar test de body shape para verificar `bytesBase64Encoded` (no `data`).
- Agregar test: `classifyVeoError` con `{status: 400, body: {error: {message: "x"}}}` → message = "x".
- Agregar test: `classifyVeoError` con `{status: 400, body: {error: {message: "..."}}}` → no devuelve "[object Object]".

### 4. Validar

```bash
pnpm typecheck
pnpm test --run
```

### 5. Commit + push + redeploy Worker

```bash
git add src/services/gemini/video.ts src/types/gemini.ts src/__tests__/geminiVideo.test.ts
git commit -m "fix(veo): bytesBase64Encoded + remover personGeneration dont_allow + error message extraction"
git push origin main
cd worker && npx wrangler deploy
```

### 6. Smoke test post-deploy

```bash
# Verificar que el endpoint sigue funcionando con el body nuevo
curl -X POST "https://bridge-gemini-proxy.vectoria-pstudio.workers.dev/api/gemini/generateVideo" \
  -H "Content-Type: application/json" \
  -d '{
    "instances": [{"prompt": "smoke test", "image": {"bytesBase64Encoded": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "mimeType": "image/png"}}],
    "parameters": {"durationSeconds": 4, "aspectRatio": "9:16"}
  }'
```

Debe devolver 200 con `{"name": "models/veo-3.1-generate-preview/operations/..."}`.

## Restricciones
- NO cambiar el comportamiento de Vision/Image/TTS.
- NO agregar dependencias npm.
- NO pedir qodo (sunset). Self-review manual.

## Cierre
- ID: `ARCH-20260705-02`
- Pendiente: delegación a SOFIA, deploy Worker, smoke test.