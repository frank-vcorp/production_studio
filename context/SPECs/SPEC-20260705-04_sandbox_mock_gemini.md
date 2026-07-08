# SPEC — Sandbox/Mock local para Gemini API (Veo + Vision + Imagen 3) + defensa de costo

**ID:** `ARCH-20260705-04`
**Fecha:** 2026-07-05
**Origen:** Usuario confirma que gastó ~$111 MXN sin haber logrado generar un solo clip funcional. Necesitamos un **sandbox determinista** para validar flujos end-to-end antes de gastar créditos reales.

## Contexto

La plataforma ya pasó por 4 ciclos de fix (commit `e853e7e`, `59ed255`, `61087af`, etc.) cada uno requiriendo llamadas reales a Gemini API para verificar. El usuario terminó pagando ~$5.50 USD de llamadas fallidas. **Esto no escala** y bloquea el desarrollo porque:
1. Cada test E2E manual cuesta dinero.
2. Los créditos prepagos tienen cap mensual ($100 MXN).
3. La API tiene rate limits (10 RPD por modelo).
4. No hay forma de validar la UX de carga (overlays, ETAs, errores) sin gastar API calls.

## Objetivo

**Sandbox local determinista** que:
- Simule Vision, Imagen 3 y Veo 3.1 con fixtures locales (sin red, sin costo).
- Sea activable por variable de entorno (`VITE_USE_SANDBOX=true`).
- Tenga los mismos interfaces públicos que los servicios reales (drop-in replacement).
- Incluya latencias simuladas para validar UX (overlays, ETAs).
- Mantenga fallback a producción cuando se apague (`VITE_USE_SANDBOX=false`).

**Defensa en profundidad** (incluso con sandbox activo):
- Reducir reintentos de 5 a 2 (default más conservador).
- Modal de costo antes de cada generación real (cuando sandbox esté off).

## Diseño

### 1. Capa de abstracción

Hoy el código llama directo a `services/gemini/video.ts`, `imageAnalysis.ts`, `keyframeGenerator.ts`. Estos internamente usan `geminiClient` (fetch al proxy).

**Cambio mínimo**: agregar un switch al inicio de cada servicio que detecte `VITE_USE_SANDBOX` y rutee al mock local en lugar de al `geminiClient`.

```ts
// src/services/gemini/imageAnalysis.ts
export async function analyzeImageForVision(blob: Blob): Promise<VisualAnalysis> {
  if (import.meta.env.VITE_USE_SANDBOX === 'true') {
    return mockAnalyzeImageForVision(blob);
  }
  // ... código real ...
}
```

### 2. Mock services

#### `src/services/sandbox/mockVision.ts`

```ts
export async function mockAnalyzeImageForVision(blob: Blob): Promise<VisualAnalysis> {
  // Latencia simulada: 2-5 segundos
  await sleep(2000 + Math.random() * 3000);
  
  // Generar análisis determinista basado en el hash del blob
  const hash = await blobHash(blob);
  return {
    subject: `[SANDBOX] Sujeto simulado (hash ${hash.slice(0, 8)})`,
    environment: 'Entorno simulado de prueba',
    lighting: 'Iluminación neutra simulada',
    composition: 'Composición centrada de prueba',
    colorPalette: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'],
    textures: ['textura simulada A', 'textura simulada B'],
    cameraPosition: 'frontal a nivel de ojos',
    depthOfField: 'medium',
    dominantShapes: ['rectángulo', 'círculo'],
    technicalNotes: 'Análisis generado por sandbox local (sin API)',
    analyzedAt: Date.now(),
    model: 'sandbox-vision-v1',
    confidence: 0.95,
  };
}
```

#### `src/services/sandbox/mockVideo.ts`

```ts
// Generador de video dummy sin red
// Usa canvas + MediaRecorder o devuelve un MP4 estático embebido

export async function mockGenerateVideo(opts: GenerateOpts): Promise<{ blob: Blob; url: string; operationId: string }> {
  // Simular latencia de polling: 3-8 segundos total
  const totalLatency = 3000 + Math.random() * 5000;
  await sleep(totalLatency);
  
  // Generar un MP4 dummy (frame estático del fromKf + texto "SANDBOX VIDEO")
  const blob = await generateDummyMp4(opts.fromKframe.blob, opts.transition.prompt);
  const url = URL.createObjectURL(blob);
  const operationId = `sandbox-ops-${Date.now()}`;
  
  return { blob, url, operationId };
}
```

Para generar el MP4 dummy, dos opciones:
- **A) WebCodecs API** (Chromium-based, moderno): genera MP4 real en cliente.
- **B) Devolver un PNG animado** (fallback): muestra el thumbnail + texto overlay como "video simulado".

**Recomendación: opción B** (más simple, suficiente para validar UX).

```ts
async function generateDummyMp4(fromImage: Blob, prompt: string): Promise<Blob> {
  // Crear un canvas, dibujar la imagen from + texto overlay, exportar como blob
  const bitmap = await createImageBitmap(fromImage);
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0);
  ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
  ctx.fillRect(0, 0, bitmap.width, 80);
  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText('SANDBOX VIDEO — No es un clip real', 20, 50);
  ctx.fillStyle = '#94a3b8';
  ctx.font = '14px monospace';
  ctx.fillText(`prompt: ${prompt.slice(0, 60)}...`, 20, 75);
  
  // Convertir canvas a blob
  return await canvas.convertToBlob({ type: 'image/png' });
}
```

(Ojo: el nombre dice `Mp4` pero devuelve PNG. Es OK porque el store solo guarda el blob y la URL; el tipo MIME puede ser image/png sin romper nada para el sandbox. El usuario entiende que es simulado.)

#### `src/services/sandbox/mockImageGen.ts`

```ts
export async function mockGenerateImage(prompt: string, opts: GenerateImageOpts): Promise<{ blob: Blob; mimeType: string }> {
  await sleep(2000 + Math.random() * 2000);
  
  // Generar PNG con gradiente + texto del prompt
  const canvas = new OffscreenCanvas(512, 512);
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, 512, 512);
  grad.addColorStop(0, '#1e293b');
  grad.addColorStop(1, '#0ea5e9');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 28px sans-serif';
  ctx.fillText('SANDBOX', 180, 250);
  ctx.font = '14px monospace';
  ctx.fillText(prompt.slice(0, 40), 20, 490);
  
  const blob = await canvas.convertToBlob({ type: 'image/png' });
  return { blob, mimeType: 'image/png' };
}
```

### 3. Variables de entorno

En `vite.config.ts` o `.env.local`:

```bash
# .env.development (default dev: sandbox activo)
VITE_USE_SANDBOX=true

# .env.production (default prod: real API)
VITE_USE_SANDBOX=false
```

Vite ya soporta estos archivos. Solo agregar al `.env.development` que el usuario probablemente ya tiene.

Para que sea fácil activar en producción sin redeployar código: agregar un toggle en el header (dev only).

### 4. Modal de costo pre-generación (defensa)

En `PromptApprovalGate.tsx`, antes de llamar `generateTransition`, mostrar un modal si NO es sandbox:

```tsx
const [showCostModal, setShowCostModal] = useState(false);
const isSandbox = import.meta.env.VITE_USE_SANDBOX === 'true';

const handleApprove = async () => {
  if (!draft.trim()) { ... }
  
  if (!isSandbox) {
    setShowCostModal(true);
    return;  // Espera confirmación
  }
  
  // ... continuar con la generación ...
};

const handleConfirmCost = async () => {
  setShowCostModal(false);
  // ... continuar con la generación ...
};
```

El modal muestra:
```
⚠️ Costo estimado de generación
Esta acción consumirá créditos de Gemini API:
• Clip Veo 3.1 (8s, 9:16): ~$0.40 USD (~$8 MXN)
• Reintentos en caso de error: hasta $1.60 USD adicional
• Total máximo: ~$2.00 USD (~$40 MXN)

Gasto diario actual: $X MXN (estimado)

[Cancelar] [Aprobar y gastar]
```

### 5. Reducir reintentos

En `src/services/gemini/video.ts:119`:
```ts
// Antes: export const RETRY_DELAYS_MS = [1000, 2000, 4000, 8000, 16000] as const;
// Ahora:
export const RETRY_DELAYS_MS = [1000, 4000] as const; // 2 intentos: 1s, 4s
```

Esto reduce el costo máximo por fallo de $2.00 a $0.80 USD.

### 6. Indicador visible de modo sandbox

En el header, mostrar un badge amarillo cuando `VITE_USE_SANDBOX === 'true'`:

```tsx
{import.meta.env.VITE_USE_SANDBOX === 'true' && (
  <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-1 rounded text-[10px] font-bold uppercase">
    🧪 Sandbox
  </span>
)}
```

Para que el usuario SIEMPRE sepa si está gastando dinero o no.

### 7. Tests

- `src/services/sandbox/__tests__/mockVision.test.ts`: verifica que devuelve `VisualAnalysis` con campos esperados.
- `src/services/sandbox/__tests__/mockVideo.test.ts`: verifica que devuelve blob + url + operationId.
- `src/services/sandbox/__tests__/toggle.test.ts`: verifica que el toggle funciona (mock vs real).
- Test E2E (manual): con `VITE_USE_SANDBOX=true`, el flujo completo debe funcionar sin gastar API calls.

## Plan de implementación

1. Crear `src/services/sandbox/` con los 3 mocks.
2. Agregar switch `VITE_USE_SANDBOX` en cada servicio (`imageAnalysis.ts`, `video.ts`, `keyframeGenerator.ts`).
3. Reducir `RETRY_DELAYS_MS` de 5 a 2.
4. Agregar modal de costo en `PromptApprovalGate.tsx`.
5. Agregar badge "Sandbox" en el header.
6. Tests + commit + push.
7. Verificar que el flujo end-to-end funciona sin gastar un centavo.

## Restricciones
- NO cambiar el comportamiento de producción (`VITE_USE_SANDBOX=false` debe seguir igual que ahora).
- NO agregar dependencias npm.
- NO pedir qodo (sunset). Self-review manual.
- El badge "Sandbox" debe ser **bien visible** para que el usuario NUNCA confunda sandbox con producción.

## Cierre
- ID: `ARCH-20260705-04`
- Pendiente: delegación a SOFIA, deploy, smoke test con sandbox activo.