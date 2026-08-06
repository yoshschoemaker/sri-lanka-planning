import { motion } from "framer-motion";
import type { Trip } from "../types/trip";
import { getTripStatus } from "../utils/countdown";
import { formatDateRange } from "../utils/formatDate";
import { fadeUp, staggerContainer } from "../motion/variants";

export function Header({ trip }: { trip: Trip }) {
  const status = getTripStatus(trip.start, trip.end);

  const teaser =
    status.phase === "upcoming"
      ? `Nog ${status.daysUntilStart} ${status.daysUntilStart === 1 ? "dag" : "dagen"} tot vertrek`
      : status.phase === "ongoing"
        ? `Onderweg · dag ${status.currentDay} van ${status.totalDays}`
        : "Reis afgerond";

  return (
    <header className="relative overflow-hidden border-b border-ink/10 bg-linear-to-b from-sand/50 to-cream">
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-10"
      >
        <motion.p
          variants={fadeUp}
          className="font-serif text-sm font-semibold uppercase tracking-[0.35em] text-terracotta-dark"
        >
          Sri Lanka
        </motion.p>
        <motion.h1
          variants={fadeUp}
          className="mt-2 font-serif text-4xl font-semibold text-ink sm:text-5xl"
        >
          {trip.title}
        </motion.h1>
        <motion.p variants={fadeUp} className="mt-2 text-base text-ink-soft sm:text-lg">
          {formatDateRange(trip.start, trip.end)}
        </motion.p>

        <motion.p
          variants={fadeUp}
          className={`mt-4 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium ${
            status.phase === "completed" ? "bg-forest/10 text-forest-dark" : "bg-terracotta/10 text-terracotta-dark"
          }`}
        >
          <span aria-hidden>{status.phase === "completed" ? "✓" : "⏳"}</span>
          {teaser}
        </motion.p>
      </motion.div>
    </header>
  );
}
