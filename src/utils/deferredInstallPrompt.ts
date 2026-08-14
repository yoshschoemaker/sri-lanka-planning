/**
 * Chromium vuurt `beforeinstallprompt` vaak al vóór React gemount is, en het
 * event is daarna weg. Deze module registreert de listener als side-effect bij
 * import (zie main.tsx, vóór createRoot) en bewaart het event, zodat
 * usePwaInstall het later alsnog kan gebruiken.
 */

type Listener = (event: BeforeInstallPromptEvent | null) => void;

let stored: BeforeInstallPromptEvent | null = null;
const listeners = new Set<Listener>();

function notify() {
  for (const listener of listeners) listener(stored);
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    // Zonder preventDefault toont Chrome zijn eigen mini-infobar en verdwijnt
    // de mogelijkheid om het moment zelf te kiezen.
    event.preventDefault();
    stored = event;
    notify();
  });

  window.addEventListener("appinstalled", () => {
    stored = null;
    notify();
  });
}

export function getDeferredPrompt(): BeforeInstallPromptEvent | null {
  return stored;
}

export function subscribeDeferredPrompt(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Het event is eenmalig bruikbaar: na prompt() moet het weg. */
export function clearDeferredPrompt(): void {
  stored = null;
  notify();
}
