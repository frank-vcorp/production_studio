/**
 * InlineNodeEditor — contenedor con 4 tabs (Visual/VO/Subs/Camera).
 * Spec: SPEC-S4-GRANULAR-EDIT §4.3.
 *
 * Se monta dentro del SplitViewEditor (panel izquierdo). Ciclar tabs
 * se hace vía `onCycleTab` (que viene de useKeyboardShortcuts).
 */

import { useState } from 'react';
import type { Keyframe, CameraSpec } from '@/types/keyframe';
import type { KeyframeTransition } from '@/types/transition';
import { VisualTab } from '@/components/generation/tabs/VisualTab';
import { VOTab, type VoiceOption } from '@/components/generation/tabs/VOTab';
import { SubsTab } from '@/components/generation/tabs/SubsTab';
import { CameraTab } from '@/components/generation/tabs/CameraTab';
import {
  TAB_ORDER,
  type NodeEditTab,
} from '@/components/generation/nodeEditTab';

export type { NodeEditTab } from '@/components/generation/nodeEditTab';

export interface InlineNodeEditorProps {
  transition: KeyframeTransition;
  keyframeFrom: Keyframe;
  keyframeTo: Keyframe;
  /** Tab controlado (opcional) para integración con useKeyboardShortcuts. */
  activeTab?: NodeEditTab;
  onTabChange?: (tab: NodeEditTab) => void;
  onRegenerateVisual: (intent: string) => Promise<void>;
  onRegenerateVO: (text: string, voice: VoiceOption) => Promise<void>;
  onUpdateSubtitles: (text: string) => Promise<void>;
  onUpdateCameraSpec: (spec: CameraSpec) => Promise<void>;
}

const TAB_META: Record<NodeEditTab, { label: string; icon: string }> = {
  visual: { label: 'Visual', icon: 'fa-eye' },
  vo: { label: 'Voz', icon: 'fa-microphone' },
  subs: { label: 'Subtítulos', icon: 'fa-closed-captioning' },
  camera: { label: 'Cámara', icon: 'fa-camera' },
};

export function InlineNodeEditor({
  transition,
  keyframeFrom,
  keyframeTo,
  activeTab: controlledTab,
  onTabChange,
  onRegenerateVisual,
  onRegenerateVO,
  onUpdateSubtitles,
  onUpdateCameraSpec,
}: InlineNodeEditorProps): JSX.Element {
  const [internalTab, setInternalTab] = useState<NodeEditTab>('visual');
  const activeTab = controlledTab ?? internalTab;

  const setTab = (tab: NodeEditTab): void => {
    if (onTabChange) onTabChange(tab);
    else setInternalTab(tab);
  };

  return (
    <div className="flex flex-col h-full bg-slate-900" data-testid="inline-node-editor">
      {/* TabBar */}
      <div role="tablist" className="flex border-b border-slate-800">
        {TAB_ORDER.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={activeTab === t}
            aria-controls={`panel-${t}`}
            id={`tab-${t}`}
            data-testid={`tab-${t}`}
            onClick={() => setTab(t)}
            className={`flex-1 px-3 py-2 text-[11px] font-semibold flex items-center justify-center gap-2 transition-colors ${
              activeTab === t
                ? 'bg-sky-500 text-white'
                : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            <i className={`fa-solid ${TAB_META[t].icon}`} />
            {TAB_META[t].label}
          </button>
        ))}
      </div>

      {/* Panel */}
      <div className="flex-1 overflow-y-auto" id={`panel-${activeTab}`}>
        {activeTab === 'visual' && (
          <VisualTab
            keyframeFrom={keyframeFrom}
            keyframeTo={keyframeTo}
            initialIntent={keyframeFrom.humanIntent ?? ''}
            onRegenerateVisual={onRegenerateVisual}
          />
        )}
        {activeTab === 'vo' && (
          <VOTab
            initialText=""
            onRegenerateVO={async (text, voice) => {
              await onRegenerateVO(text, voice);
            }}
          />
        )}
        {activeTab === 'subs' && (
          <SubsTab
            initialText=""
            onUpdateSubtitles={async (text) => {
              await onUpdateSubtitles(text);
            }}
          />
        )}
        {activeTab === 'camera' && (
          <CameraTab
            initialSpec={transition.cameraSpec}
            onUpdateCameraSpec={async (spec) => {
              await onUpdateCameraSpec(spec);
            }}
          />
        )}
      </div>
    </div>
  );
}