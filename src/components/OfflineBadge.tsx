import { motion, AnimatePresence } from "framer-motion";
import { useOnlineStatus } from "../utils/useOnlineStatus";
import { useReducedMotion } from "../utils/useReducedMotion";
import { OfflineIcon } from "./icons";

/**
 * Klein bandje in de header zodra er geen verbinding is.
 *
 * De app is offline-first en werkt onderweg zonder bereik gewoon door, maar zei
 * dat nergens: je zag dezelfde pagina en kon niet weten of je naar de actuele
 * planning keek of naar wat er in de precache stond. Dit benoemt dat, zonder
 * het als storing te presenteren, want offline werken is hier de bedoeling.
 */
export function OfflineBadge() {
  const online = useOnlineStatus();
  const prefersReducedMotion = useReducedMotion();

  return (
    <AnimatePresence>
      {!online && (
        <motion.p
          initial={{ opacity: 0, height: prefersReducedMotion ? "auto" : 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: prefersReducedMotion ? "auto" : 0 }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.25 }}
          // role="status" in plaats van "alert": dit is informatie, geen fout
          // waarvoor je iemand moet onderbreken.
          role="status"
          className="overflow-hidden bg-ink text-cream"
        >
          <span className="mx-auto flex max-w-6xl items-center gap-2 px-5 py-1.5 text-xs font-medium sm:px-8">
            <OfflineIcon className="h-3.5 w-3.5 shrink-0" />
            Geen verbinding. Je ziet de opgeslagen planning.
          </span>
        </motion.p>
      )}
    </AnimatePresence>
  );
}
