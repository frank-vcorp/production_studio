/**
 * Helper puro para ciclar entre tabs de InlineNodeEditor.
 * Spec: SPEC-S4-GRANULAR-EDIT §4.3.
 * Separado del componente para evitar warning de react-refresh.
 */

export type NodeEditTab = 'visual' | 'vo' | 'subs' | 'camera';

export const TAB_ORDER: readonly NodeEditTab[] = ['visual', 'vo', 'subs', 'camera'] as const;

export function cycleNodeEditTab(current: NodeEditTab, direction: 1 | -1): NodeEditTab {
  const idx = TAB_ORDER.indexOf(current);
  const next = (idx + direction + TAB_ORDER.length) % TAB_ORDER.length;
  return TAB_ORDER[next];
}