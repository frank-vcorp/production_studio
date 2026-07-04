/**
 * notification — Notification API + Service Worker registration.
 * Spec: SPEC-S2-ROBUSTNESS §Tarea 2.6.
 */

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined') return 'denied';
  if (!('Notification' in window)) return 'denied';
  if (Notification.permission === 'default') {
    return await Notification.requestPermission();
  }
  return Notification.permission;
}

export function showVideoReadyNotification(): void {
  if (typeof window === 'undefined') return;
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  const n = new Notification('🎬 Tu video publicitario está listo', {
    body: 'Click para ver el resultado final en el Export Center',
    tag: 'video-ready',
    requireInteraction: true,
  });

  n.onclick = () => {
    window.focus();
    window.dispatchEvent(new CustomEvent('nav:export'));
    n.close();
  };
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === 'undefined') return null;
  if (!('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.register('/sw.js');
  } catch (err) {
    console.warn('[Notification] SW registration failed:', err);
    return null;
  }
}

/** Auto-registro seguro: solo en PROD. */
export async function autoRegisterServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!import.meta.env.PROD) return null;
  return registerServiceWorker();
}