import { useEffect, useState } from "react";
import { getTripStatus, type TripStatus } from "./countdown";

/** Milliseconden tot de eerstvolgende plaatselijke middernacht, plus een seconde marge zodat de timer niet nét te vroeg valt. */
function msUntilMidnight(now: Date): number {
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return midnight.getTime() - now.getTime() + 1000;
}

/**
 * De reisstatus als levende waarde in plaats van een momentopname.
 *
 * getTripStatus() bij het renderen aanroepen ging mis op precies het moment
 * waarop deze app gebruikt wordt: een geïnstalleerde PWA blijft dagen in de
 * achtergrond staan, en toonde bij terugkomst nog het aantal dagen van de dag
 * dat je hem voor het laatst opende. Deze hook herrekent op twee momenten:
 *
 * - bij de eerstvolgende middernacht, voor een venster dat open blijft staan;
 * - als het tabblad weer zichtbaar wordt, want een achtergrondtimer wordt door
 *   iOS niet betrouwbaar afgevuurd en kan dagen te laat zijn.
 *
 * Eén hook voor de hele app, zodat de header en de statistieken het niet over
 * twee eigen `new Date()`-aanroepen oneens kunnen worden rond middernacht.
 */
export function useTripStatus(start: string, end: string): TripStatus {
  const [status, setStatus] = useState(() => getTripStatus(start, end));

  useEffect(() => {
    let timer: number | undefined;

    function refresh() {
      const now = new Date();
      setStatus(getTripStatus(start, end, now));
      // Steeds één timer naar de volgende middernacht in plaats van een
      // interval: zo blijft hij op de dagovergang staan ook als het toestel
      // tussendoor heeft geslapen en de timer laat afgaat.
      window.clearTimeout(timer);
      timer = window.setTimeout(refresh, msUntilMidnight(now));
    }

    function handleVisibility() {
      if (document.visibilityState === "visible") refresh();
    }

    refresh();
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [start, end]);

  return status;
}
