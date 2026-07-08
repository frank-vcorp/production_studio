# SPEC — Wire generateTransition al jobQueue real (fix bug "no genera video")

**ID:** `ARCH-20260704-10`
**Fecha:** 2026-07-04
**Origen:** Usuario reporta que al hacer clic en "Aprobar y generar" en el Prompt Approval Gate:
- El modal se cierra ✅
- El badge "Generando clip con Veo 3.1… ~Xs" NO aparece ❌
- No se genera ningún video ❌
- No hay error toast ❌
- Console muestra `[Bridge] v1.0.0-worker-ok` repetido (worker responde, pero no se llama desde el flujo)

## Causa raíz

`src/stores/projectStore.ts:446-459` — `generateTransition(transitionId)` es un **stub desde S1** que solo cambia el status de la transición a `'generating'` y termina. NO encola ningún job.

```ts
generateTransition: async (transitionId: string) => {
  // ...validaciones...
  set((s) => {
    // ...set status: 'generating'...
  });
  // ← FALTA: encolar job al jobQueue
  // ← FALTA: retornar promesa que se resuelve cuando el job termina
},
```

El comentario en `PromptApprovalGate.tsx:79-81` confirma el stub:
> "Tras aprobar, simulamos la generación: en S1 el cliente llama Veo vía service. Para evitar bloquear el flujo cuando no hay API key, dejamos el estado en 'generating' y el caller integrará el resultado cuando vuelva."

La generación real de Veo solo se invoca desde `src/components/generation/tabs/MasterTab.tsx:226` cuando el usuario hace clic en "Generar master" (ensamblado de clips), NO desde el flujo de aprobación de prompt.

## Por qué el badge "Generando clip con Veo 3.1…" SÍ debería aparecer

`PromptApprovalGate.tsx:74` llama `startGenerationJob(transition.id)` ANTES del `await generateTransition(...)`. Esto debería:
1. Crear entrada en `generationJobs` con `state: 'generating'`, `startedAt: Date.now()`.
2. El badge `GenerationProgressBadge` se suscribe al store y lee `generationJobs.get(transitionId)`.
3. Si el job existe con `state: 'generating'`, el badge renderiza.

Pero el usuario reporta que el badge NO aparece. Hipótesis:
- **H1**: `startGenerationJob` se ejecuta pero el componente `KeyframeSlotView` no re-renderiza porque no está suscrito al slice `generationJobs` correctamente. (POCO probable, Zustand selectores deberían funcionar).
- **H2**: El componente `KeyframeSlotView` SÍ se renderiza pero la condición `{outgoing && ...}` falla porque `outgoing` es null en ese slot. (POSIBLE).
- **H3**: El job se setea pero el componente no lee del store correctamente. (REVISAR).

Independientemente del badge, **el problema crítico es que no se genera video**. El badge es síntoma secundario.

## Solución

Hacer que `projectStore.generateTransition(transitionId)` encole un job real al `jobQueue` que ejecute `generateTransitionWithRetry` de `services/gemini/video.ts`, y retorne una promesa que se resuelve cuando el job termina (éxito o fallo).

### Diseño

```ts
generateTransition: async (transitionId: string) => {
  const transition = get().transitions.get(transitionId);
  if (!transition) throw new Error('Transición no existe');
  if (transition.status !== 'approved') {
    throw new Error('La transición requiere prompt aprobado antes de generar');
  }
  
  const fromKf = get().keyframes.get(transition.fromKeyframe);
  const toKf = get().keyframes.get(transition.toKeyframe);
  if (!fromKf || !toKf) {
    throw new Error('Faltan keyframes para la transición');
  }
  
  // Set status: generating
  set((s) => {
    const cur = s.transitions.get(transitionId);
    if (!cur) return s;
    const next = new Map(s.transitions);
    next.set(transitionId, { ...cur, status: 'generating' });
    return { transitions: next };
  });
  
  // Encolar job real
  return new Promise<void>((resolve, reject) => {
    const jobId = jobQueue.enqueue({
      kind: 'video_generation',
      payload: { transitionId },
      run: async (signal) => {
        const result = await generateTransitionWithRetry(
          transition,
          fromKf,
          toKf,
          (attempt, elapsed) => {
            // Opcional: actualizar generationJobs con attempts
            get().setGenerationJobAttempts?.(transitionId, attempt, elapsed);
          },
          signal,
        );
        // Guardar resultado en la transición
        set((s) => {
          const cur = s.transitions.get(transitionId);
          if (!cur) return s;
          const next = new Map(s.transitions);
          next.set(transitionId, {
            ...cur,
            status: 'done',
            videoBlob: result.blob,
            videoUrl: result.url,
            veoOperationId: result.operationId,
            generatedAt: Date.now(),
          });
          return { transitions: next };
        });
      },
      onSuccess: () => resolve(),
      onError: (err) => {
        set((s) => {
          const cur = s.transitions.get(transitionId);
          if (!cur) return s;
          const next = new Map(s.transitions);
          next.set(transitionId, { ...cur, status: 'failed', errorMessage: err.message });
          return { transitions: next };
        });
        reject(err);
      },
    });
  });
},
```

### Consideraciones

1. **`jobQueue` ya existe** (`src/services/jobQueue.ts`) y se usa desde `MasterTab.tsx` y `job.worker.ts`. Usar la misma abstracción.
2. **No romper `MasterTab`**: verificar que sigue usando el `generateTransition` de `services/gemini/video.ts` directamente, no el del store. (Esto es así según el código actual — el store solo se llama desde el prompt gate y `SplitViewHost`).
3. **`abort`**: si el usuario navega fuera o recarga, el job debe cancelarse. Verificar que `jobQueue` soporte `AbortSignal`.
4. **`startGenerationJob` / `finishGenerationJob`**: ya se llaman desde `PromptApprovalGate.tsx:74,78,83`. El nuevo `generateTransition` debe respetarlos: el `onSuccess` del job debe llamar `finishGenerationJob(true)` y `onError` debe llamar `finishGenerationJob(false, error)`.
5. **Reintentos**: `generateTransitionWithRetry` ya tiene 5 reintentos con backoff. NO agregar lógica adicional.
6. **ETA dinámico**: el badge ya muestra ETA. El nuevo `generateTransition` puede opcionalmente actualizar `generationJobs` con `attempts` y `elapsed` para que el badge muestre "Intento 2/5…".

## Cambios

### Archivos a modificar
1. `src/stores/projectStore.ts` — `generateTransition` encola job real.
2. `src/services/jobQueue.ts` — verificar API (probablemente ya soporta lo necesario; si no, extender).
3. `src/components/prompt/PromptApprovalGate.tsx` — `handleApprove` debe esperar la promesa del store y llamar `finishGenerationJob` según resultado. (Ya lo hace parcialmente.)
4. `src/components/generation/SplitViewHost.tsx` — el `handleApprove` también debe esperar correctamente.

### Tests a actualizar/agregar
1. `src/__tests__/projectStore.test.ts` — mockear `jobQueue.enqueue` y verificar que `generateTransition` lo llama con el payload correcto.
2. Verificar que el flujo completo: approve → job enqueued → onSuccess → status 'done' + videoBlob poblado.
3. Verificar el flujo de error: approve → job enqueued → onError → status 'failed' + errorMessage poblado.

## Restricciones
- NO romper el flujo de `MasterTab` (ensamblado de master video).
- NO agregar dependencias npm.
- NO cambiar el contrato de `jobQueue` (usar su API actual).
- NO cambiar el comportamiento de reintentos (delegar a `generateTransitionWithRetry`).
- NO pedir qodo (sunset). Self-review manual.

## Cierre
- ID: `ARCH-20260704-10`
- Pendiente: delegación a SOFIA, auditoría GEMINI, deploy.