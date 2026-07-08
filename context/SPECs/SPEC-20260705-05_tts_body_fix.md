# SPEC — TTS Body Shape Fix (Gemini 2.5 Flash Preview TTS)

**ID:** `ARCH-20260705-05`
**Fecha:** 2026-07-07
**Origen:** Bug detectado durante la revisión minuciosa del sistema (2026-07-07). Al testear el endpoint `/api/gemini/synthesizeSpeech` con curl se obtuvo `HTTP 400 "Invalid JSON payload received. Unknown name 'text': Cannot find field."`.

**Estado:** 📝 **Trazabilidad pura**. NO se implementa en este sprint. Programado para v1.1.

---

## ⚠️ Por qué este ticket NO bloquea el smoke test live

TTS **no se ejecuta en el flujo actual end-to-end** (Brief → Keyframe → Veo clip → Master):

- `geminiClient.synthesizeSpeech(...)` está definido pero **nadie lo llama** desde el código de UI.
- `job.worker.ts:71-73` TTS handler es un **stub explícito**:
  ```ts
  if (job.kind === 'tts') {
    throw new Error(`Job kind not implemented in worker: tts`);
  }
  ```
  Con comentario: *"Stubs para image_generation y tts en S2 (no usados por el flujo del modal)."*
- `src/services/gemini/tts.ts` **no existe** como archivo.
- La UI tiene un botón "Regenerar Audio (TTS)" en `VOTab.tsx` pero su handler es stub.

**Conclusión:** el bug es real y debe arreglarse cuando se implemente la feature de voiceover, pero NO bloquea el flujo Brief→Veo que sí vamos a probar.

---

## 🔍 Causa raíz (3 capas)

### Capa 1: `buildTTSPrompt` retorna shape incorrecto

**Archivo:** `src/services/promptBuilder.ts:117-131`

```ts
export interface BuildTTSPromptInput {
  voiceover: string;
  voice?: string;
  tone?: string;
}

/** Estructura para llamar Gemini TTS */
export function buildTTSPrompt(input: BuildTTSPromptInput) {
  return {
    text: input.voiceover,           // ❌ "text" en raíz no existe
    voiceName: input.voice ?? 'Kore', // ❌ está en lugar equivocado
    languageCode: 'es-MX',           // ❌ está en lugar equivocado
    speakingRate: 1.0,               // ❌ este campo NO EXISTE en Gemini TTS
    pitch: 0,                        // ❌ este campo NO EXISTE en Gemini TTS
  };
}
```

**Lo correcto** (verificado contra docs Gemini Developer API, consultado 2026-07-07):

```ts
export function buildTTSPrompt(input: BuildTTSPromptInput) {
  return {
    contents: [{
      role: 'user',
      parts: [{ text: input.voiceover }]   // ✅ texto en contents[].parts[].text
    }],
    generationConfig: {
      responseModalities: ['AUDIO'],       // ✅ OBLIGATORIO para TTS
      speechConfig: {
        languageCode: input.tone ?? 'es-MX',
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: input.voice ?? 'Kore'
          }
        }
      }
    }
  };
}
```

### Capa 2: `TTSRequest` type no matchea con Gemini API

**Archivo:** `src/types/gemini.ts:122-135`

**Actual (incorrecto):**
```ts
export interface TTSRequest {
  /** Texto a sintetizar */
  text: string;
  /** 'Kore', 'Puck', 'Charon', 'Fenrir', 'Aoede' (voces multi) */
  voiceName?: string;
  /** Idioma */
  languageCode?: string;
  /** Modelo a usar */
  model?: string;
  /** Velocidad 0.5-2.0 */
  speakingRate?: number;
  /** Tono +/-20 semitonos */
  pitch?: number;
}
```

**Correcto (type Gemini Developer API):**
```ts
export interface TTSRequest {
  /** Texto a sintetizar (va en contents[0].parts[0].text) */
  text: string;
  /** 'Kore', 'Puck', 'Charon', 'Fenrir', 'Aoede' (voces multi) */
  voiceName?: string;
  /** Idioma (default 'es-MX') */
  languageCode?: string;
  // Sin `model`, `speakingRate`, `pitch` — esos campos no existen en la API pública TTS.
}
```

### Capa 3: `synthesizeSpeech` en el cliente solo forwardea el body roto

**Archivo:** `src/services/gemini/client.ts:227-229`

**Actual (no transforma, no parsea respuesta):**
```ts
synthesizeSpeech(req: TTSRequest): Promise<TTSResponse> {
  return this.request<TTSResponse>({ path: '/api/gemini/synthesizeSpeech', body: req });
}
```

**Correcto:**
```ts
async synthesizeSpeech(req: TTSRequest): Promise<TTSResponse> {
  // Construir shape Gemini
  const geminiBody = buildTTSPrompt({
    voiceover: req.text,
    voice: req.voiceName,
    tone: req.languageCode,
  });
  
  // Llamar al proxy (que forwardea al endpoint Gemini)
  const raw = await this.request<{
    candidates?: Array<{
      content?: { parts?: Array<{ inlineData?: { data: string; mimeType: string } }> };
    }>;
  }>({ path: '/api/gemini/synthesizeSpeech', body: geminiBody });
  
  // Extraer audio base64 del response real
  const inlineData = raw.candidates?.[0]?.content?.parts?.[0]?.inlineData;
  if (!inlineData) {
    throw new GeminiProxyError(500, 'TTS no devolvió audio embebido', { raw });
  }
  
  return {
    audioContent: inlineData.data,
    mimeType: inlineData.mimeType, // 'audio/L16;codec=pcm;rate=24000'
  };
}
```

**Notas importantes sobre el response de Gemini TTS:**
- El audio viene en `candidates[0].content.parts[0].inlineData.data` (base64).
- MIME type: `audio/L16;codec=pcm;rate=24000` (PCM 16-bit, 24 kHz, mono, **sin cabecera WAV**).
- Para convertir a WAV: `ffmpeg -f s16le -ar 24000 -ac 1 -i out.pcm out.wav` o usar la utilidad existente en el proyecto.

---

## 🎯 Diseño de la solución

### 1. Cambios de código (cuando se implemente en v1.1)

| Archivo | Cambio |
|---|---|
| `src/types/gemini.ts` | Actualizar `TTSRequest` al shape correcto (solo `text`, `voiceName`, `languageCode`). |
| `src/services/promptBuilder.ts` | Reescribir `buildTTSPrompt` para devolver `{contents, generationConfig: {responseModalities, speechConfig}}`. |
| `src/services/gemini/client.ts` | `synthesizeSpeech` debe construir body Gemini y parsear audio de `candidates[0].content.parts[0].inlineData`. |
| `src/services/gemini/tts.ts` (nuevo, si no existe) | Wrapper de alto nivel: `synthesizeVoiceover(text, voice?, languageCode?)` que devuelve `{blob, mimeType, durationSec}` y maneja conversión PCM→WAV. |

### 2. Sandbox (extender)

**Archivo nuevo:** `src/services/sandbox/mockTts.ts`

```ts
async function mockSynthesizeSpeech(req: TTSRequest): Promise<TTSResponse> {
  // Latencia simulada: 1-2 segundos
  await sleep(1000 + Math.random() * 1000);
  
  // Generar audio WAV dummy (silencio + metadata) usando Web Audio API o ffmpeg-stub.
  // Alternativa más simple: devolver un WAV de 0.5s con tono 440Hz (silencio corto).
  const audioContent = generateDummyWavBase64();
  return {
    audioContent,
    mimeType: 'audio/wav',
    durationSeconds: 0.5,
  };
}
```

**Switch en `imageAnalysis.ts`/`video.ts` no aplica** (esos son otros servicios). El switch iría en el wrapper `tts.ts` (cuando se cree) o directo en `client.ts:synthesizeSpeech`.

### 3. Modelo alternativo (futuro)

**Opción A:** Gemini 2.5 Flash Preview TTS (lo que usa el worker hoy).
**Opción B:** **Interactions API** — recomendada por docs para acceder a `gemini-3.1-flash-tts-preview` (modelo más nuevo).

Si se quiere usar B en el futuro, el endpoint cambia de `:generateContent` a `POST /v1beta/interactions`. Decisión postergada.

### 4. Tests (cuando se implemente)

- `__tests__/buildTTSPrompt.test.ts`:
  - Verifica que devuelve `{contents: [...], generationConfig: {responseModalities: ['AUDIO'], speechConfig: {...}}}`.
  - Voice default = 'Kore', languageCode default = 'es-MX'.
- `__tests__/ttsClient.test.ts`:
  - Mock del Worker, verificar que `synthesizeSpeech` envía body correcto.
  - Mock del response Gemini, verificar que extrae `inlineData.data`.
- `__tests__/mockTts.test.ts`:
  - `mockSynthesizeSpeech` devuelve audio válido no vacío.
- `__tests__/sandbox_toggle.test.ts`:
  - Con `IS_SANDBOX=true`, `synthesizeSpeech` NO llama al cliente real.
  - Con `IS_SANDBOX=false`, sí llama.

### 5. Workaround temporal (si el usuario quiere probar TTS antes de implementar el fix)

**Opción:** Crear un endpoint mock en el Worker que devuelva un MP3/WAV dummy. Mientras tanto, marcar el UI TTS como "Beta — feature pendiente" con tooltip explicando.

---

## 📊 Estimación de esfuerzo

| Tarea | Tiempo |
|---|---|
| Fix de tipo + promptBuilder + client.ts | 30 min |
| Crear `services/gemini/tts.ts` wrapper con PCM→WAV | 1-2 horas |
| Sandbox mock TTS | 30 min |
| Tests | 1 hora |
| Total | **3-4 horas** |

**Costo API (cuando se recarguen créditos):** ~$0.001 USD por segundo de audio (ver `costEstimator.ts:21`). Por cada voiceover de 30s = ~$0.03 USD. Insignificante.

---

## 📎 Referencias

- [Documentación oficial Gemini TTS (generateContent)](https://ai.google.dev/gemini-api/docs/generate-content/speech-generation)
- [Documentación Interactions API (recomendada)](https://ai.google.dev/gemini-api/docs/speech-generation)
- [Modelo gemini-2.5-flash-preview-tts](https://ai.google.dev/gemini-api/docs/models/gemini-2.5-flash-preview-tts)
- [JS SDK: SpeechConfig](https://googleapis.github.io/js-genai/release_docs/interfaces/types.SpeechConfig.html)

---

## 🗂️ Archivos relacionados

| Path | Estado |
|---|---|
| `src/services/promptBuilder.ts:117-131` | Bug confirmado |
| `src/types/gemini.ts:122-135` | Type incorrecto |
| `src/services/gemini/client.ts:227-229` | Forwardea sin transformación |
| `src/workers/job.worker.ts:71-73` | Stub explícito |
| `src/components/generation/tabs/VOTab.tsx` | UI existe, handler es stub |
| `context/checkpoints/PENDIENTES_V1.1.md` | Lista actualizada — este bug NO estaba registrado |

---

## ✅ Definición de "Hecho" para v1.1

- [ ] Type `TTSRequest` corregido al shape Gemini Developer API.
- [ ] `buildTTSPrompt` retorna `{contents, generationConfig: {responseModalities: ['AUDIO'], speechConfig: {...}}}`.
- [ ] `synthesizeSpeech` parsea response real de Gemini (`candidates[0].content.parts[0].inlineData`).
- [ ] Wrapper `services/gemini/tts.ts` con conversión PCM→WAV.
- [ ] Sandbox mock `mockTts.ts` con toggle `IS_SANDBOX`.
- [ ] `job.worker.ts` reemplazado el stub por handler real.
- [ ] `VOTab.tsx` handler conecta con el wrapper.
- [ ] Tests: 4 archivos, ~15 tests nuevos.
- [ ] Smoke test live con API real cuando billing esté OK.
- [ ] `axe-core` y `a11y-helpers` siguen pasando.

---

## 📌 Cierre

- **ID:** `ARCH-20260705-05`
- **Fecha de detección:** 2026-07-07 (revisión minuciosa pre-prueba live)
- **Prioridad v1.1:** Media (no bloqueante, pero parte del feature de voiceover)
- **Owner futuro:** SOFIA con supervisión GEMINI
- **Pendiente commitear este SPEC** como artefacto de trazabilidad
