import { useState } from "react";
import { motion } from "framer-motion";
import type { Trip } from "../types/trip";
import { getTripStatus } from "../utils/countdown";
import { formatDateRange } from "../utils/formatDate";
import { fadeUp, staggerContainer } from "../motion/variants";
import { SettingsSheet } from "./SettingsSheet";
import { SettingsIcon } from "./icons";

export function Header({ trip }: { trip: Trip }) {
  const status = getTripStatus(trip.start, trip.end);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const teaser =
    status.phase === "upcoming"
      ? `Nog ${status.daysUntilStart} ${status.daysUntilStart === 1 ? "dag" : "dagen"} tot vertrek`
      : status.phase === "ongoing"
        ? `Onderweg · dag ${status.currentDay} van ${status.totalDays}`
        : "Reis afgerond";

  return (
    <>
      <header className="relative overflow-hidden border-b border-ink/10 bg-linear-to-b from-sand/50 to-cream">
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          aria-label="Instellingen"
          style={{
            top: "calc(0.75rem + env(safe-area-inset-top, 0px))",
            right: "calc(0.75rem + env(safe-area-inset-right, 0px))",
          }}
          className="absolute z-10 flex h-9 w-9 items-center justify-center rounded-full border border-ink/10 bg-cream/70 text-ink-soft shadow-card backdrop-blur-sm transition hover:bg-cream hover:text-ink active:scale-95"
        >
          <SettingsIcon className="h-4.5 w-4.5" />
        </button>

        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="show"
          className="mx-auto max-w-6xl px-5 py-8 pr-14 sm:px-8 sm:py-10 sm:pr-16"
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

      {/* Buiten de header: die is overflow-hidden, en de sheet moet het hele
          venster kunnen bedekken. */}
      <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}
