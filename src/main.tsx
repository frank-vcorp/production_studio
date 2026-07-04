import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './styles/globals.css';

const rootEl = document.getElementById('root');
if (!rootEl) {
  throw new Error('Root element #root not found in DOM');
}

/**
 * E2E test bridge — expone stores y jobQueue en window para que los specs
 * Playwright puedan inyectar estado (brief aprobado, masterVideo mock, jobs)
 * sin depender de la red (proxy / Veo / FFmpeg no disponibles en CI).
 *
 * Spec: SPEC-S6-TESTS-CICD §6.2 — happy-path E2E specs.
 * Solo activo en dev/CI; en build production Vite hace tree-shaking de
 * ramas import.meta.env.DEV === false, así que NO llega al bundle final.
 *
 * ID: IMPL-20260704-06.
 */
if (import.meta.env.DEV || import.meta.env.MODE === 'test' || (typeof window !== 'undefined' && (window as { __BRIDGE_E2E__?: boolean }).__BRIDGE_E2E__)) {
  void Promise.all([
    import('@/stores/projectStore'),
    import('@/stores/uiStore'),
    import('@/services/jobQueue'),
  ]).then(([projectMod, uiMod, jqMod]) => {
    (window as unknown as { __projectStore__: typeof projectMod.useProjectStore }).__projectStore__ =
      projectMod.useProjectStore;
    (window as unknown as { __uiStore__: typeof uiMod.useUIStore }).__uiStore__ =
      uiMod.useUIStore;
    (window as unknown as { __jobQueue__: typeof jqMod.jobQueue }).__jobQueue__ =
      jqMod.jobQueue;
  });
}

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
