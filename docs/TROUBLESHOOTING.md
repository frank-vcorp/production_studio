# Troubleshooting

> Errores comunes y soluciones. Spec: SPEC-S6-TESTS-CICD §6.5.

## Errores Veo (Gemini API)

### "quota exceeded" (429)

**Causa**: Cuota de Gemini agotada temporalmente (rate limit por minuto o por día).

**Síntomas**: Toast de error en MasterTab, job con status `failed` y `fallbackReason: quota_rate`.

**Solución automática**: El cliente `gemini/client.ts` aplica retry exponencial con backoff: 1s → 2s → 4s → 8s → 16s (5 intentos). Si tras 5 intentos sigue fallando, se aplica **fallback** (imagen estática con zoom 5s para el nodo perdido).

**Solución manual**:
1. Esperar 1-2 minutos y reintentar.
2. Aumentar cuota en [Google Cloud Console](https://console.cloud.google.com/apis/api/generativelanguage.googleapis.com/quotas).
3. Verificar el `GEMINI_API_KEY` activo: `curl -H "x-goog-api-key: $KEY" https://generativelanguage.googleapis.com/v1/models`.

### "safety blocked"

**Causa**: Gemini Safety filter detectó contenido inapropiado (violencia, sexual, etc.).

**Síntomas**: Toast de error, job `failed`, fallback inmediato (no retry).

**Solución**:
1. **NO reintentar** — safety no es recuperable.
2. Revisar el prompt — puede haber detectado:
   - Texto agresivo ("COMPRA YA", "MATA la competencia")
   - Descripciones con riesgo (armas, sangre, menores)
3. Reformular usando las guías de [`PROMPT_ENGINEERING_GUIDE.md`](./PROMPT_ENGINEERING_GUIDE.md).
4. Si consideras que es un falso positivo, reportar a Google AI Studio con el `requestId` que aparece en consola.

### "timeout" (>5min)

**Causa**: Veo no completó la generación en 5 minutos (cola saturada o prompt complejo).

**Solución automática**: Retry, luego fallback a Imagen 3 (keyframe estático) + audio.

**Solución manual**:
1. Reducir la duración solicitada (de 8s a 5s).
2. Simplificar el prompt (quitar detalles redundantes).
3. Dividir el lote en batches más pequeños (3 nodos a la vez).

### "internal error" (500)

**Causa**: Error transitorio de Google AI.

**Solución**: Retry automático (backoff). Si persiste, fallback.

## Errores FFmpeg

### "MEMFS write failed"

**Causa**: Archivo >2GB no cabe en MEMFS (memoria virtual del WASM).

**Solución**:
1. Reducir la duración del master (de 60s a 30s).
2. Comprimir el bitrate de entrada (preset `medium` en lugar de `slow`).
3. Dividir el master en 2 partes y concatenar después.

### "concat failed"

**Causa**: Clips con codecs o resoluciones diferentes.

**Síntomas**: Error "Incompatible pixel format" o "moov atom not found".

**Solución**:
1. Forzar codec unificado: `-c:v libx264 -c:a aac -pix_fmt yuv420p`.
2. Verificar que todos los clips sean H.264 1080x1920 (9:16).
3. Re-encodear los clips problemáticos con `ffmpegService.smartConcat` (lo hace internamente).

### "worker terminated unexpectedly"

**Causa**: Worker de FFmpeg crasheó (OOM o bug interno).

**Solución**:
1. Recargar la página (libera memoria).
2. Reducir el batch de exports (de 4 ratios a 2).
3. Reportar el bug con el log de consola.

## Errores IndexedDB

### "QuotaExceededError"

**Causa**: >1GB almacenado en IndexedDB (límite del navegador).

**Solución**:
1. Settings (gear icon) → "Reset proyecto" → limpia clips antiguos.
2. Exportar el master antes de descartar.
3. Si persiste, limpiar IndexedDB del navegador manualmente:
   - DevTools → Application → Storage → Clear site data.

### "blocked" (transacción)

**Causa**: Otra tab tiene IndexedDB abierto con un lock activo.

**Solución**:
1. Cerrar otras tabs del mismo origen.
2. Recargar la tab actual.
3. Si persiste, abrir en ventana incógnito.

### "VersionError" (migración)

**Causa**: El schema de IDB cambió (nueva versión) y no hay migración definida.

**Solución**:
1. Settings → "Reset proyecto" (limpia y recrea).
2. NO recoverable si el schema es incompatible — aceptar la pérdida.

## Errores del Proxy (Cloudflare Worker)

### "Worker not deployed"

**Causa**: El Worker no está corriendo en producción.

**Síntomas**: Header muestra "Sin conexión al proxy".

**Solución**:
```bash
cd worker
wrangler deploy  # requiere GEMINI_API_KEY en secrets
```

### "401 Unauthorized"

**Causa**: El `GEMINI_API_KEY` no está configurado o es inválido.

**Solución**:
```bash
cd worker
wrangler secret put GEMINI_API_KEY
# pegar la key de https://aistudio.google.com/apikey
```

### "CORS error"

**Causa**: El Worker no está configurado para el dominio de producción.

**Solución**: Verificar `wrangler.toml` → `[[env.production.routes]]` y los headers CORS en `worker/src/index.ts`.

## Memory leaks / RAM

### RAM >1GB en DevTools

**Causa**: Workers (FFmpeg o Job) no terminados correctamente tras errores.

**Solución**:
1. Recargar la página (libera workers y MEMFS).
2. Si persiste, abrir en ventana incógnito (sin extensiones).
3. Reportar el bug con captura de DevTools → Memory.

### "JavaScript heap out of memory"

**Causa**: Procesar clips muy grandes (>100MB) en el navegador.

**Solución**:
1. Reducir la duración del master.
2. Procesar los clips en batches (no más de 3 en paralelo).
3. Usar un navegador con más RAM disponible (Chrome estable consume ~3x menos que Safari).

## Errores de hidratación React

### "Hydration mismatch" en consola

**Causa**: El server-rendered HTML no coincide con el cliente (común con `new Date()` en render).

**Solución**:
1. Verificar que no hay `Date.now()` o `Math.random()` directo en JSX.
2. Usar `useState(() => Date.now())` lazy initializer.
3. Envolver el componente en `<ClientOnly>` (futuro).

## Bugs conocidos / Workarounds

| Bug | Workaround |
|---|---|
| CostModal no cierra al confirmar en Firefox | Refresh tab |
| QR code baja con nombre incorrecto en Safari | Usar Chrome para download |
| Voiceover TTS a veces produce audio con crackle | Regenerar el clip (el retry reintenta con seed distinto) |
| Export ZIP >500MB tarda 10+ min | Reducir ratios habilitados a 2 |

## Debugging forense

Para reportar un bug, incluye:

1. **Entorno**: Navegador + versión, OS, dispositivo.
2. **Pasos**: Mínimo reproducible.
3. **Logs de consola**: Texto completo del error (click derecho → Save as...).
4. **Network tab**: Petición que falló (URL, status, headers).
5. **Estado**: Settings → "Reset proyecto" antes de reportar (no perderás el brief si lo guardas primero).

Contacto: issues en el repo + tag `bug`.