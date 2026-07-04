# Handoff S3 — SOFIA Implementation

**ID:** `IMPL-20260703-03`  
**Fecha:** 2026-07-03  
**De:** INTEGRA (Arquitecto)  
**A:** SOFIA (Constructora Principal)  
**CC:** GEMINI (Auditor Post-S3)

---

## 🎯 OBJETIVO

Implementar **Sprint 3 — Export Multi-Formato + UX Crítica** según `context/SPECs/SPEC-S3-EXPORT.md`.

## Estado S1+S2 Cerrado
- ✅ S1: 20/20 tests, build green, commit `b14b251`
- ✅ S2: 54/54 tests, build green, commit `87baf60`
- ✅ GEMINI audit S2: 🟢 APTO PARA COMMIT, 10/10 garantías, sin críticos
- ✅ H1 (S2) bajo: ExportCenter ruta — **S3 tarea 3.7 consolida esto**

## Spec Completa
Lee `context/SPECs/SPEC-S3-EXPORT.md` — contiene:
- 9 tareas (3.1 a 3.9)
- Tipos TypeScript completos (`AspectRatio`, `ExportPreset`, `SafeZone`, `ExportPackOptions`, `ExportPackOutput`)
- Código de ejemplo para cada componente
- Plan de tests detallado
- Acceptance checklist de 15 items

## Entregable Demostrable (Definition of Done)
- Master 9:16 (de S2) → Export Center rediseñado con **5 tabs** (Master, Pack RRSS, Assets, Manifest, Share)
- Tab Pack RRSS: checkboxes 4 ratios + safe zones + burn subs + watermark → click "Generar"
- FFmpegBatchWorker procesa 4 ratios en paralelo con progreso individual
- ZIP descargable con `master_{ratio}.mp4 × N + subs.srt + vo.wav + manifest.json + README.txt`
- Tab Share: blob URL + QR code (escaneable) + embed HTML
- Brand color aplicado a fallback Strategy 2
- Telemetría opt-in por localStorage

## Tareas (Orden Secuencial Obligatorio)

### Fase 0 — Setup (10min)
```
1. pnpm add jszip @types/jszip qrcode @types/qrcode
2. mv src/components/export/ExportCenter.tsx src/components/generation/ExportCenter.tsx
3. Actualizar imports en tests y otros componentes
```

### Fase 1 — Tipos + ExportPresets (1h)
```
4. src/types/export.ts:
   - EXPORT_PRESETS (4 ratios: 9:16, 1:1, 4:5, 16:9)
   - SAFE_ZONES (7 plataformas)
   - ExportPreset, SafeZone, ExportPackOptions, ExportPackOutput interfaces

5. src/services/exportPresets.ts:
   - getPreset, listAllPresets, estimateTotalSizeMB, estimateEncodingTime

6. src/__tests__/exportPresets.test.ts (4 tests)
```

### Fase 2 — SafeZonePreview (1h)
```
7. src/components/export/SafeZonePreview.tsx
   - Render con overlay rojo top, amber bottom, yellow sides
   - Responsive, ratios diferentes sin overflow
   
8. src/services/safeZoneBurn.ts (opcional burn en FFmpeg)
   - applySafeZone(video, safeZone, preset) → Blob con boxes visibles
   
9. Tests
```

### Fase 3 — FFmpegBatchWorker (1.5h)
```
10. src/workers/exportBatch.worker.ts:
    - INIT/EXPORT_RATIO/TERMINATE handlers
    - Filter chain: scale → crop/pad → (burn_subs) → (watermark overlay) → encode H.264
    
11. src/services/exportBatch.ts:
    - batchEncode(masterBlob, options, brandPalette, onProgress, abortSignal)
    - Encode N ratios en paralelo con progreso por ratio
    - Valida S1 master.mp4
    
12. Tests con mocks de Worker
```

### Fase 4 — ZIP Packaging (30min)
```
13. src/services/zipHelper.ts:
    - buildExportPackZip(pack: Partial<ExportPackOutput>)
    - DEFLATE level 6
    - Incluye README.txt automático con info
    
14. Tests (2 tests: contains files + README)
```

### Fase 5 — ShareLinkGenerator (30min)
```
15. src/services/shareLink.ts:
    - generateShareLink(masterBlob, manifest?, expiresInHours=24)
    - URL.createObjectURL + cleanup programado
    - QRCode.toDataURL (librería qrcode)
    - embedHtml (<video src> autogenerado)
    
16. formatShareLinkExpiry utility
    
17. Tests (3 tests: blob URL, QR dataURL, embedHtml content)
```

### Fase 6 — ExportCenter Redesign (1h)
```
18. src/components/generation/ExportCenter.tsx (MOVIDO + rediseñado)
    - 5 tabs: Master | Pack RRSS | Assets | Manifest | Share
    - Usa Tabs radix-ui o custom
    
19. Subcomponentes:
    - src/components/generation/tabs/MasterTab.tsx
    - src/components/generation/tabs/PackRRSSTab.tsx
    - src/components/generation/tabs/AssetsTab.tsx
    - src/components/generation/tabs/ManifestTab.tsx
    - src/components/generation/tabs/ShareTab.tsx
    
20. Tests con @testing-library/react (5 tests: cada tab renderiza)
```

### Fase 7 — Telemetría + Settings (30min)
```
21. src/services/telemetry.ts:
    - TelemetryService class
    - Events: fallback_activated, job_completed, export_pack_generated
    - isEnabled() via localStorage bridge_telemetry_optin === 'true'
    - getEvents() retorna últimos 100
    
22. Integrar en fallbackStrategy.ts: telemetry.record({ type: 'fallback_activated', ... })
    
23. src/components/common/Settings.tsx (o ampliar S1):
    - Tab/Section "Privacy & Telemetry"
    - Toggle opt-in
    - Mostrar contador de eventos almacenados
```

### Fase 8 — Brand Color en Fallback (15min)
```
24. src/services/fallbackStrategy.ts:
    - Strategy "plain_color_with_text" acepta brandColor?: string
    - Default '#0b0f19' si no brand
    - Inyecta color via FFmpeg drawbox fill color
```

## Validaciones Obligatorias Antes de Cerrar

```bash
pnpm typecheck 2>&1     # 0 errores TS
pnpm test --run 2>&1    # 75/75 pass estimado (20 S1 + 34 S2 + ~21 S3 nuevos)
pnpm lint 2>&1          # 0 warnings
pnpm build 2>&1         # dist + ffmpeg-core (4 archivos)
```

**Y Manual Acceptance 15 items** del SPEC-S3 → todos ✅

## Self-Review Requerido (en Reporte Final)

1. ¿El código refleja la SPEC? (con ejemplos: clips en ZIP, QR funciona, telemetría wired)
2. ¿Code smells evidentes? (Worker try/finally, memory cleanup en shareLink, opt-in defaults a OFF)
3. ¿Tests cubren edge cases? (abort mid-encode, ZIP con muchos files, QR con long URL > 2KB)
4. ¿Regresiones S1+S2? (los 54 tests anteriores deben seguir pasando — CRÍTICO)

## Reporte Final Esperado

```markdown
## SOFIA Terminó — S3 Export Multi-Formato

### Resumen
- Implementadas 9 tareas (3.1 a 3.9) según SPEC-S3-EXPORT.md
- Archivos nuevos: [lista]
- Archivos movidos: ExportCenter.tsx a src/components/generation/
- Archivos modificados (S1+S2): [lista — solo ajustes menores]
- Tiempo real: ~X horas

### Validaciones
- pnpm typecheck: ✅ 0 errores
- pnpm test --run: ✅ XX/XX pass (~75)
- pnpm lint: ✅ 0 warnings
- pnpm build: ✅ dist + ffmpeg-core

### Manual Acceptance
- 15/15 items completados

### Self-Review
1. Spec compliance: ✅ [detalles]
2. Code smells: [lista menor si hay]
3. Test coverage: ✅ [edge cases cubiertos]
4. Regression S1+S2: ✅ 20+34 tests intactos (sin breaks)

### Sugerencia
> INTEGRA invoca a **GEMINI** (`subagent_type='gemini'`) como segunda mano antes de commit. qodo está sunset.
```

## Reglas Inquebrantables
- **NO rompas S1+S2**: los 54 tests previos deben seguir pasando
- **NO commitees**: espera OK humano
- **NO pidas qodo**: sunset, usa self-review manual
- **NO pegues logs inventados**: solo logs reales
- Si un enfoque falla 3 veces → escala

## Notas Críticas

1. **Worker lifecycle**: try/finally con `self.close()` o `terminate()`. Sin esto: memory leak garantizado.
2. **JSZip streaming**: para ZIP >100MB, usa `generateInternalStream()` en lugar de `generateAsync({ type: 'blob' })` para no saturar RAM.
3. **ShareLink cleanup**: `URL.revokeObjectURL` programado pero también limpieza al `beforeunload`.
4. **QRCode library**: `qrcode` (no `qrcode.react`). Import: `import QRCode from 'qrcode'`. API: `await QRCode.toDataURL(text, opts)`.
5. **Telemetry opt-in OFF por defecto**: privacidad GDPR. Solo activa con OK explícito del usuario.
6. **ExportCenter move**: actualiza `imports` en todos los archivos que lo referencian (tests S2, S1 user).
7. **Aspect ratio validation**: presets deben validarse contra `AspectRatio` enum para evitar typos.
8. **Watermark logic**: usar `format=auto` en FFmpeg overlay para PNG automático; no hardcodear extensión.

## Próximo Paso Tras S3
- INTEGRA invoca GEMINI para auditoría + commit + apertura S4

---

**Procede inmediatamente con Fase 0 (instalar deps + mover ExportCenter).**