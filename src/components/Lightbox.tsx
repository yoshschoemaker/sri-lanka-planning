import { useEffect } from "react";
import { motion } from "framer-motion";
import type { PhotoUrl } from "../types/trip";
import { dimTransition } from "../motion/variants";

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/90 p-4 sm:p-8"
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        aria-label="Sluiten"
        autoFocus
        className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full text-cream/80 outline-none transition-colors hover:bg-cream/10 hover:text-cream"
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
          className="absolute left-2 flex h-11 w-11 items-center justify-center rounded-full text-cream/80 outline-none transition-colors hover:bg-cream/10 hover:text-cream sm:left-4"
        >
          <ChevronIcon direction="left" className="h-6 w-6" />
        </button>
      )}

      <motion.img
        key={index}
        src={photos[index]}
        alt={`${alt} - foto ${index + 1} van ${count}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
        onClick={(e) => e.stopPropagation()}
        className="max-h-full max-w-full rounded-lg object-contain shadow-float"
      />

      {showArrows && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onIndexChange((index + 1) % count);
          }}
          aria-label="Volgende foto"
          className="absolute right-2 flex h-11 w-11 items-center justify-center rounded-full text-cream/80 outline-none transition-colors hover:bg-cream/10 hover:text-cream sm:right-4"
        >
          <ChevronIcon direction="right" className="h-6 w-6" />
        </button>
      )}

      {showArrows && (
        <p className="absolute bottom-5 left-1/2 -translate-x-1/2 text-xs font-medium text-cream/70">
          {index + 1} / {count}
        </p>
      )}
    </motion.div>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" className={className} aria-hidden>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
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
