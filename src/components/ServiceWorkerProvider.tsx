import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { APP_COMMIT } from "../utils/appVersion";
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

/**
 * De commit die draaide vlak voor een update-reload. Verschilt hij na de reload
 * van de huidige, dan is de update echt binnen en tonen we "bijgewerkt".
 */
const UPDATED_FROM_KEY = "sl-updated-from";

/**
 * Hoe lang na openen (of terugkeren naar) de app een update nog zonder vragen
 * mag herladen. Daarna ben je bezig, en wacht de update tot je de app wegklikt.
 */
const SAFE_RELOAD_WINDOW_MS = 10_000;

/** Laatste redmiddel als er na SKIP_WAITING geen enkel signaal komt. */
const RELOAD_FALLBACK_MS = 8_000;

/** True als deze pagina geladen is door een update-reload en de versie echt veranderde. */
function readJustUpdated(): boolean {
  try {
    const from = localStorage.getItem(UPDATED_FROM_KEY);
    return from != null && from !== APP_COMMIT;
  } catch {
    return false;
  }
}

/**
 * Activeert de wachtende service worker en herlaadt zodra die de pagina
 * overneemt.
 *
 * Bewust niet via `updateServiceWorker()` van vite-plugin-pwa: die herlaadt
 * alleen als de pagina bij het laden al een controller had. Na een harde
 * reload, of bij het allereerste bezoek, ontbreekt die. Dan activeert de nieuwe
 * versie wel, maar blijft de pagina staan en lijkt "Vernieuwen" niets te doen.
 */
function activateUpdate(registration: ServiceWorkerRegistration | null) {
  let reloading = false;
  const reload = () => {
    if (reloading) return;
    reloading = true;
    try {
      localStorage.setItem(UPDATED_FROM_KEY, APP_COMMIT);
    } catch {
      // Zonder opslag mis je alleen de "bijgewerkt"-melding.
    }
    window.location.reload();
  };

  const waiting = registration?.waiting;
  // Niets meer in de wacht: een andere tab heeft hem al geactiveerd. Een
  // gewone reload laadt dan de nieuwe versie.
  if (!waiting) {
    reload();
    return;
  }

  navigator.serviceWorker.addEventListener("controllerchange", reload, { once: true });
  waiting.addEventListener("statechange", () => {
    if (waiting.state === "activated") reload();
  });
  setTimeout(reload, RELOAD_FALLBACK_MS);
  waiting.postMessage({ type: "SKIP_WAITING" });
}

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
  const [justUpdated, setJustUpdated] = useState(readJustUpdated);
  const lastVisibleAtRef = useRef(Date.now());
  const [offlineAvailable, setOfflineAvailable] = useState(
    () => typeof navigator !== "undefined" && navigator.serviceWorker?.controller != null,
  );

  const {
    needRefresh: [needRefresh],
    offlineReady: [offlineReady, setOfflineReady],
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

  // Eenmalig: de melding hoort bij déze reload, niet bij de volgende.
  useEffect(() => {
    try {
      localStorage.removeItem(UPDATED_FROM_KEY);
    } catch {
      // Niets op te ruimen zonder opslag.
    }
  }, []);

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

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") lastVisibleAtRef.current = Date.now();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  const applyUpdate = useCallback(() => {
    void (async () => {
      const active =
        registration ?? (await navigator.serviceWorker?.getRegistration()) ?? null;
      activateUpdate(active);
    })();
  }, [registration]);

  // Automatisch bijwerken, maar nooit midden in het gebruik: direct als de app
  // net geopend is of op de achtergrond staat, anders zodra je hem wegklikt.
  useEffect(() => {
    if (!needRefresh) return;

    const safeNow =
      document.visibilityState === "hidden" ||
      Date.now() - lastVisibleAtRef.current < SAFE_RELOAD_WINDOW_MS;
    if (safeNow) {
      applyUpdate();
      return;
    }

    const onHidden = () => {
      if (document.visibilityState === "hidden") applyUpdate();
    };
    document.addEventListener("visibilitychange", onHidden);
    return () => document.removeEventListener("visibilitychange", onHidden);
  }, [needRefresh, applyUpdate]);

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
      justUpdated,
      dismissJustUpdated: () => setJustUpdated(false),
      offlineReady,
      dismissOfflineReady: () => setOfflineReady(false),
      applyUpdate,
      checkForUpdate,
      checkState,
      lastCheckedAt,
      offlineAvailable,
    }),
    [
      needRefresh,
      justUpdated,
      offlineReady,
      setOfflineReady,
      applyUpdate,
      checkForUpdate,
      checkState,
      lastCheckedAt,
      offlineAvailable,
    ],
  );

  return <ServiceWorkerContext.Provider value={value}>{children}</ServiceWorkerContext.Provider>;
}
