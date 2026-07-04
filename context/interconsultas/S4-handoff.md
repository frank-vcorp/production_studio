# Handoff S4 — SOFIA Implementation

**ID:** `IMPL-20260703-04`  
**Fecha:** 2026-07-03  
**De:** INTEGRA (Arquitecto)  
**A:** SOFIA (Constructora Principal)  
**CC:** GEMINI (Auditor Post-S4)

---

## 🎯 OBJETIVO

Implementar **Sprint 4 — Edición Granular Inline + Prompt Gate v2** según `context/SPECs/SPEC-S4-GRANULAR-EDIT.md`.

## Estado S1+S2+S3 Cerrado
- ✅ **89/89 tests verdes** (20 S1 + 34 S2 + 35 S3) — NO ROMPER
- ✅ **4 commits consecutivos**: `b14b251`, `87baf60`, `e663ae2`, `c64e6a9`
- ✅ **Build production exit 0** consistente
- ✅ **H1/O1/O2 audit S2 cerrados**

## Spec Completa
Lee `context/SPECs/SPEC-S4-GRANULAR-EDIT.md` — contiene:
- 7 tareas (4.1 a 4.7) con código de ejemplo
- Tipos TypeScript (`PromptVersion`, `VersionHistoryService`, `SplitViewEditor`, etc.)
- Hooks (`useKeyboardShortcuts`)
- Tests obligatorios con nombres exactos
- Manual acceptance 12 items

## Entregable Demostrable (Definition of Done)
1. Click nodo "Deseo" en Storyboard → **SplitViewEditor** abre fullscreen
2. Split 50/50 inicial, **drag divider** funcional, **persiste en localStorage** tras F5
3. **4 tabs** (Visual/VO/Subs/Camera) con inline edit + regeneration callbacks
4. **PromptEditor v2**: tokens counter live, syntax highlight (azul/verde/amarillo)
5. **Cmd+Enter** aprueba, **Esc** cierra, **Tab** cicla tabs, **Cmd+S** guarda versión
6. **VersionHistory** muestra 5 últimas versiones, click restaura prompt
7. **SmartConcat** re-encode solo segmento tocado → master.mp4 en <15s
8. **Token warning** rojo si >1800 tokens, danger si >2048
9. Sin regresiones: 89 tests anteriores intactos

## Tareas (Orden Secuencial)

### Fase 0 — Setup (10min)
```
1. pnpm add @uiw/react-codemirror @codemirror/lang-markdown @codemirror/theme-one-dark
   (OPCIONAL — si decides usar CodeMirror. SPEC menciona como alternativa, también puedes hacer editor custom sin dep)
2. Verificar S1+S2+S3 sin cambios estructurales antes de empezar
```

### Fase 1 — Token Counter + Syntax Highlight (1h)
```
3. src/utils/tokenCounter.ts:
   - countTokens(text): number (~4 chars/token)
   - tokenStatus(tokens): { level, message, color }
   - Constantes TOKEN_LIMIT=2048, TOKEN_WARNING=1800

4. src/utils/syntaxHighlight.ts:
   - KEYWORDS constants (cinema, anchors, movement)
   - highlightPrompt(text): { segments: { text, kind }[] }

5. Tests:
   - src/__tests__/tokenCounter.test.ts (5 tests)
   - src/__tests__/syntaxHighlight.test.ts (6 tests)
```

### Fase 2 — PromptEditor v2 + useKeyboardShortcuts (1.5h)
```
6. src/components/prompt/PromptEditorV2.tsx:
   - Highlight overlay + textarea transparente
   - Token counter header (live update)
   - Color status (emerald/amber/red)

7. src/hooks/useKeyboardShortcuts.ts:
   - Cmd+Enter, Esc, Cmd+S, Cmd+Z, Cmd+Shift+Z, Tab
   - Detección Mac/Win, enabled flag

8. Tests:
   - src/__tests__/useKeyboardShortcuts.test.ts (6 tests)
```

### Fase 3 — VersionHistory Service (1h)
```
9. src/services/versionHistory.ts:
   - VersionHistoryService class con IDB store 'bridge-versions'
   - recordVersion, getVersions, restoreVersion, generateDiff
   - MAX_VERSIONS_PER_TRANSITION=5 (FIFO)

10. src/components/generation/VersionHistory.tsx (UI):
    - Lista compacta de versiones
    - Click restaura
    - Badge "actual" en current version

11. Tests:
    - src/__tests__/versionHistory.test.ts (4 tests)
    - src/__tests__/VersionHistory.test.tsx (3 tests: render, click restore, current badge)
```

### Fase 4 — InlineNodeEditor + 4 Tabs (1h)
```
12. src/components/generation/InlineNodeEditor.tsx:
    - 4 tabs: Visual, VO, Subs, Camera
    - Conditional rendering según activeTab

13. src/components/generation/tabs/VisualTab.tsx (regenerate visual)
14. src/components/generation/tabs/VOTab.tsx (regenerate TTS segmento)
15. src/components/generation/tabs/SubsTab.tsx (update subtitles)
16. src/components/generation/tabs/CameraTab.tsx (edit CameraSpec)

17. Tests:
    - src/__tests__/InlineNodeEditor.test.tsx (4 tests: cada tab funcional)
```

### Fase 5 — SplitViewEditor (1h)
```
18. src/components/generation/SplitViewEditor.tsx:
    - Modal fullscreen con split 50/50
    - Drag divider (mouseMove/mouseUp listeners)
    - Persistencia localStorage por transitionId
    - Left: PromptEditorV2 + tabs
    - Right: PreviewPane + VersionHistory
    - Header con título + close
    - Footer con ETA smart concat

19. Tests:
    - src/__tests__/SplitViewEditor.test.tsx (5 tests)
```

### Fase 6 — SmartConcat (1h)
```
20. src/services/smartConcat.ts:
    - smartConcat(preserved, new, timelineOrder, burnedSubs?, musicBed?)
    - Worker message handler SMART_CONCAT
    - Filter chain (scale, subtitles, music mix)
    - Retorna SmartConcatResult con reEncodedSegments + preservedSegments

21. Extender src/workers/ffmpeg.worker.ts con handler SMART_CONCAT

22. Tests:
    - src/__tests__/smartConcat.test.ts (4 tests)
```

### Fase 7 — Integración Storyboard + ExportCenter (30min)
```
23. uiStore: nuevo slice splitViewTransitionId: string | null
24. KeyframeStoryboard: Click nodo → uiStore.openSplitView(transitionId)
25. Render condicional <SplitViewEditor /> si active

26. ExportCenter.MasterTab: Por cada clip en timeline, botón "Editar" → SplitViewEditor

27. Tests: Verificar integración manual (no necesita test nuevo si 4.5 cubre)
```

### Fase 8 — Validaciones Finales (30min)
```bash
pnpm typecheck && pnpm test --run && pnpm lint && pnpm build
```
- 89 + ~25 S4 nuevos = ~115 tests esperados
- Manual Acceptance 12 items

## Validaciones Obligatorias Antes de Cerrar

```bash
pnpm typecheck 2>&1     # 0 errores TS
pnpm test --run 2>&1    # ~115/115 pass estimado (89 + ~25 S4)
pnpm lint 2>&1          # 0 warnings
pnpm build 2>&1         # dist + ffmpeg-core
```

**Y Manual Acceptance 12 items** del SPEC-S4 → todos ✅

## Self-Review Requerido (en Reporte Final — sustituto de qodo, está sunset)
1. ¿El código refleja la SPEC? (split resizable, tabs funcionales, smart concat <15s)
2. ¿Code smells evidentes? (drag memory leaks, IDB quota, token counter performance)
3. ¿Tests cubren edge cases? (drag boundaries 20-80%, IDB max 5 versions, keyboard sin modifier)
4. ¿Riesgo de regresión? (los 89 tests S1+S2+S3 deben seguir pasando)

## Reporte Final Esperado

```markdown
## SOFIA Terminó — S4 Edición Granular

### Resumen
- Implementadas 7 tareas (4.1 a 4.7) según SPEC-S4-GRANULAR-EDIT.md
- Archivos nuevos: [lista]
- Archivos modificados (S1+S2+S3): [lista — solo aditivos]
- Tiempo real: ~X horas

### Validaciones
- pnpm typecheck: ✅ 0 errores
- pnpm test --run: ✅ XX/XX pass (~115 estimados)
- pnpm lint: ✅ 0 warnings
- pnpm build: ✅ dist + ffmpeg-core

### Manual Acceptance
- 12/12 items completados

### Self-Review
1. Spec compliance: ✅ [detalles]
2. Code smells: [lista menor si hay]
3. Test coverage: ✅ [edge cases cubiertos]
4. Regression S1+S2+S3: ✅ 89 tests intactos

### Sugerencia
> INTEGRA invoca a **GEMINI** (`subagent_type='gemini'`) como segunda mano antes de commit. qodo está sunset.
```

## Reglas Inquebrantables
- **NO rompas S1+S2+S3** — los 89 tests anteriores deben seguir pasando
- **NO commitees** — espera OK humano
- **NO pidas qodo** — sunset, usa self-review manual con 4 puntos
- **NO pegues logs inventados** — solo logs reales
- Si un enfoque falla 3 veces → escala

## Notas Críticas

1. **CodeMirror OPCIONAL**: SPEC lo menciona como ejemplo; puedes hacer editor custom sin dep. Decisión pragmática.
2. **Token counter**: ~4 chars/token. NO usar tiktoken (overkill).
3. **VersionHistory IDB store**: 'bridge-versions', migration v3.
4. **Drag divider UX**: cursor `col-resize`, hover sky-500, drop shadow durante drag.
5. **Cmd+Enter vs Enter**: Solo Cmd+Enter aprueba; Enter normal inserta newline en textarea.
6. **SmartConcat worker**: extender `ffmpeg.worker.ts`, no crear worker nuevo.
7. **Keyboard shortcuts**: enabled=false cuando modal cerrado.
8. **NO modifiques flujo S1+S2+S3**: `useJobProgress` quedó en `src/hooks/` desde S3, no tocar.

## Próximo Paso Tras S4
- INTEGRA invoca GEMINI para auditoría + commit + apertura S5 (Wizard Guiado + Templates + Accesibilidad)

---

**Procede inmediatamente con Fase 0 (setup + verificar S1-S3).**