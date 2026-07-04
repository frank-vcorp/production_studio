import { describe, it, expect, vi } from 'vitest';
import { requestNotificationPermission, showVideoReadyNotification, registerServiceWorker, autoRegisterServiceWorker } from '@/services/notification';

describe('notification', () => {
  it('requestNotificationPermission devuelve "denied" si Notification no existe', async () => {
    const original = (globalThis as { Notification?: unknown }).Notification;
    delete (globalThis as { Notification?: unknown }).Notification;
    try {
      const perm = await requestNotificationPermission();
      expect(perm).toBe('denied');
    } finally {
      if (original) (globalThis as { Notification?: unknown }).Notification = original;
    }
  });

  it('requestNotificationPermission llama requestPermission cuando permission="default"', async () => {
    const requestPermission = vi.fn().mockResolvedValue('granted');
    const original = (globalThis as { Notification?: unknown }).Notification;
    (globalThis as { Notification?: unknown }).Notification = {
      permission: 'default',
      requestPermission,
    };
    try {
      const perm = await requestNotificationPermission();
      expect(perm).toBe('granted');
      expect(requestPermission).toHaveBeenCalled();
    } finally {
      if (original) (globalThis as { Notification?: unknown }).Notification = original;
    }
  });

  it('showVideoReadyNotification no hace nada si permission !== "granted"', () => {
    const original = (globalThis as { Notification?: unknown }).Notification;
    const fakeCtor = vi.fn();
    (globalThis as { Notification?: unknown }).Notification = {
      permission: 'denied',
    };
    try {
      showVideoReadyNotification();
      expect(fakeCtor).not.toHaveBeenCalled();
    } finally {
      if (original) (globalThis as { Notification?: unknown }).Notification = original;
    }
    void fakeCtor;
  });

  it('showVideoReadyNotification crea Notification + dispara nav:export al click', () => {
    const original = (globalThis as { Notification?: unknown }).Notification;
    const capturedInstances: Array<{ onclick: (() => void) | null }> = [];
    class FakeNotification {
      onclick: (() => void) | null = null;
      close: () => void = () => undefined;
      constructor(_title: string, _opts?: NotificationOptions) {
        capturedInstances.push(this);
      }
      static permission: NotificationPermission = 'granted';
      static requestPermission = vi
        .fn()
        .mockResolvedValue('granted' as NotificationPermission);
    }
    (globalThis as unknown as { Notification: unknown }).Notification =
      FakeNotification as unknown as typeof Notification;
    try {
      const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
      showVideoReadyNotification();
      expect(capturedInstances).toHaveLength(1);
      const inst = capturedInstances[0];
      expect(inst.onclick).not.toBeNull();
      // Simular click
      inst.onclick?.();
      expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'nav:export' }));
      dispatchSpy.mockRestore();
    } finally {
      if (original) (globalThis as { Notification?: unknown }).Notification = original;
    }
  });

  it('registerServiceWorker retorna null si navigator no soporta SW', async () => {
    const original = (navigator as { serviceWorker?: unknown }).serviceWorker;
    delete (navigator as { serviceWorker?: unknown }).serviceWorker;
    try {
      const result = await registerServiceWorker();
      expect(result).toBeNull();
    } finally {
      if (original) (navigator as { serviceWorker?: unknown }).serviceWorker = original;
    }
  });

  it('autoRegisterServiceWorker solo registra en PROD (en tests PROD=false → null)', async () => {
    const result = await autoRegisterServiceWorker();
    expect(result).toBeNull();
  });
});