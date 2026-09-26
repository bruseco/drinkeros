// Captura global do evento `beforeinstallprompt` (Android/Chrome/desktop).
// O evento pode disparar antes de qualquer componente montar, então guardamos aqui.
export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    listeners.forEach((l) => l());
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    listeners.forEach((l) => l());
  });
}

export const getDeferredInstallPrompt = () => deferred;
export const clearDeferredInstallPrompt = () => {
  deferred = null;
  listeners.forEach((l) => l());
};
export function onInstallPromptChange(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export const isIOSDevice = () =>
  typeof navigator !== 'undefined' &&
  (/iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && (navigator as any).maxTouchPoints > 1));
