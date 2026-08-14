import { createContext, useContext } from "react";

/** Uitkomst van een handmatige controle in het instellingenpaneel. */
export type UpdateCheckState =
  | "idle"
  | "checking"
  | "up-to-date"
  | "update-found"
  | "offline"
  | "unsupported"
  | "error";

export interface ServiceWorkerValue {
  /** Er staat een nieuwe versie klaar die alleen nog geactiveerd moet worden. */
  needRefresh: boolean;
  dismissRefresh: () => void;
  /** Eenmalige melding direct na de eerste precache. */
  offlineReady: boolean;
  dismissOfflineReady: () => void;
  /** Activeert de wachtende versie en herlaadt de pagina. */
  applyUpdate: () => void;
  /** Handmatige controle vanuit het instellingenpaneel. */
  checkForUpdate: () => void;
  checkState: UpdateCheckState;
  lastCheckedAt: number | null;
  /** True zodra een service worker deze pagina bedient, dus offline werkt. */
  offlineAvailable: boolean;
}

export const ServiceWorkerContext = createContext<ServiceWorkerValue | null>(null);

export function useServiceWorker(): ServiceWorkerValue {
  const value = useContext(ServiceWorkerContext);
  if (!value) throw new Error("useServiceWorker vereist een ServiceWorkerProvider");
  return value;
}
