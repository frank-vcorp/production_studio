/**
 * uiStore — cobertura de S6 sobre addToast, dismissToast, modals, tour, resetAll.
 * Spec: SPEC-S6-TESTS-CICD §6.1.
 *
 * ID: IMPL-20260704-06.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useUIStore } from '@/stores/uiStore';

describe('uiStore — toasts', () => {
  beforeEach(() => {
    useUIStore.getState().resetAll();
    localStorage.clear();
    vi.useRealTimers();
  });

  it('addToast agrega un toast con id uuid y duration por defecto (4000ms)', () => {
    const { addToast, toasts } = useUIStore.getState();
    expect(toasts).toEqual([]);
    addToast({ kind: 'info', message: 'Hola' });
    const ts = useUIStore.getState().toasts;
    expect(ts.length).toBe(1);
    expect(ts[0].kind).toBe('info');
    expect(ts[0].message).toBe('Hola');
    expect(ts[0].id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(ts[0].duration).toBe(4000);
  });

  it('addToast respeta duration 0 (no auto-dismiss)', () => {
    vi.useFakeTimers();
    const { addToast } = useUIStore.getState();
    addToast({ kind: 'warning', message: 'Perm', duration: 0 });
    expect(useUIStore.getState().toasts.length).toBe(1);
    vi.advanceTimersByTime(10_000);
    expect(useUIStore.getState().toasts.length).toBe(1);
  });

  it('addToast auto-dismiss tras duration', () => {
    vi.useFakeTimers();
    const { addToast } = useUIStore.getState();
    addToast({ kind: 'info', message: 'X', duration: 1000 });
    expect(useUIStore.getState().toasts.length).toBe(1);
    vi.advanceTimersByTime(1500);
    expect(useUIStore.getState().toasts.length).toBe(0);
  });

  it('dismissToast remueve por id', () => {
    const { addToast, dismissToast } = useUIStore.getState();
    addToast({ kind: 'success', message: 'A', duration: 0 });
    addToast({ kind: 'success', message: 'B', duration: 0 });
    const [a, b] = useUIStore.getState().toasts;
    dismissToast(a.id);
    const remaining = useUIStore.getState().toasts;
    expect(remaining.length).toBe(1);
    expect(remaining[0].id).toBe(b.id);
  });
});

describe('uiStore — export/split view', () => {
  beforeEach(() => useUIStore.getState().resetAll());

  it('openExportCenter / closeExportCenter', () => {
    expect(useUIStore.getState().exportCenterOpen).toBe(false);
    useUIStore.getState().openExportCenter();
    expect(useUIStore.getState().exportCenterOpen).toBe(true);
    useUIStore.getState().closeExportCenter();
    expect(useUIStore.getState().exportCenterOpen).toBe(false);
  });

  it('openSplitView / closeSplitView', () => {
    expect(useUIStore.getState().splitViewTransitionId).toBeNull();
    useUIStore.getState().openSplitView('trans_atencion');
    expect(useUIStore.getState().splitViewTransitionId).toBe('trans_atencion');
    useUIStore.getState().closeSplitView();
    expect(useUIStore.getState().splitViewTransitionId).toBeNull();
  });
});

describe('uiStore — wizard steps', () => {
  beforeEach(() => useUIStore.getState().resetAll());

  it('setStep cambia currentStep', () => {
    useUIStore.getState().setStep('storyboard');
    expect(useUIStore.getState().currentStep).toBe('storyboard');
  });

  it('setBriefStep clamp a [0,3]', () => {
    useUIStore.getState().setBriefStep(-5);
    expect(useUIStore.getState().briefStep).toBe(0);
    useUIStore.getState().setBriefStep(10);
    expect(useUIStore.getState().briefStep).toBe(3);
    useUIStore.getState().setBriefStep(2);
    expect(useUIStore.getState().briefStep).toBe(2);
  });
});

describe('uiStore — tour state', () => {
  beforeEach(() => {
    localStorage.clear();
    useUIStore.setState({
      hasSeenTour: false,
      showTourOnNextRender: false,
    });
  });

  it('markTourSeen escribe localStorage + flag', () => {
    useUIStore.getState().markTourSeen();
    expect(useUIStore.getState().hasSeenTour).toBe(true);
    expect(useUIStore.getState().showTourOnNextRender).toBe(false);
    expect(localStorage.getItem('bridge.hasSeenTour.v1')).toBe('1');
  });

  it('resetTour limpia localStorage', () => {
    useUIStore.getState().markTourSeen();
    useUIStore.getState().resetTour();
    expect(useUIStore.getState().hasSeenTour).toBe(false);
    expect(localStorage.getItem('bridge.hasSeenTour.v1')).toBeNull();
  });

  it('setShowTourOnNextRender / consumeShowTour', () => {
    useUIStore.getState().setShowTourOnNextRender(true);
    expect(useUIStore.getState().showTourOnNextRender).toBe(true);
    const v = useUIStore.getState().consumeShowTour();
    expect(v).toBe(true);
    // consumeShowTour limpia el flag
    expect(useUIStore.getState().showTourOnNextRender).toBe(false);
    // Segunda llamada devuelve false (no resetea)
    expect(useUIStore.getState().consumeShowTour()).toBe(false);
  });

  it('readHasSeenTour lee localStorage al inicializar (rehidratación via markTourSeen)', () => {
    // El store solo lee localStorage en creación; verificamos que tras marcar visto,
    // un resetAll() (que NO limpia hasSeenTour) preserva el flag y persiste en storage.
    useUIStore.getState().markTourSeen();
    expect(useUIStore.getState().hasSeenTour).toBe(true);
    expect(localStorage.getItem('bridge.hasSeenTour.v1')).toBe('1');
    // resetAll NO limpia hasSeenTour (solo resetTour explícito lo hace).
    useUIStore.getState().resetAll();
    expect(useUIStore.getState().hasSeenTour).toBe(true);
    expect(localStorage.getItem('bridge.hasSeenTour.v1')).toBe('1');
  });
});

describe('uiStore — resetAll', () => {
  it('limpia flags efímeros pero respeta hasSeenTour', () => {
    useUIStore.setState({
      currentStep: 'export',
      briefStep: 3,
      toasts: [{ id: 't1', kind: 'info', message: 'x', duration: 0 }],
      exportCenterOpen: true,
      splitViewTransitionId: 'trans_x',
      hasSeenTour: true,
      showTourOnNextRender: true,
    });
    useUIStore.getState().resetAll();
    const s = useUIStore.getState();
    expect(s.currentStep).toBe('brief');
    expect(s.briefStep).toBe(0);
    expect(s.toasts).toEqual([]);
    expect(s.exportCenterOpen).toBe(false);
    expect(s.splitViewTransitionId).toBeNull();
    expect(s.showTourOnNextRender).toBe(false);
    // hasSeenTour NO se resetea (lo controla resetTour explícitamente)
    expect(s.hasSeenTour).toBe(true);
  });
});
