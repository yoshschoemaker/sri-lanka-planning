import { useCallback, useEffect, useState } from "react";
import {
  clearDeferredPrompt,
  getDeferredPrompt,
  subscribeDeferredPrompt,
} from "./deferredInstallPrompt";
import { isInstallPromptSnoozed, snoozeInstallPrompt } from "./installDismissal";
import { canInstallOnIos, isStandaloneDisplay } from "./pwaDisplayMode";
import { useMediaQuery } from "./useMediaQuery";

export type InstallState =
  /** Draait al vanaf het beginscherm — niets te vragen. */
  | "installed"
  /** Chromium heeft een beforeinstallprompt klaarstaan. */
  | "installable"
  /** iOS: installeren kan alleen handmatig via het deelmenu. */
  | "ios-manual"
  /** Browser die niet kan installeren (desktop Firefox, in-app webviews, ...). */
  | "unavailable";

export interface PwaInstall {
  state: InstallState;
  promptInstall: () => Promise<"accepted" | "dismissed" | "unavailable">;
  snooze: () => void;
  snoozed: boolean;
}

export function usePwaInstall(): PwaInstall {
  // Slaat live om zodra Chrome de app installeert, zonder herladen.
  const standaloneByMediaQuery = useMediaQuery("(display-mode: standalone)");
  const [deferred, setDeferred] = useState(getDeferredPrompt);
  const [snoozed, setSnoozed] = useState(isInstallPromptSnoozed);

  useEffect(() => subscribeDeferredPrompt(setDeferred), []);

  const promptInstall = useCallback(async () => {
    const event = getDeferredPrompt();
    if (!event) return "unavailable" as const;
    await event.prompt();
    const { outcome } = await event.userChoice;
    // Het event is eenmalig; Chrome vuurt een nieuwe pas bij een volgend bezoek.
    clearDeferredPrompt();
    return outcome;
  }, []);

  const snooze = useCallback(() => {
    snoozeInstallPrompt();
    setSnoozed(true);
  }, []);

  let state: InstallState;
  if (standaloneByMediaQuery || isStandaloneDisplay()) {
    state = "installed";
  } else if (deferred) {
    state = "installable";
  } else if (canInstallOnIos()) {
    state = "ios-manual";
  } else {
    state = "unavailable";
  }

  return { state, promptInstall, snooze, snoozed };
}
