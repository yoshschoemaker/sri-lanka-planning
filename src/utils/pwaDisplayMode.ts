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

/**
 * Alleen Safari op iOS kan "Zet op beginscherm"; Chrome/Firefox/Edge/Opera en de
 * Google-app draaien daar wel op WebKit maar hebben die menu-optie niet. De
 * instructiemodal zou daar naar iets wijzen dat niet bestaat.
 */
export function isIosSafari(): boolean {
  return isIosDevice() && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA/.test(ua());
}
