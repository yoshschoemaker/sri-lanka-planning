import { useEffect } from "react";
import { motion } from "framer-motion";
import type { PhotoUrl } from "../types/trip";
import { dimTransition } from "../motion/variants";
import { CloseIcon } from "./icons";

interface LightboxProps {
  photos: PhotoUrl[];
  index: number;
  alt: string;
  onClose: () => void;
  onIndexChange: (index: number) => void;
}

export function Lightbox({ photos, index, alt, onClose, onIndexChange }: LightboxProps) {
  const count = photos.length;
  const showArrows = count > 1;

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      } else if (showArrows && e.key === "ArrowLeft") {
        onIndexChange((index - 1 + count) % count);
      } else if (showArrows && e.key === "ArrowRight") {
        onIndexChange((index + 1) % count);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [index, count, showArrows, onClose, onIndexChange]);

  if (count === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={dimTransition}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`${alt} - fotoweergave`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/90"
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        aria-label="Sluiten"
        autoFocus
        style={{
          top: "calc(1rem + env(safe-area-inset-top, 0px))",
          right: "calc(1rem + env(safe-area-inset-right, 0px))",
        }}
        className="absolute flex h-10 w-10 items-center justify-center rounded-full text-cream/80 outline-none transition-colors hover:bg-cream/10 hover:text-cream"
      >
        <CloseIcon className="h-5 w-5" />
      </button>

      {showArrows && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onIndexChange((index - 1 + count) % count);
          }}
          aria-label="Vorige foto"
          style={{ left: "calc(0.5rem + env(safe-area-inset-left, 0px))" }}
          className="absolute flex h-11 w-11 items-center justify-center rounded-full text-cream/80 outline-none transition-colors hover:bg-cream/10 hover:text-cream"
        >
          <ChevronIcon direction="left" className="h-6 w-6" />
        </button>
      )}

      {/* Eigen laag met de safe-area-insets, zodat de foto in standalone-modus
          niet onder de notch of de home-indicator verdwijnt. De knoppen hieromheen
          zijn absoluut gepositioneerd en negeren deze padding, dus die dragen hun
          eigen inset in hun style. */}
      <div className="pt-safe pb-safe px-safe flex h-full w-full items-center justify-center">
        <motion.img
          key={index}
          src={photos[index]}
          alt={`${alt} - foto ${index + 1} van ${count}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => e.stopPropagation()}
          className="max-h-[calc(100%-2rem)] max-w-[calc(100%-2rem)] rounded-lg object-contain shadow-float sm:max-h-[calc(100%-4rem)] sm:max-w-[calc(100%-4rem)]"
        />
      </div>

      {showArrows && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onIndexChange((index + 1) % count);
          }}
          aria-label="Volgende foto"
          style={{ right: "calc(0.5rem + env(safe-area-inset-right, 0px))" }}
          className="absolute flex h-11 w-11 items-center justify-center rounded-full text-cream/80 outline-none transition-colors hover:bg-cream/10 hover:text-cream"
        >
          <ChevronIcon direction="right" className="h-6 w-6" />
        </button>
      )}

      {showArrows && (
        <p
          style={{ bottom: "calc(1.25rem + env(safe-area-inset-bottom, 0px))" }}
          className="absolute left-1/2 -translate-x-1/2 text-xs font-medium text-cream/70"
        >
          {index + 1} / {count}
        </p>
      )}
    </motion.div>
  );
}

function ChevronIcon({ direction, className }: { direction: "left" | "right"; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d={direction === "left" ? "M15 6l-6 6 6 6" : "M9 6l6 6-6 6"} />
    </svg>
  );
}
