import { useEffect, useState } from "react";

/**
 * Of de browser denkt dat er verbinding is.
 *
 * `navigator.onLine` is niet waterdicht (een wifi zonder internet meldt zich
 * als online), maar de gevallen die hier tellen zijn vliegtuigstand en een
 * telefoon zonder bereik in het binnenland, en die meldt hij wel correct.
 */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));

  useEffect(() => {
    function update() {
      setOnline(navigator.onLine);
    }
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    // Een toestel dat uit stand-by komt kan de events gemist hebben.
    document.addEventListener("visibilitychange", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);

  return online;
}
