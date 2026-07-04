# SPEC-S4-GRANULAR-EDIT: Sprint 4 — Edición Granular Inline + Prompt Gate v2

**ID:** `IMPL-20260703-04`  
**Fecha:** 2026-07-03  
**Estado:** `[ ] Planificado` → `[~] En Progreso`  
**Dependencia:** S1 ✓ + S2 ✓ + S3 ✓ Completados  
**Duración Estimada:** 4-5 horas  
**Responsable:** SOFIA (delegación)  
**Auditor:** GEMINI (Post-S4)  
**Handoff:** `context/interconsultas/S4-handoff.md`

---

## 🎯 ENTREGABLE DEMOSTRABLE (Definition of Done)

> **Edición quirúrgica por nodo AIDA sin tocar el resto:**
>
> 1. Usuario en Storyboard con master.mp4 ya generado (de S3)
> 2. Click nodo **"Deseo"** → **Split View** abre: Izq Prompt Gate, Der Preview clip 3
> 3. **Edita VO inline** en textarea → click **"Regenerar Audio"** → Gemini TTS solo este segmento → 3-5s → preview actualizado
> 4. **Edita intención visual** en textarea → click **"Regenerar Visual"** → Imagen 3 (KF3_OUT auto) + Veo (transición KF3→KF3_OUT) → 2 min → preview
> 5. **Edita subtítulos** inline → click **"Actualizar Subs"** → VTT actualizado para este segmento → 1s
> 6. **VersionHistory** muestra 5 últimos prompts aprobados → click "Restaurar v3" → prompt actual + imagen preview vuelven a v3
> 7. **Smart Concat** ejecuta: solo re-encode clip 3 + audio 3 + subs 3 → master.mp4 actualizado en **10-15s** (no 30-60s del full regen)
> 8. **Token counter** muestra "1,247 / 2,048 tokens" en tiempo real con warning rojo si >1,800
> 9. **Syntax highlight** en PromptEditor v2: palabras clave (azul), anclas (verde), cámara (amarillo)

---

## 📋 BACKLOG DETALLADO DE TAREAS S4

| # | Tarea | Criterio de Aceptación | Esfuerzo |
|---|-------|------------------------|----------|
| **4.1** | `SplitViewEditor` con resizable panels + keyboard shortcuts | Drag divider Izq/Der persiste en localStorage | M |
| **4.2** | `PromptEditor` v2 con CodeMirror lite + token counter + syntax highlight | Tokens coloreados en tiempo real | M |
| **4.3** | `InlineNodeEditor` con 4 tabs (Visual/VO/Subs/Camera) sin modal | Click nodo abre split view, no dialog | L |
| **4.4** | `VersionHistory` por transición con 5 últimos prompts | Dropdown "v3 de 5" + restore en 1 click | S |
| **4.5** | `SmartConcat` FFmpeg con input mapping dinámico | Re-encode solo segmento tocado | L |
| **4.6** | `useKeyboardShortcuts` (Cmd+Enter aprobar, Cmd+Z undo, etc.) | Atajos funcionando en SplitView | S |
| **4.7** | Integración con ExportCenter y Storyboard (entrada por nodo) | Click nodo "Deseo" → SplitView | M |

**Esfuerzo:** S=1h, M=2h, L=3h | **Total:** 4-5h

---

## 🏗️ ARQUITECTURA DETALLADA

### Diagrama de Flujo S4

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                     FLUJO EDICIÓN GRANULAR S4                                │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  [Storyboard con 6 nodos aprobados]                                         │
│         │                                                                    │
│         │ Click "Deseo"                                                      │
│         ▼                                                                    │
│  ┌──────────────────────────────────────────────────────────┐               │
│  │            SplitViewEditor (fullscreen modal)            │               │
│  │  ┌─────────────────────┬──────────────────────────────┐  │               │
│  │  │  Prompt Editor v2   │      Preview Clip 3          │  │               │
│  │  │  ┌───────────────┐  │   ┌───────────────────────┐  │               │
│  │  │  │ 4 tabs:       │  │   │                       │  │               │
│  │  │  │ Visual/VO/    │  │   │   <video controls>   │  │               │
│  │  │  │ Subs/Camera   │  │   │   clip_3.mp4         │  │               │
│  │  │  └───────────────┘  │   │   1,247 / 2,048 tok  │  │               │
│  │  │  ┌───────────────┐  │   │                       │  │               │
│  │  │  │ Tokens: 1247  │  │   │   ETA smart concat:  │  │               │
│  │  │  │ Lines: 18     │  │   │   ~12s                │  │               │
│  │  │  └───────────────┘  │   └───────────────────────┘  │               │
│  │  │  ┌───────────────┐  │   ┌───────────────────────┐  │               │
│  │  │  │ Editor +      │  │   │ VersionHistory       │  │               │
│  │  │  │ syntax hilite │  │   │ v5 (actual) ▼       │  │               │
│  │  │  └───────────────┘  │   │ v4 (2 min ago)        │  │               │
│  │  │  [Aprobar] [Close]  │   │ v3 (5 min ago) ← res  │  │               │
│  │  └─────────────────────┴──────────────────────────────┘  │               │
│  └──────────────────────────────────────────────────────────┘               │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 📦 ESPECIFICACIÓN DETALLADA POR TAREA

### TAREA 4.1 — SplitViewEditor

**Archivo nuevo:** `src/components/generation/SplitViewEditor.tsx`

**Props:**
```typescript
interface SplitViewEditorProps {
  transitionId: string;
  keyframeFrom: Keyframe;
  keyframeTo: Keyframe;
  promptVersion: PromptVersion;  // approved actual
  onApprove: (finalPrompt: string) => Promise<void>;
  onRegenerateVisual: () => Promise<void>;  // Imagen 3 + Veo
  onRegenerateVO: () => Promise<void>;     // TTS solo este segmento
  onUpdateSubtitles: () => Promise<void>;  // VTT segmento
  onRestoreVersion: (version: PromptVersion) => void;
  onClose: () => void;
}
```

**Implementación:**
```tsx
export function SplitViewEditor({ transitionId, ... }: SplitViewEditorProps) {
  const [splitPercent, setSplitPercent] = useState<number>(() => {
    return Number(localStorage.getItem(`split_${transitionId}`) ?? 50);
  });
  const [isDragging, setIsDragging] = useState(false);
  const [activeTab, setActiveTab] = useState<NodeEditTab>('visual');
  const [versions, setVersions] = useState<PromptVersion[]>([]);
  
  // Persist split position
  useEffect(() => {
    if (!isDragging) {
      localStorage.setItem(`split_${transitionId}`, String(splitPercent));
    }
  }, [splitPercent, transitionId, isDragging]);
  
  // Resize handler
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;
    const container = document.getElementById(`split-container-${transitionId}`);
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const newPercent = ((e.clientX - rect.left) / rect.width) * 100;
    setSplitPercent(Math.max(20, Math.min(80, newPercent)));
  }, [isDragging, transitionId]);
  
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', () => setIsDragging(false));
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
      };
    }
  }, [isDragging, handleMouseMove]);
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-sm">
      <div className="w-full h-full max-w-7xl max-h-[90vh] bg-slate-900 border border-sky-500/30 rounded-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <header className="flex items-center justify-between p-4 border-b border-slate-800">
          <h2 className="text-lg font-bold text-white">Editor Granular — {NODE_LABELS[nodeKey]}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <i className="fa-solid fa-times"></i>
          </button>
        </header>
        
        {/* Split Container */}
        <div 
          id={`split-container-${transitionId}`}
          className="flex-1 flex"
        >
          {/* LEFT PANEL: Editor */}
          <div style={{ width: `${splitPercent}%` }} className="flex flex-col border-r border-slate-800">
            <TabBar activeTab={activeTab} onChange={setActiveTab} />
            <EditorPane 
              activeTab={activeTab}
              transitionId={transitionId}
              onApprove={onApprove}
            />
          </div>
          
          {/* DIVIDER (drag handle) */}
          <div 
            className="w-1 bg-slate-800 hover:bg-sky-500 cursor-col-resize transition-colors"
            onMouseDown={() => setIsDragging(true)}
            role="separator"
            aria-orientation="vertical"
          />
          
          {/* RIGHT PANEL: Preview + History */}
          <div style={{ width: `${100 - splitPercent}%` }} className="flex flex-col">
            <PreviewPane transitionId={transitionId} />
            <VersionHistory 
              versions={versions}
              currentVersionId={...}
              onRestore={onRestoreVersion}
            />
          </div>
        </div>
        
        {/* Footer */}
        <footer className="p-3 border-t border-slate-800 flex items-center justify-between">
          <span className="text-xs text-slate-400">ETA Smart Concat: ~12s</span>
          <div className="flex gap-2">
            <button onClick={onClose}>Cancelar</button>
            <button onClick={() => onApprove(...)}>Aprobar y Regenerar</button>
          </div>
        </footer>
      </div>
    </div>
  );
}
```

**Keyboard Shortcuts (Tarea 4.6):**
- `Cmd/Ctrl + Enter` → Aprobar prompt
- `Cmd/Ctrl + S` → Guardar versión
- `Esc` → Cerrar modal
- `Cmd/Ctrl + Z` → Deshacer edición
- `Tab` → Ciclar entre tabs (Visual → VO → Subs → Camera)

**Tests:**
```typescript
// src/__tests__/SplitViewEditor.test.tsx
- Renderiza con split 50/50 inicial
- Drag divider actualiza splitPercent entre 20-80
- localStorage persiste split position por transitionId
- Cmd+Enter dispara onApprove
- Esc dispara onClose
- Click tab cambia activeTab
```

---

### TAREA 4.2 — PromptEditor v2

**Archivos nuevos:**
- `src/components/prompt/PromptEditorV2.tsx`
- `src/utils/tokenCounter.ts`
- `src/utils/syntaxHighlight.ts`

**Dependencia nueva:** `pnpm add @uiw/react-codemirror @codemirror/lang-markdown @codemirror/theme-one-dark`

**Token Counter:**
```typescript
// src/utils/tokenCounter.ts
// Aproximación: ~4 caracteres = 1 token (Gemini Pro tokenizer)
export function countTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export const TOKEN_LIMIT = 2048;
export const TOKEN_WARNING = 1800;

export function tokenStatus(tokens: number): {
  level: 'safe' | 'warning' | 'danger';
  message: string;
  color: string;
} {
  if (tokens >= TOKEN_LIMIT) return { level: 'danger', message: 'Excede límite', color: 'red' };
  if (tokens >= TOKEN_WARNING) return { level: 'warning', message: 'Cerca del límite', color: 'amber' };
  return { level: 'safe', message: 'OK', color: 'emerald' };
}
```

**Syntax Highlight:**
```typescript
// src/utils/syntaxHighlight.ts
// Palabras clave para colorear:
// - AZUL: keywords cinematográficos (camera, lens, lighting, color)
// - VERDE: anclas visuales (FROM, TO, INICIAL, FINAL, NO INVENTES)
// - AMARILLO: cámara (dolly, crane, pan, zoom, macro)
// - GRIS: comentarios (// o #)
const KEYWORDS = {
  cinema: ['camera', 'lens', 'lighting', 'composition', 'fps', '24fps', '30fps', '60fps', '120fps', 'cinematic', 'commercial', 'documentary'],
  anchors: ['INICIAL', 'FINAL', 'FRAME 0', 'FRAME FINAL', 'FROM', 'TO', 'NO INVENTES', 'NO INVENTAR', 'REGLA ABSOLUTA', 'MISMO', 'MISMA', 'IGUAL'],
  movement: ['dolly', 'truck', 'crane', 'pan', 'zoom', 'macro', 'steadicam', 'handheld', 'fpv', 'orbit', 'whip-pan', 'crash-zoom'],
};

export function highlightPrompt(text: string): { segments: { text: string; kind: 'plain' | 'cinema' | 'anchor' | 'movement' }[] } {
  // Simple tokenizer-based highlighter
  const tokens = text.split(/(\s+|[,;:.])/); // split preserving whitespace/punct
  const segments: any[] = [];
  let buffer = '';
  
  tokens.forEach(token => {
    if (KEYWORDS.cinema.includes(token.toLowerCase())) {
      if (buffer) segments.push({ text: buffer, kind: 'plain' });
      segments.push({ text: token, kind: 'cinema' });
      buffer = '';
    } else if (KEYWORDS.anchors.includes(token)) {
      if (buffer) segments.push({ text: buffer, kind: 'plain' });
      segments.push({ text: token, kind: 'anchor' });
      buffer = '';
    } else if (KEYWORDS.movement.includes(token.toLowerCase())) {
      if (buffer) segments.push({ text: buffer, kind: 'plain' });
      segments.push({ text: token, kind: 'movement' });
      buffer = '';
    } else {
      buffer += token;
    }
  });
  
  if (buffer) segments.push({ text: buffer, kind: 'plain' });
  return { segments };
}
```

**Component:**
```tsx
// src/components/prompt/PromptEditorV2.tsx
interface PromptEditorV2Props {
  initialPrompt: string;
  onChange: (text: string) => void;
  readOnly?: boolean;
}

export function PromptEditorV2({ initialPrompt, onChange, readOnly = false }: PromptEditorV2Props) {
  const [text, setText] = useState(initialPrompt);
  const tokens = countTokens(text);
  const status = tokenStatus(tokens);
  const { segments } = highlightPrompt(text);
  
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between bg-slate-950 px-3 py-2 border-b border-slate-800">
        <span className="text-xs text-slate-400">
          Tokens: <span className={`font-mono font-bold text-${status.color}-400`}>
            {tokens.toLocaleString()} / {TOKEN_LIMIT.toLocaleString()}
          </span>
        </span>
        <span className={`text-xs text-${status.color}-400`}>{status.message}</span>
      </div>
      
      {/* Highlight overlay + textarea */}
      <div className="relative flex-1">
        <pre 
          aria-hidden="true"
          className="absolute inset-0 p-3 font-mono text-xs whitespace-pre-wrap overflow-auto pointer-events-none"
        >
          {segments.map((s, i) => (
            <span key={i} className={
              s.kind === 'cinema' ? 'text-sky-400 font-semibold' :
              s.kind === 'anchor' ? 'text-emerald-400 font-bold' :
              s.kind === 'movement' ? 'text-amber-400 font-semibold' :
              'text-slate-200'
            }>
              {s.text}
            </span>
          ))}
        </pre>
        
        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            onChange(e.target.value);
          }}
          readOnly={readOnly}
          className="relative w-full h-full p-3 font-mono text-xs text-transparent bg-transparent caret-white resize-none focus:outline-none"
          spellCheck={false}
        />
      </div>
    </div>
  );
}
```

**Tests:**
```typescript
// src/__tests__/tokenCounter.test.ts
- countTokens('Hola mundo') → 3
- countTokens de string 2000 chars → 500 tokens
- tokenStatus(2048) → danger red
- tokenStatus(1800) → warning amber
- tokenStatus(500) → safe emerald

// src/__tests__/syntaxHighlight.test.ts
- 'dolly out' → segments: 'dolly'=movement, ' out'=plain
- 'FRAME INICIAL' → 'FRAME'=plain, 'INICIAL'=anchor
- '24fps' → '24fps'=cinema
- case-insensitive: 'Dolly' funciona igual
```

---

### TAREA 4.3 — InlineNodeEditor (4 tabs)

**Archivos nuevos:**
- `src/components/generation/InlineNodeEditor.tsx`
- `src/components/generation/tabs/{VisualTab,VOTab,SubsTab,CameraTab}Tab.tsx`

**Props principales:**
```typescript
interface InlineNodeEditorProps {
  transition: KeyframeTransition;
  keyframeFrom: Keyframe;
  keyframeTo: Keyframe;
  voiceoverSegment: VOSegment | null;
  subtitleSegment: SubtitleSegment | null;
  // Regeneration callbacks
  onRegenerateVisual: (intent: string) => Promise<void>;
  onRegenerateVO: (text: string, voice: string) => Promise<void>;
  onUpdateSubtitles: (text: string) => Promise<void>;
  onUpdateCameraSpec: (spec: CameraSpec) => Promise<void>;
}
```

**Layout VisualTab:**
- Mini-preview de keyframeFrom + keyframeTo (side-by-side)
- Textarea "Intención humana" (descripción de transformación)
- Button "Regenerar Visual" → ejecuta `onRegenerateVisual` → Imagen 3 + Veo
- Spinner durante generación

**Layout VOTab:**
- Textarea "Texto voz en off" (editable)
- Selector voz (Kore/Zephyr/Leda)
- Button "Regenerar Audio" → TTS solo este segmento
- Audio player inline con download

**Layout SubsTab:**
- Textarea "Texto subtítulos" (editable)
- Preview de cómo se verá en safe zone (font/color/outline de marca)
- Button "Actualizar Subtítulos"

**Layout CameraTab:**
- CameraSpecEditor existente (de S1 si está, o crear)
- Specs editables: movement, lens, aperture, fps, lighting, colorGrade, composition
- Presets dropdown (Macro probe, Steadicam dolly, Handheld, etc.)

**Tests:**
```typescript
// src/__tests__/InlineNodeEditor.test.tsx
- Click tab "VO" muestra VOTab
- Editar texto VO + click Regenerar Audio → callback llamado
- Click tab "Camera" muestra CameraTab
- Click "Regenerar Visual" → muestra spinner durante operación
```

---

### TAREA 4.4 — VersionHistory

**Archivos nuevos:**
- `src/components/generation/VersionHistory.tsx`
- `src/services/versionHistory.ts`

**Lógica:**
```typescript
// src/services/versionHistory.ts
export interface PromptVersion {
  id: string;
  prompt: string;
  approvedAt: number;
  approvedBy: string;  // 'user' o 'system'
  diffFromPrevious?: string;
  changeReason?: string;
  // Preview frame (opcional, thumbnail de KF_OUT generada)
  previewThumbBase64?: string;
}

const MAX_VERSIONS_PER_TRANSITION = 5;

export class VersionHistoryService {
  private storage: IDBPDatabase<...>;
  
  async recordVersion(transitionId: string, version: PromptVersion): Promise<void> {
    const existing = await this.getVersions(transitionId);
    const updated = [version, ...existing.filter(v => v.id !== version.id)].slice(0, MAX_VERSIONS_PER_TRANSITION);
    await this.storage.put('versions', { transitionId, versions: updated });
  }
  
  async getVersions(transitionId: string): Promise<PromptVersion[]> {
    const record = await this.storage.get('versions', transitionId);
    return record?.versions ?? [];
  }
  
  async restoreVersion(transitionId: string, versionId: string): Promise<PromptVersion | null> {
    const versions = await this.getVersions(transitionId);
    return versions.find(v => v.id === versionId) ?? null;
  }
  
  async generateDiff(oldPrompt: string, newPrompt: string): Promise<string> {
    // Simple line-by-line diff (no librería externa, keep deps minimal)
    const oldLines = oldPrompt.split('\n');
    const newLines = newPrompt.split('\n');
    const diffLines: string[] = [];
    
    // ... simple LCS-based diff ...
    
    return diffLines.join('\n');
  }
}

export const versionHistory = new VersionHistoryService();
```

**UI:**
```tsx
function VersionHistory({ versions, currentVersionId, onRestore }: Props) {
  return (
    <div className="bg-slate-950 border-t border-slate-800 p-3 max-h-48 overflow-y-auto">
      <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Historial (últimas {versions.length})</h4>
      <ul className="flex flex-col gap-1">
        {versions.map((v, idx) => (
          <li key={v.id}>
            <button 
              onClick={() => onRestore(v)}
              className={`w-full text-left px-2 py-1.5 rounded text-xs flex items-center gap-2 ${
                v.id === currentVersionId ? 'bg-sky-500/20 border border-sky-500/50' : 'hover:bg-slate-800'
              }`}
            >
              <span className="text-slate-500 font-mono">v{versions.length - idx}</span>
              <span className="text-slate-300 truncate flex-1">{v.prompt.slice(0, 60)}...</span>
              <span className="text-slate-500 text-[10px]">
                {new Date(v.approvedAt).toLocaleTimeString()}
              </span>
              {v.previewThumbBase64 && (
                <img src={`data:image/png;base64,${v.previewThumbBase64}`} className="h-6 w-6 rounded object-cover" alt="" />
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

**Persistencia:** IndexedDB store `bridge-versions` con `{ transitionId, versions: PromptVersion[] }`.

**Tests:**
```typescript
// src/__tests__/versionHistory.test.ts
- recordVersion guarda 5 versiones máximo (FIFO drop oldest)
- restoreVersion retorna el PromptVersion correcto
- generateDiff calcula diff simple entre 2 strings
- Test integración: aprobar prompt 5 veces → solo 5 versiones en historial

// src/__tests__/VersionHistory.test.tsx
- Renderiza con 3 versiones → lista visible
- Click v3 → onRestore callback con PromptVersion
- v actual (currentVersionId) tiene styling distintivo
```

---

### TAREA 4.5 — SmartConcat FFmpeg

**Servicio:** `src/services/smartConcat.ts` (extiende `services/ffmpeg.ts`)

```typescript
// src/services/smartConcat.ts
import { ffmpegService } from './ffmpeg';

export interface SmartConcatInput {
  preservedClips: { role: string; blob: Blob; startTime: number; duration: number }[];
  newClips: { role: string; blob: Blob }[];
  timelineOrder: string[];
  burnedSubs?: { vttContent: string; style: SubtitleStyle };
  musicBed?: Blob;
}

export interface SmartConcatResult {
  blob: Blob;
  durationMs: number;
  reEncodedSegments: string[];
  preservedSegments: string[];
}

export async function smartConcat(input: SmartConcatInput): Promise<SmartConcatResult> {
  // 1. Build input list from timeline order
  const allClips = new Map<string, Blob>();
  input.preservedClips.forEach(c => allClips.set(c.role, c.blob));
  input.newClips.forEach(c => allClips.set(c.role, c.blob));
  
  const orderedClips = input.timelineOrder
    .map(role => ({ role, blob: allClips.get(role)! }))
    .filter(c => c.blob); // Skip if missing
  
  // 2. Write all to FFmpeg MEMFS
  const worker = await ffmpegService.getWorker();
  await Promise.all(orderedClips.map((c, i) => 
    worker.writeFile(`clip_${i}.mp4`, new Uint8Array(await c.blob.arrayBuffer()))
  ));
  
  // 3. Build filelist
  const filelist = orderedClips.map((_, i) => `file 'clip_${i}.mp4'`).join('\n');
  await worker.writeFile('filelist.txt', filelist);
  
  // 4. Write VTT if provided
  if (input.burnedSubs) {
    await worker.writeFile('subs.vtt', new TextEncoder().encode(input.burnedSubs.vttContent));
  }
  
  // 5. Build filter chain
  let videoFilter = '';
  if (input.burnedSubs) {
    const style = input.burnedSubs.style;
    const forceStyle = `FontName=${style.fontFamily},FontSize=${style.fontSize},PrimaryColour=${style.color},Outline=${style.outline}`;
    videoFilter = `subtitles=subs.vtt:force_style='${forceStyle}'`;
  }
  
  // 6. Run smart concat
  const start = performance.now();
  const args = [
    '-f', 'concat', '-safe', '0',
    '-i', 'filelist.txt',
  ];
  
  if (input.musicBed) {
    await worker.writeFile('music.wav', new Uint8Array(await input.musicBed.arrayBuffer()));
    args.push('-i', 'music.wav', '-filter_complex', '[0:v][1:a]concat...');
  }
  
  if (videoFilter) {
    args.push('-vf', videoFilter);
  }
  
  args.push(
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '20',
    '-c:a', 'aac', '-b:a', '128k',
    '-movflags', '+faststart',
    '-y', 'output.mp4'
  );
  
  await worker.run(...args);
  const data = await worker.readFile('output.mp4');
  
  const reEncodedSegments = orderedClips.filter(c => 
    input.newClips.some(n => n.role === c.role)
  ).map(c => c.role);
  
  return {
    blob: new Blob([data], { type: 'video/mp4' }),
    durationMs: performance.now() - start,
    reEncodedSegments,
    preservedSegments: orderedClips
      .filter(c => input.preservedClips.some(p => p.role === c.role))
      .map(c => c.role),
  };
}
```

**Worker message interface:**
```typescript
// workers/ffmpeg.worker.ts - añadir handler SMART_CONCAT
if (type === 'SMART_CONCAT') {
  const { clips, filelist, videoFilter, music, audio } = payload;
  
  // Escribir todos los clips
  for (let i = 0; i < clips.length; i++) {
    await ffmpeg.writeFile(`clip_${i}.mp4`, clips[i]);
  }
  await ffmpeg.writeFile('filelist.txt', filelist);
  
  if (videoFilter) {
    await ffmpeg.writeFile('subs.vtt', videoFilter.vttContent);
  }
  
  // Construir args
  const args = ['-f', 'concat', '-safe', '0', '-i', 'filelist.txt'];
  if (music) {
    args.push('-i', 'music.wav');
  }
  // ... etc
  
  await ffmpeg.exec(args);
  // ...
}
```

**Tests:**
```typescript
// src/__tests__/smartConcat.test.ts
- smartConcat con 4 preserved + 2 new → output válido
- reEncodedSegments contiene solo los new roles
- preservedSegments contiene los restantes 4
- Si VTT provided → video con subs quemados
- Si music provided → audio mix incluido
```

---

### TAREA 4.6 — Keyboard Shortcuts

**Archivo nuevo:** `src/hooks/useKeyboardShortcuts.ts`

```typescript
// src/hooks/useKeyboardShortcuts.ts
import { useEffect } from 'react';

export interface KeyboardShortcutsConfig {
  onApprove?: () => void;
  onSave?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onClose?: () => void;
  onCycleTab?: (direction: 1 | -1) => void;
}

export function useKeyboardShortcuts(config: KeyboardShortcutsConfig, enabled = true): void {
  useEffect(() => {
    if (!enabled) return;
    
    const handler = (e: KeyboardEvent) => {
      const isMac = navigator.platform.includes('Mac');
      const mod = isMac ? e.metaKey : e.ctrlKey;
      
      // Cmd/Ctrl + Enter → Aprobar
      if (mod && e.key === 'Enter') {
        e.preventDefault();
        config.onApprove?.();
        return;
      }
      
      // Cmd/Ctrl + S → Guardar versión
      if (mod && e.key === 's') {
        e.preventDefault();
        config.onSave?.();
        return;
      }
      
      // Cmd/Ctrl + Z → Undo
      if (mod && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        config.onUndo?.();
        return;
      }
      
      // Cmd/Ctrl + Shift + Z → Redo
      if (mod && e.shiftKey && e.key === 'Z') {
        e.preventDefault();
        config.onRedo?.();
        return;
      }
      
      // Esc → Cerrar
      if (e.key === 'Escape') {
        e.preventDefault();
        config.onClose?.();
        return;
      }
      
      // Tab → Ciclar entre tabs (sin modifier)
      if (e.key === 'Tab' && !mod) {
        e.preventDefault();
        config.onCycleTab?.(e.shiftKey ? -1 : 1);
      }
    };
    
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [config, enabled]);
}
```

**Tests:**
```typescript
// src/__tests__/useKeyboardShortcuts.test.ts
- Cmd+Enter dispara onApprove
- Esc dispara onClose
- Cmd+S dispara onSave
- Tab cicla tab con direction=1
- Shift+Tab cicla con direction=-1
- Cuando enabled=false → no listener attached
```

---

### TAREA 4.7 — Integración con Storyboard

**Modificaciones:**
- `src/components/storyboard/KeyframeStoryboard.tsx`: Click nodo → abrir SplitViewEditor
- `src/stores/uiStore.ts`: Nuevo `splitViewTransitionId: string | null`
- `src/components/generation/ExportCenter.tsx` (Master Tab): Botón "Editar Nodo" por clip generado → abre SplitViewEditor

**Lógica:**
```typescript
// En KeyframeStoryboard.tsx
const openSplitEditor = (transitionId: string) => {
  uiStore.openSplitView(transitionId);
};

// Render condicional
{uiStore.splitViewTransitionId === transition.id && (
  <SplitViewEditor
    transitionId={transition.id}
    keyframeFrom={kfFrom}
    keyframeTo={kfTo}
    promptVersion={transition.promptHistory[0]}
    onApprove={...}
    onRegenerateVisual={...}
    onRegenerateVO={...}
    onUpdateSubtitles={...}
    onRestoreVersion={...}
    onClose={() => uiStore.closeSplitView()}
  />
)}
```

**Tests:**
```typescript
- Click nodo "Deseo" en Storyboard → SplitViewEditor abre con datos correctos
- Click cerrar SplitViewEditor → cierra modal
- Click "Editar Nodo" en ExportCenter.MasterTab → abre SplitViewEditor del clip correspondiente
```

---

## 🔧 INTEGRACIÓN CON CÓDIGO EXISTENTE

| Archivo S1-S3 | Cambio Requerido |
|---|---|
| `src/stores/projectStore.ts` | Añadir método `restoreTransitionPrompt(id, promptVersionId)` para VersionHistory |
| `src/components/storyboard/KeyframeStoryboard.tsx` | Click nodo abre SplitViewEditor |
| `src/components/generation/ExportCenter.tsx` (MasterTab) | Botón "Editar" por clip en la timeline |
| `src/services/ffmpeg.ts` | Extender con `smartConcat` worker message handler |
| `package.json` | Añadir `@uiw/react-codemirror @codemirror/lang-markdown @codemirror/theme-one-dark` (opcional — si elige UI library) |
| `src/stores/uiStore.ts` | Nuevo slice `splitViewTransitionId` |

---

## 🧪 PLAN DE TESTING INTEGRAL

### Unit Tests (Vitest, ≥80% coverage en nuevos archivos)

| Archivo | Tests Mínimos |
|---------|--------------|
| `tokenCounter.test.ts` | 5 (count, limit, warning, danger, safe) |
| `syntaxHighlight.test.ts` | 6 (cinema, anchor, movement, plain, case-insensitive) |
| `versionHistory.test.ts` | 4 (record, get, restore, diff, max 5) |
| `smartConcat.test.ts` | 4 (preserved+new, VTT, music, duration) |
| `useKeyboardShortcuts.test.ts` | 6 (Cmd+Enter, Esc, Cmd+S, Tab, Shift+Tab, disabled) |

### Integration Tests (Vitest + Testing Library)

| Test | Resultado Esperado |
|------|--------------------|
| `SplitViewEditor.test.tsx` | Renderiza, drag divider, tabs, version history |
| `InlineNodeEditor.test.tsx` | 4 tabs funcional, regenerate callbacks |
| `VersionHistory.test.tsx` | Lista 5 versiones, click restaura |

### Manual Acceptance Checklist (12 items)

Verificar tras implementación:

- [ ] Click nodo "Deseo" en Storyboard → SplitViewEditor abre
- [ ] Split inicia 50/50, drag divider cambia %, persiste tras F5
- [ ] Cmd+Enter aprueba prompt → prompt guardado como nueva versión
- [ ] Esc cierra SplitViewEditor
- [ ] Tab cicla entre 4 tabs (Visual → VO → Subs → Camera)
- [ ] Editar VO → "Regenerar Audio" → preview actualizado en <5s
- [ ] Editar intención visual → "Regenerar Visual" → Imagen 3 + Veo → preview en 2 min
- [ ] Token counter actualiza en tiempo real con color (verde/amber/rojo)
- [ ] Syntax highlight colorea keywords (dolly verde, FRAME amarillo, etc.)
- [ ] VersionHistory muestra 5 últimas versiones, click restaura prompt
- [ ] Smart Concat reemplaza solo clip tocado, preserva resto → master en <15s
- [ ] Sin regresiones S1+S2+S3: 89 tests anteriores siguen pasando

---

## 🚀 HANDOFF A SOFIA (resumido)

**Orden de implementación recomendado:**

1. **Fase 0** (10min): Instalar `pnpm add @uiw/react-codemirror @codemirror/lang-markdown @codemirror/theme-one-dark`
2. **Fase 1** (1h): `utils/tokenCounter.ts` + `utils/syntaxHighlight.ts` + tests
3. **Fase 2** (1.5h): `components/prompt/PromptEditorV2.tsx` + `hooks/useKeyboardShortcuts.ts` + tests
4. **Fase 3** (1h): `services/versionHistory.ts` (IndexedDB store) + tests
5. **Fase 4** (1h): `components/generation/InlineNodeEditor.tsx` + 4 sub-tabs (Visual/VO/Subs/Camera) + tests
6. **Fase 5** (1h): `components/generation/SplitViewEditor.tsx` + `VersionHistory.tsx` UI + tests
7. **Fase 6** (30min): `services/smartConcat.ts` + worker message handler + tests
8. **Fase 7** (30min): Integración: Storyboard click + ExportCenter.MasterTab "Editar" + uiStore slice
9. **Fase 8** (30min): Validaciones finales

**Validaciones finales:**
- `pnpm typecheck && pnpm test --run && pnpm lint && pnpm build` — todos verde
- 89 S1+S2+S3 tests + ~25 S4 nuevos = **~115 tests esperados**
- Manual Acceptance 12 items

**Riesgos prevenidos:**
- NO romper S1+S2+S3 (regression test obligatorio antes/después)
- Token counter: aproximación ~4 chars/token, no tokenizer real (suficiente para límite Veo)
- VersionHistory en IDB separada store para no inflar projectStore
- SmartConcat: si clip no existe → skip (no fallar)
- Keyboard shortcuts: deshabilitar si input/textarea focused (excepto Cmd+Enter que es global)

---

## 📌 NOTAS PARA SOFIA

1. **NO romper S1+S2+S3**: Validar 89 tests anteriores pasan antes y después.
2. **CodeMirror opcional**: Si prefieres editor custom sin CodeMirror (más simple, no dep), puedes. SPEC menciona CodeMirror como ejemplo; usa lo que funcione.
3. **Token counter**: Aproximación ~4 chars/token. NO usar librería tiktoken (overkill para límites Veo).
4. **Syntax highlight custom**: Mejor que CodeMirror highlight (más rápido, sin dep) — tokens regex-based.
5. **VersionHistory IDB**: store separada `bridge-versions` con migration v3.
6. **SmartConcat worker**: extender `ffmpeg.worker.ts` con handler `SMART_CONCAT` (no nuevo worker).
7. **Drag divider UX**: cursor `col-resize`, hover color sky-500, drag shadow.
8. **Cmd+Enter vs Enter en textarea**: Solo Cmd+Enter aprueba; Enter normal inserta newline.

---

**Fin de SPEC-S4-GRANULAR-EDIT.md**  
*Listo para delegación a SOFIA*