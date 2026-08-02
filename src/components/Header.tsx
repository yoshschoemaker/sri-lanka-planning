import { motion } from "framer-motion";
import type { Trip, Stop } from "../types/trip";
import { FlightCard } from "./FlightCard";
import { computeNightsCheck } from "../utils/nights";
import { formatDateRange } from "../utils/formatDate";

export function Header({ trip, stops }: { trip: Trip; stops: Stop[] }) {
  const nights = computeNightsCheck(stops, trip.totalNights);

  return (
    <header className="relative overflow-hidden border-b border-ink/10 bg-gradient-to-b from-sand/50 to-cream">
      <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
        <motion.p
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="font-serif text-sm font-semibold uppercase tracking-[0.35em] text-terracotta-dark"
        >
          Sri Lanka
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.05 }}
          className="mt-2 font-serif text-4xl font-semibold text-ink sm:text-5xl"
        >
          {trip.title}
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mt-2 text-base text-ink-soft sm:text-lg"
        >
          {formatDateRange(trip.start, trip.end)}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="mt-4 flex flex-wrap items-center gap-3"
        >
          <span
            className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium ${
              nights.ok ? "bg-forest/10 text-forest-dark" : "bg-terracotta/15 text-terracotta-dark"
            }`}
          >
            {nights.ok ? "✓" : "⚠"} {nights.total} nachten totaal
            {!nights.ok && (
              <span>
                ({nights.diff > 0 ? "+" : ""}
                {nights.diff} t.o.v. {nights.expected} gepland)
              </span>
            )}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-forest/10 px-4 py-1.5 text-sm font-medium text-forest-dark">
            ✓ Geboekt: {trip.bookingSummary.booked}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-terracotta/10 px-4 py-1.5 text-sm font-medium text-terracotta-dark">
            ○ Nog te boeken: {trip.bookingSummary.toBook}
          </span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mt-8 flex flex-col gap-4 sm:flex-row"
        >
          <FlightCard flight={trip.flights.outbound} direction="heen" />
          <FlightCard flight={trip.flights.return} direction="terug" />
        </motion.div>
      </div>
    </header>
  );
}
