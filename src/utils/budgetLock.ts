import { useCallback, useState } from "react";

const STORAGE_KEY = "srilanka-trip:budget-unlocked";

/**
 * SHA-256 van het wachtwoord van de Budget-tab. Alleen de hash staat in de
 * code, zodat het wachtwoord niet als leesbare tekst in de bundel belandt.
 *
 * Dit is een drempel, geen beveiliging: de prijzen zelf staan in
 * content/trip.json en gaan dus gewoon mee in de bundel. Wie de broncode
 * leest, ziet ze. Genoeg om ze niet open op de pagina te hebben staan.
 */
const PASSWORD_SHA256 = "ab12d3da5e5f0473cd21643423e79a948ca1701b804b0cb29cfc8940c14d68cf";

async function sha256Hex(text: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function checkBudgetPassword(input: string): Promise<boolean> {
  return (await sha256Hex(input.trim().toLowerCase())) === PASSWORD_SHA256;
}

function readUnlocked(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

/** Eenmalig per toestel: na het juiste wachtwoord blijft de Budget-tab open. */
export function useBudgetUnlock() {
  const [unlocked, setUnlocked] = useState(readUnlocked);

  const unlock = useCallback(async (input: string) => {
    const ok = await checkBudgetPassword(input);
    if (ok) {
      setUnlocked(true);
      try {
        window.localStorage.setItem(STORAGE_KEY, "1");
      } catch {
        // Zonder opslag blijft hij alleen deze sessie open.
      }
    }
    return ok;
  }, []);

  return { unlocked, unlock };
}
