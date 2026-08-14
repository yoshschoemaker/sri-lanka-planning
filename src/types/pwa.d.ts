/**
 * `beforeinstallprompt` staat niet in lib.dom (het is geen W3C-standaard, alleen
 * Chromium). Alleen deze aanvullingen zodat de install-flow typed blijft.
 */
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: readonly string[];
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  prompt(): Promise<void>;
}

interface WindowEventMap {
  beforeinstallprompt: BeforeInstallPromptEvent;
  appinstalled: Event;
}

interface Navigator {
  /** iOS-only: true wanneer de pagina vanaf het beginscherm draait. */
  readonly standalone?: boolean;
}
