# SPEC — Fix error msg "[object Object]" en Vision + overlay blur para análisis (igual que video)

**ID:** `ARCH-20260705-03`
**Fecha:** 2026-07-05
**Origen:** Usuario reporta que ahora el análisis falla (después del fix de Veo). Smoke test del Worker:
```json
POST /api/gemini/analyzeImage → HTTP 429
{"error":{"code":429,"message":"Your prepayment credits are depleted..."}}
```

Y además pide: "el cargador del análisis haslo igual que el del video" (overlay con backdrop-blur sobre la imagen).

## Causa raíz (2 issues)

### Issue 1: Mensaje de error genérico "[object Object]" en cliente HTTP

En `src/services/gemini/client.ts:83-94`:
```ts
if (!res.ok) {
  const errBody = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  const message = String(errBody.error ?? `HTTP ${res.status}`);
  ...
  throw new GeminiProxyError(res.status, message, errBody);
}
```

Cuando el body del Worker es:
```json
{"error": {"code": 429, "message": "Your prepayment credits...", "status": "RESOURCE_EXHAUSTED"}}
```

`errBody.error` es un **objeto**, no un string. `String({...})` produce `"[object Object]"`.

**Fix:** extraer `errBody.error.message` si `errBody.error` es un objeto:
```ts
function extractErrorMessage(errBody: Record<string, unknown>): string {
  const e = errBody.error;
  if (typeof e === 'string') return e;
  if (e && typeof e === 'object') {
    const obj = e as { message?: string; code?: number; status?: string };
    return obj.message ?? `HTTP ${obj.code ?? 'error'}`;
  }
  return `Error desconocido`;
}
```

Aplicar tanto en `request()` (línea 85) como en `downloadVideo()` (línea 168).

### Issue 2: UX del análisis — el usuario quiere el mismo overlay que el de video

Actualmente `AnalysisProgressBadge` es un **badge pequeño** debajo del status (línea 18-22 de `KeyframeStoryboard.tsx`):
```tsx
<header>
  <h3>{label}</h3>
  <span className={STATUS_COLOR}>{STATUS_LABEL[status]}</span>
</header>
...
{kf && <AnalysisProgressBadge keyframeId={kf.id} />}
```

El usuario quiere:
> "el cargador del analisis haslo igual que el del video"

→ Overlay con `backdrop-blur-md` sobre el área de la imagen, spinner grande centrado, texto "Analizando con Gemini Vision…" + ETA, accesible (`role="status"` + `aria-live="polite"`).

## Cambios

### 1. `src/services/gemini/client.ts`

Aplicar fix de mensaje en `request()` y `downloadVideo()`:
- Importar o definir helper `extractErrorMessage(errBody)`.
- Usar en lugar de `String(errBody.error ?? \`HTTP ${res.status}\`)`.

### 2. `src/components/storyboard/AnalysisProgressBadge.tsx` — REFACTOR a overlay

Cambiar la firma y el render:

```tsx
interface Props {
  keyframeId: string;
  isOverlay?: boolean;  // si true, renderiza overlay absoluto (para uso sobre la imagen)
}

export function AnalysisProgressBadge({ keyframeId, isOverlay = false }: Props) {
  const job = useProjectStore((s) => s.analysisJobs.get(keyframeId));
  const finishAnalysisJob = useProjectStore((s) => s.finishAnalysisJob);

  useEffect(() => {
    if (!job || job.state !== 'done') return;
    const t = setTimeout(() => {
      useProjectStore.setState((s) => {
        const next = new Map(s.analysisJobs);
        next.delete(keyframeId);
        return { analysisJobs: next };
      });
      void finishAnalysisJob;
    }, 2000);
    return () => clearTimeout(t);
  }, [job, keyframeId, finishAnalysisJob]);

  if (!job) return null;

  // Modo overlay (igual que GenerationProgressBadge)
  if (isOverlay) {
    if (job.state === 'analyzing') {
      return (
        <div
          role="status"
          aria-live="polite"
          data-testid="analysis-overlay-analyzing"
          className="absolute inset-0 bg-slate-950/70 backdrop-blur-md flex flex-col items-center justify-center gap-3 z-10"
        >
          <div className="loader-ring" style={{ width: 40, height: 40 }} />
          <p className="text-sm font-bold text-sky-300">Analizando con Gemini Vision…</p>
        </div>
      );
    }
    if (job.state === 'done') {
      return (
        <div
          role="status"
          data-testid="analysis-overlay-done"
          className="absolute inset-0 bg-emerald-950/40 backdrop-blur-sm flex items-center justify-center z-10 pointer-events-none"
        >
          <div className="flex flex-col items-center gap-2">
            <i className="fa-solid fa-circle-check text-3xl text-emerald-300" />
            <p className="text-sm font-bold text-emerald-200">Análisis listo</p>
          </div>
        </div>
      );
    }
    if (job.state === 'failed') {
      return (
        <div
          role="alert"
          data-testid="analysis-overlay-failed"
          className="absolute inset-0 bg-rose-950/50 backdrop-blur-sm flex flex-col items-center justify-center gap-3 z-10 p-4"
        >
          <i className="fa-solid fa-circle-exclamation text-2xl text-rose-300" />
          <p className="text-xs text-rose-200 text-center">
            Falló: {job.errorMessage ?? 'error desconocido'}
          </p>
        </div>
      );
    }
    return null;
  }

  // Modo badge (legacy, mantener para no romper nada)
  // ... código actual ...
}
```

### 3. `src/components/storyboard/KeyframeStoryboard.tsx`

a. Cambiar el lugar de render del badge para que esté DENTRO del `<div className="relative h-44 ...">` del thumbnail:

```tsx
{kf?.blob && (
  <div className="relative h-44 rounded-xl overflow-hidden bg-slate-950 border border-dashed border-slate-800">
    <img ... />
    {kf?.blob && (
      <button className="absolute top-2 right-2 ...">Reemplazar</button>
    )}
    {/* NUEVO: overlay de análisis igual que el de video */}
    <AnalysisProgressBadge keyframeId={kf.id} isOverlay />
  </div>
)}
```

b. **Eliminar** el badge inline `{kf && <AnalysisProgressBadge keyframeId={kf.id} />}` debajo del header (si existía).

### 4. Tests

#### `src/__tests__/clientErrorMessage.test.ts` (nuevo)
- `extractErrorMessage({error: {message: "x", code: 429}})` → "x"
- `extractErrorMessage({error: "string error"})` → "string error"
- `extractErrorMessage({})` → "Error desconocido"
- `extractErrorMessage({error: {code: 500}})` → "HTTP 500"

#### `src/__tests__/AnalysisProgressBadge.test.tsx` (actualizar)
- Test: con `state: 'analyzing'` e `isOverlay: true` → renderiza overlay con backdrop-blur y spinner.
- Test: con `state: 'done'` e `isOverlay: true` → renderiza overlay verde.
- Test: con `state: 'failed'` e `isOverlay: true` → renderiza overlay rojo con mensaje.

### 5. Validar y commitear

```bash
cd production_studio
pnpm typecheck
pnpm test --run --reporter=basic
```

Si pasan:
```bash
git add src/services/gemini/client.ts src/components/storyboard/AnalysisProgressBadge.tsx src/components/storyboard/KeyframeStoryboard.tsx src/__tests__/*.ts  # solo archivos modificados
git status  # verificar
git commit -m "fix(vision): error message extraction + overlay blur para análisis (igual que video)"
git push origin main
```

**NO** requiere redeploy del Worker (cambios solo en cliente).

### 6. Smoke test post-deploy (Vercel, sin tocar Worker)

```bash
curl -sS -o /dev/null -w "Vercel: %{http_code}\n" https://production-studio-gamma.vercel.app/
```

## Restricciones
- NO cambiar el comportamiento del Worker.
- NO romper la firma actual de `AnalysisProgressBadge` — agregar `isOverlay` como prop opcional con default `false` (compatibilidad).
- NO agregar dependencias npm.
- NO pedir qodo (sunset). Self-review manual.

## Cierre
- ID: `ARCH-20260705-03`
- Pendiente: delegación a SOFIA, deploy.