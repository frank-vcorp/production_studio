# SPEC — Localización al español + Indicadores de carga (análisis / clip)

**ID:** `ARCH-20260704-09`
**Fecha:** 2026-07-04
**Origen:** Feedback directo del usuario en sesión:
> "hay algo que quiero que cambies, quiero todos los prompts y analisis en español y quiero indicadores de cargar de analisis o de finalizacion de analisis al igual que de generacion de clip"

## Contexto

El sistema tiene un modelo AIDA narrativo en español (UI, toasts, labels), pero los **prompts enviados a Gemini** mezclan español e inglés (palabras clave de Vision, secciones de Veo), y **carece de indicadores de carga explícitos** para dos procesos largos:

1. Análisis de imagen con Gemini Vision (5-15 s típico, 30+ s en colas saturadas).
2. Generación de clip con Veo 3.1 (60-180 s típico, hasta 5 min de timeout).

El usuario solo ve toasts volátiles que desaparecen en 3 s. Si se distrae, no sabe si la app está trabajando o se congeló.

## Objetivos

1. **Lenguaje consistente en español** para todos los prompts (Vision, Veo, Imagen 3, TTS) y los textos de análisis visualizados en la UI.
2. **Indicadores de carga persistentes y visibles** durante análisis y generación de clip, con estados explícitos "iniciado → progreso → completado" o "falló".
3. **Cero impacto en producción** para usuarios que ya tienen el flujo funcionando: no romper toasts existentes, no cambiar contratos de tipos, no agregar dependencias.

## No-objetivos (fuera de alcance v1.0.3)

- Cambiar idioma de la UI a otros idiomas (i18n completo).
- Streaming de progreso de Veo (la API no lo soporta).
- Persistir el estado "analyzing" entre recargas (IDB migration).
- Traducir nombres de campos de Gemini (ej. `subject`, `environment` son labels JSON, no strings de usuario).

---

## Auditoría del estado actual

### A. Prompts y análisis

| Archivo | Idioma actual | Acción |
|---|---|---|
| `src/services/promptBuilder.ts` | **Mezclado** (español narrativo + palabras clave en inglés: "Camera:", "Brand voice:", "DoF", "slow-motion (24fps)", "fast energetic") | Convertir TODO el output a español consistente, mantener nombres de tokens Gemini reconocibles solo cuando sean IDs (ej. "9:16", "veo-3.1"). |
| `src/services/gemini/imageAnalysis.ts` `VISION_PROMPT` | **Español** pero los labels JSON son inglés (`subject`, `environment`, `lighting`...) | Mantener los labels JSON en inglés (contrato con Gemini Vision) pero agregar instrucción explícita "responde todos los valores en español". |
| `src/services/gemini/imageAnalysis.ts` `model: 'gemini-2.5-pro-vision'` | **Incorrecto** — ese modelo no existe | El Worker ya usa `gemini-2.5-flash`. Actualizar el campo `model` en `VisualAnalysis` para reflejar el modelo real. |
| `src/services/gemini/imageAnalysis.ts` `validateAnalysis` | Strings de error en inglés | Traducir a español. |
| `src/services/gemini/video.ts` errores | Mezcla español/inglés | Estandarizar a español. |
| `src/services/promptBuilder.ts` `buildTTSPrompt` | `languageCode: 'es-MX'` ya está bien | Sin cambios. |

### B. Indicadores de carga — gaps detectados

| Proceso | Estado actual | Gap |
|---|---|---|
| Análisis de imagen (auto al subir) | Solo toast `info: "Analizando ${role} con Gemini Vision..."` → `success: "${role} analizada"` | No hay spinner persistente. Si el toast se cierra (3 s) o el usuario scrollea, no sabe si terminó. |
| Análisis manual (botón "Analizar") | Mismo toast | Mismo problema. |
| Generación de clip (PromptApprovalGate) | Botón "Aprobar y generar" con `loading={generating}` | ✅ Tiene spinner, pero solo en el botón. No hay indicador de cuánto falta (~2 min). |
| Generación de clip (status `generating` en transición) | `STATUS_LABEL.generating = 'Generando'` | Solo cambia el badge de color. No hay spinner ni ETA. |

---

## Diseño

### 1. Localización de prompts (`promptBuilder.ts`)

**Principio:** "Idioma de salida = español. Términos técnicos conservados solo cuando son identificadores únicos (formatos, modelos, números)."

#### `buildCameraMovement(spec)`
```diff
- return [
-   `Camera: ${spec.movement}, ${spec.framing}, ${spec.angle}, ${speedMap[spec.speed]}.`,
- ].join('');
+ return [
+   `Movimiento de cámara: ${spec.movement}, encuadre ${spec.framing}, ángulo ${spec.angle}, ${speedMapEs[spec.speed]}.`,
+ ].join('');
```
- `speedMap` traducido: `slow → cámara lenta (24fps)`, `medium → ritmo estable`, `fast → energía rápida`.

#### `buildKeyframeTransitionPrompt`
- Reemplazar "Camera:" por "Movimiento de cámara:".
- Reemplazar "Brand voice:" por "Tono de marca:".
- Reemplazar "Intención humana:" (ya está) — mantener.
- Reemplazar "Duración objetivo: ~N segundos. Aspecto 9:16." por "Duración objetivo: ~N segundos. Formato vertical 9:16 (1080×1920).".
- Reemplazar "correspondiente al nodo X del modelo AIDA." por "correspondiente al nodo «X» del modelo AIDA (Attention / Interest / Desire / Action).".

#### `buildImage3Prompt`
- Mantener "GENERA una imagen..." en mayúsculas (es regla para Imagen 3).
- "Estilo marca:" (ya estaba bien).
- "Salida 9:16 vertical..." → "Salida en formato vertical 9:16 (1080×1920)...".

#### `buildTTSPrompt`
- Sin cambios (idioma ya correcto, no es un prompt narrativo).

### 2. Localización de Vision (`imageAnalysis.ts`)

#### `VISION_PROMPT` — agregar regla de idioma
```diff
  REGLAS:
  - Describe SOLO lo que ves. NO inventes elementos.
+ - Responde TODOS los valores de texto en español (subject, environment, lighting, composition, cameraPosition, technicalNotes, dominantShapes, textures).
+ - Los nombres de campos (keys del JSON) se mantienen en inglés, pero los valores (values) van en español.
```

#### `model` field
- Worker ya usa `gemini-2.5-flash`. Cambiar:
  ```ts
  model: 'gemini-2.5-flash',  // antes: 'gemini-2.5-pro-vision'
  ```
- Actualizar también `src/types/keyframe.ts` (línea 54) y `src/__tests__/promptBuilder.test.ts` (línea 39) y `src/__tests__/projectStore.test.ts` (línea 134) si son tests que asertan ese string.

#### `validateAnalysis` — errores en español
- `'Vision body is not an object'` → `'La respuesta de Vision no es un objeto válido'`
- `'Vision schema incomplete'` → `'El esquema de Vision está incompleto'`
- `'Vision: colorPalette requerido'` → `'Vision: la paleta de colores es obligatoria'`

### 3. Localización de errores de Veo (`video.ts`)

- `'La transición requiere prompt aprobado'` (ya está) ✅
- `'Keyframe origen sin base64'` (ya está) ✅
- `'Transición sin prompt'` (ya está) ✅
- `'Veo polling timeout'` → `'Tiempo de espera agotado mientras Veo generaba el clip'`
- `'Operation not done yet'` → `'La operación de Veo aún no ha terminado'`
- `'Veo response without videos'` → `'Veo no devolvió ningún video en la respuesta'`
- `'URL-only videos not supported in S1; require inline data'` → `'Videos solo con URL no soportados en esta versión; se requieren datos embebidos'`
- `'Video has neither inline nor uri'` → `'El video de Veo no contiene datos embebidos ni URL'`
- `'Transition not approved'` → `'La transición no está aprobada'`
- `'Max retries exceeded'` → `'Se agotaron todos los reintentos'`
- `console.warn` y `console.log` de retry: traducir a español.

### 4. Indicadores de carga persistentes

**Decisión arquitectónica:** Usar el store de proyecto como fuente de verdad. Agregar dos estados efímeros `analysisJobs: Map<string, AnalysisJob>` y `generationJobs: Map<string, GenerationJob>`. NO persistir en IDB (efímero por diseño).

#### Tipos nuevos (`src/types/jobs.ts` o `src/types/project.ts`)

```ts
export type AnalysisState = 'idle' | 'analyzing' | 'done' | 'failed';
export type AnalysisJob = {
  keyframeId: string;
  state: AnalysisState;
  startedAt?: number;
  finishedAt?: number;
  errorMessage?: string;
};

export type GenerationState = 'idle' | 'generating' | 'done' | 'failed';
export type GenerationJob = {
  transitionId: string;
  state: GenerationState;
  startedAt?: number;
  finishedAt?: number;
  attempts?: number;
  etaSeconds?: number;
  errorMessage?: string;
};
```

#### Store (`projectStore.ts`)

Agregar a `ProjectState`:
```ts
analysisJobs: Map<string, AnalysisJob>;
generationJobs: Map<string, GenerationJob>;
startAnalysisJob(keyframeId: string): void;
finishAnalysisJob(keyframeId: string, ok: boolean, error?: string): void;
startGenerationJob(transitionId: string): void;
finishGenerationJob(transitionId: string, ok: boolean, error?: string, attempts?: number): void;
```

`partialize` (persistencia IDB): **excluir** ambos Maps. Si ya existe `partialize`, agregar las keys a `partialize` exclusion list.

#### UI

**Componente nuevo:** `src/components/storyboard/AnalysisProgressBadge.tsx`
- Props: `keyframeId: string`.
- Lee `analysisJobs.get(keyframeId)` del store.
- Render:
  - `state === 'analyzing'` → spinner `loader-ring` + texto "Analizando con Gemini Vision…"
  - `state === 'done'` → check verde + texto "Análisis listo" (auto-clear a los 2 s)
  - `state === 'failed'` → ícono de error + texto "Falló: {errorMessage}"
  - `state === 'idle' | undefined` → null
- Se monta dentro de `KeyframeSlotView` debajo del `STATUS_LABEL`.

**Componente nuevo:** `src/components/generation/GenerationProgressBadge.tsx`
- Props: `transitionId: string`, `keyframeId: string` (para mostrar contexto).
- Lee `generationJobs.get(transitionId)` del store.
- Render:
  - `state === 'generating'` → spinner + "Generando clip con Veo 3.1…" + ETA estimado dinámico basado en `(now - startedAt) / 1000` con cap de 180 s
  - `state === 'done'` → check verde + "Clip listo" (auto-clear 3 s)
  - `state === 'failed'` → ícono error + "Falló: {errorMessage}" + botón "Reintentar"
- Se monta en `KeyframeSlotView` al pie de las acciones (solo si `outgoing?.id === transitionId`).

**Modificaciones a `KeyframeStoryboard.tsx`:**
- `onPickFile`: llamar `startAnalysisJob(kf_${role})` antes del `analyzeImageForVeo`. Al terminar OK, `finishAnalysisJob(kf_${role}, true)`. En catch, `finishAnalysisJob(kf_${role}, false, error.message)`.
- `handleAnalyze` (botón manual): mismo patrón con `startAnalysisJob` / `finishAnalysisJob`.
- Render condicional de `AnalysisProgressBadge` debajo del `STATUS_LABEL`.

**Modificaciones a `PromptApprovalGate.tsx` y `SplitViewHost.tsx`:**
- En `handleApprove`, llamar `startGenerationJob(transition.id)`.
- En `try/catch`, llamar `finishGenerationJob(transition.id, ok, error.message)`.
- El badge `GenerationProgressBadge` se renderiza automáticamente desde `KeyframeSlotView` (no requiere cambios en el gate).

#### ETA dinámico (simulación)

```ts
// En GenerationProgressBadge:
const elapsedSec = Math.floor((Date.now() - job.startedAt) / 1000);
// Veo típico 60-120s, cap 180s, mínimo 10s mostrado
const remainingSec = Math.max(10, Math.min(180, 90 - elapsedSec));
// O más simple: "Generando... ~Xs" donde X = max(10, 90 - elapsed)
```

### 5. No-regresiones explícitas

- **NO** cambiar el contrato de `VisualAnalysis` (los keys del JSON devuelto por Vision siguen en inglés porque eso es lo que parsea el validador).
- **NO** cambiar la lógica del `IntentTextarea` ni el debounce.
- **NO** cambiar `canGenerateClip`, `showApproveBtn`, `needsAnalysis` (deben seguir basándose en `status` del keyframe y `outgoing.status` de la transición).
- **NO** agregar dependencias npm.
- **NO** migrar el IDB schema (los nuevos Maps son efímeros).

---

## Plan de implementación

1. **SPEC creada** → este documento.
2. Delegar a **SOFIA** con handoff completo.
3. **GEMINI** como segunda mano de validación.
4. **Validar**: `pnpm typecheck` + `pnpm test --run`.
5. **Commit + push** a `main`.
6. Verificar auto-deploy Vercel.
7. **Micro-demo** al usuario: subir imagen → ver badge "Analizando con Gemini Vision…" → ver "Análisis listo" → aprobar prompt → ver "Generando clip con Veo 3.1… ~Xs".

---

## Tests requeridos

1. `src/services/__tests__/promptBuilder.test.ts` — actualizar aserciones para español:
   - `buildCameraMovement` retorna "Movimiento de cámara:..." no "Camera:".
   - `buildKeyframeTransitionPrompt` no contiene substrings en inglés ("Brand voice", "Camera:").
   - `buildImage3Prompt` mantiene mayúsculas "GENERA" (regla Imagen 3) y el resto en español.

2. `src/services/__tests__/imageAnalysis.test.ts` (si no existe, crear) — verificar:
   - `model: 'gemini-2.5-flash'` (no `'gemini-2.5-pro-vision'`).
   - `validateAnalysis` lanza errores en español para casos inválidos.

3. `src/stores/__tests__/projectStore.test.ts` — agregar:
   - `startAnalysisJob` y `finishAnalysisJob` modifican `analysisJobs` correctamente.
   - `partialize` NO incluye `analysisJobs` ni `generationJobs` (verificar que no se serializan a IDB).
   - `startGenerationJob` y `finishGenerationJob` similar.

4. `src/components/__tests__/AnalysisProgressBadge.test.tsx` (nuevo) — verificar render de los 4 estados.

5. `src/components/__tests__/GenerationProgressBadge.test.tsx` (nuevo) — verificar render + ETA dinámico.

---

## Riesgos y mitigación

| Riesgo | Mitigación |
|---|---|
| Gemini Vision devuelve campos en inglés a pesar del prompt en español | El validador `validateAnalysis` ya garantiza que los strings cumplen longitudes mínimas; agregar un check opcional de que contengan al menos un carácter no-ASCII (palabra con tilde/ñ). Si falla, retry con instrucción reforzada. |
| ETA dinámico es impreciso | Mostrar rango "~60-180s" en lugar de un número exacto. |
| Badge interfiere con el flujo si el usuario sube otra imagen mientras analiza | `startAnalysisJob` resetea el job existente (sobrescribe `startedAt`). |
| Cambio de `model: 'gemini-2.5-pro-vision'` → `gemini-2.5-flash` rompe aserciones | Actualizar todos los tests en el mismo commit. |
| Mapas nuevos en el store rompen `partialize` (IDB migration) | Verificar `partialize` exclude explícito; IDB sigue cargando la versión anterior sin estos campos. |

---

## Cierre

- ID: `ARCH-20260704-09`
- SPEC firmada por: INTEGRA
- Pendiente: delegación a SOFIA, auditoría GEMINI, deploy, demo.
