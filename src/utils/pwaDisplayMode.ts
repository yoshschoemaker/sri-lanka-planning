/** Platformdetectie voor de install-flow. Pure functies, geen React. */

function ua(): string {
  if (typeof navigator === "undefined") return "";
  return navigator.userAgent;
}

function matches(query: string): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia(query).matches;
}

/** True zodra de app als geïnstalleerde app draait in plaats van in een browsertab. */
export function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return false;
  return (
    matches("(display-mode: standalone)") ||
    matches("(display-mode: fullscreen)") ||
    matches("(display-mode: minimal-ui)") ||
    // Safari implementeert display-mode niet; dit is daar het enige signaal.
    navigator.standalone === true ||
    // Chrome op Android wanneer de app via een WebAPK is gestart.
    document.referrer.startsWith("android-app://")
  );
}

export function isIosDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  // iPadOS 13+ doet zich standaard voor als macOS; maxTouchPoints verraadt hem.
  const iPadOsMasqueradingAsMac = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return /iPad|iPhone|iPod/.test(ua()) || iPadOsMasqueradingAsMac;
}

export function isIpad(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad/.test(ua()) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

/** Welke route naar het beginscherm deze iOS-browser heeft. */
export type IosInstallRoute =
  /** Safari: "Zet op beginscherm" staat vast in het deelmenu. */
  | "safari"
  /**
   * Chrome, Edge en Firefox mogen sinds iOS 16.4 dezelfde actie in het
   * systeem-deelmenu aanbieden. Alleen staat de deelknop ergens anders, en de
   * actie kan onder "Wijzig acties" verstopt zitten.
   */
  | "share-sheet"
  /** Google-app en in-app webviews: geen deelmenu met die actie. */
  | "none";

export function iosInstallRoute(): IosInstallRoute {
  if (!isIosDevice()) return "none";
  const agent = ua();
  if (/CriOS|EdgiOS|FxiOS/.test(agent)) return "share-sheet";
  if (/GSA|FBAN|FBAV|Instagram|LinkedInApp|OPiOS|OPT\//.test(agent)) return "none";
  return "safari";
}

/** True zodra deze iOS-browser de app op het beginscherm kán zetten. */
export function canInstallOnIos(): boolean {
  return iosInstallRoute() !== "none";
}
