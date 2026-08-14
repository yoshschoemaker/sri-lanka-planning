import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { requestPersistentStorage } from "../utils/persistentStorage";
import {
  ServiceWorkerContext,
  type ServiceWorkerValue,
  type UpdateCheckState,
} from "../utils/serviceWorkerContext";

/** Hoe vaak een openstaande tab bij de server naar een nieuwe versie vraagt. */
const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

/** Overleeft de reload die het toepassen van een update veroorzaakt. */
const LAST_CHECK_KEY = "sl-last-update-check";

function readLastCheck(): number | null {
  try {
    const raw = localStorage.getItem(LAST_CHECK_KEY);
    if (!raw) return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

/**
 * Vraagt de server om een nieuwe service worker en wacht af of die er is.
 *
 * `registration.update()` is al klaar zodra het sw-bestand binnen is; of er een
 * nieuwe versie in zat blijkt pas uit de installatie die daarna start. Zonder
 * dat wachten meldt een handmatige controle altijd dat je up-to-date bent.
 */
async function hasWaitingUpdate(registration: ServiceWorkerRegistration): Promise<boolean> {
  await registration.update();
  if (registration.waiting) return true;

  const installing = registration.installing;
  // Zonder actieve worker is dit de eerste installatie, geen update.
  if (!installing || !registration.active) return false;

  return await new Promise<boolean>((resolve) => {
    const finish = (result: boolean) => {
      installing.removeEventListener("statechange", onStateChange);
      resolve(result);
    };
    const onStateChange = () => {
      if (installing.state === "installed") finish(true);
      else if (installing.state === "redundant") finish(false);
    };
    installing.addEventListener("statechange", onStateChange);
  });
}

/**
 * Registreert de service worker precies één keer en deelt de update-status met
 * de rest van de app: UpdatePrompt toont de toast, SettingsSheet de handmatige
 * controle, en beide moeten naar dezelfde registratie kijken.
 */
export function ServiceWorkerProvider({ children }: { children: ReactNode }) {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [checkState, setCheckState] = useState<UpdateCheckState>("idle");
  const [lastCheckedAt, setLastCheckedAt] = useState<number | null>(() => readLastCheck());
  const [offlineAvailable, setOfflineAvailable] = useState(
    () => typeof navigator !== "undefined" && navigator.serviceWorker?.controller != null,
  );

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, swRegistration) {
      setRegistration(swRegistration ?? null);
      // Pas hier zinvol: vóór de registratie valt er nog geen precache te
      // beschermen. Draait elke start opnieuw tot het systeem ja zegt.
      void requestPersistentStorage();
    },
    onRegisterError(error) {
      console.error("Service worker registratie mislukt:", error);
    },
  });

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.serviceWorker) return;
    const onControllerChange = () =>
      setOfflineAvailable(navigator.serviceWorker.controller != null);
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    return () =>
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
  }, []);

  useEffect(() => {
    if (registration?.active) setOfflineAvailable(true);
  }, [registration]);

  useEffect(() => {
    if (!registration) return;

    const check = () => {
      if (navigator.onLine) void registration.update();
    };
    const interval = setInterval(check, UPDATE_CHECK_INTERVAL_MS);
    // Een standalone app op iOS draait vaak dagenlang dezelfde sessie door;
    // zonder deze check zie je een update pas na een koude start.
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [registration]);

  const checkForUpdate = useCallback(() => {
    if (checkState === "checking") return;

    void (async () => {
      if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
        setCheckState("unsupported");
        return;
      }
      if (!navigator.onLine) {
        setCheckState("offline");
        return;
      }

      setCheckState("checking");
      try {
        const active = registration ?? (await navigator.serviceWorker.getRegistration()) ?? null;
        if (!active) {
          setCheckState("unsupported");
          return;
        }
        const found = await hasWaitingUpdate(active);
        const now = Date.now();
        setLastCheckedAt(now);
        try {
          localStorage.setItem(LAST_CHECK_KEY, String(now));
        } catch {
          // Private browsing: het tijdstempel is een detail, de controle niet.
        }
        setCheckState(found ? "update-found" : "up-to-date");
      } catch (error) {
        console.error("Controle op een nieuwe versie mislukt:", error);
        setCheckState("error");
      }
    })();
  }, [checkState, registration]);

  const value = useMemo<ServiceWorkerValue>(
    () => ({
      needRefresh,
      dismissRefresh: () => setNeedRefresh(false),
      offlineReady,
      dismissOfflineReady: () => setOfflineReady(false),
      applyUpdate: () => void updateServiceWorker(true),
      checkForUpdate,
      checkState,
      lastCheckedAt,
      offlineAvailable,
    }),
    [
      needRefresh,
      setNeedRefresh,
      offlineReady,
      setOfflineReady,
      updateServiceWorker,
      checkForUpdate,
      checkState,
      lastCheckedAt,
      offlineAvailable,
    ],
  );

  return <ServiceWorkerContext.Provider value={value}>{children}</ServiceWorkerContext.Provider>;
}
