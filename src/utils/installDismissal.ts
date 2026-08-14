const STORAGE_KEY = "srilanka-trip:install-prompt-snoozed";
const SNOOZE_DAYS = 30;

/**
 * True zolang de gebruiker de install-banner recent heeft weggeklikt. Bewust
 * tijdelijk in plaats van voorgoed: de reis is pas in 2027, dus een "later" van
 * vandaag mag over een maand opnieuw gevraagd worden.
 */
export function isInstallPromptSnoozed(now: Date = new Date()): boolean {
  if (typeof window === "undefined") return false;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return false;
    const snoozedAt = Date.parse(stored);
    if (Number.isNaN(snoozedAt)) return false;
    return now.getTime() - snoozedAt < SNOOZE_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

export function snoozeInstallPrompt(now: Date = new Date()): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, now.toISOString());
  } catch {
    // Storage kan onbeschikbaar zijn (private browsing, quota) — dan komt de
    // banner een volgende keer gewoon opnieuw, wat vervelend maar onschadelijk is.
  }
}
