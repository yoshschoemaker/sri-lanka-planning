const STORAGE_KEY = "srilanka-trip:daily-countdown-shown";

function dateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** True the first time this is checked on a given calendar day on this device; false on every later check that same day. */
export function shouldShowDailyCountdown(now: Date = new Date()): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== dateKey(now);
  } catch {
    return false;
  }
}

export function markDailyCountdownShown(now: Date = new Date()): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, dateKey(now));
  } catch {
    // Storage can be unavailable (private browsing, quota) — the daily flourish just won't persist, which is harmless.
  }
}
