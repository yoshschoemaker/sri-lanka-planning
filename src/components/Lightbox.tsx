import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import type { PhotoUrl } from "../types/trip";
import { dimTransition } from "../motion/variants";
import { ChevronNavIcon, CloseIcon } from "./icons";
import { getPhotoAttrs, PHOTO_SIZES } from "../utils/photos";
import { useDialog } from "../utils/useDialog";
import { useLightboxGestures } from "../utils/useLightboxGestures";

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
  const imageRef = useRef<HTMLImageElement | null>(null);
  const { zoomed, scale, offset, swipeX, consumeSuppressedClick, gestureHandlers } = useLightboxGestures({
    count,
    index,
    onIndexChange,
    imageRef,
  });

  // Escape, scroll-lock en focus komen uit useDialog; hier alleen de
  // pijltjes, want die zijn eigen aan de fotoweergave.
  const panelRef = useDialog<HTMLDivElement>({ open: true, onClose });

  useEffect(() => {
    if (!showArrows) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") onIndexChange((index - 1 + count) % count);
      else if (e.key === "ArrowRight") onIndexChange((index + 1) % count);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [index, count, showArrows, onIndexChange]);

  if (count === 0) return null;

  return (
    <motion.div
      ref={panelRef}
      tabIndex={-1}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={dimTransition}
      onClick={() => {
        // Een veeg eindigt ook in een klik op deze laag; die mag de lightbox
        // niet sluiten. useLightboxGestures houdt bij of dat het geval was.
        if (!consumeSuppressedClick()) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={`${alt} - fotoweergave`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/90 outline-none"
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
          <ChevronNavIcon direction="left" className="h-6 w-6" />
        </button>
      )}

      {/* Eigen laag met de safe-area-insets, zodat de foto in standalone-modus
          niet onder de notch of de home-indicator verdwijnt. De knoppen hieromheen
          zijn absoluut gepositioneerd en negeren deze padding, dus die dragen hun
          eigen inset in hun style. */}
      <div
        {...gestureHandlers}
        // touch-action: none, anders vertaalt de browser de pinch naar
        // paginazoom en de veeg naar scrollen voordat wij hem zien.
        style={{ touchAction: "none" }}
        className="pt-safe pb-safe px-safe flex h-full w-full items-center justify-center"
      >
        <motion.img
          key={index}
          ref={imageRef}
          {...getPhotoAttrs(photos[index], PHOTO_SIZES.fullWidth)}
          alt={`${alt} - foto ${index + 1} van ${count}`}
          draggable={false}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => e.stopPropagation()}
          style={{
            // De veegverplaatsing en de zoom in één transform: los van elkaar
            // zouden ze om dezelfde eigenschap vechten.
            transform: `translate3d(${offset.x + swipeX}px, ${offset.y}px, 0) scale(${scale})`,
            // Tijdens een gebaar geen transitie: die maakt het slepen stroperig.
            // Bij het lossen van de vinger valt swipeX terug op 0 en mag het vloeien.
            transition: swipeX === 0 ? "transform 180ms ease-out" : "none",
            cursor: zoomed ? "grab" : undefined,
          }}
          className="max-h-[calc(100%-2rem)] max-w-[calc(100%-2rem)] touch-none rounded-lg object-contain shadow-float select-none sm:max-h-[calc(100%-4rem)] sm:max-w-[calc(100%-4rem)]"
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
          <ChevronNavIcon direction="right" className="h-6 w-6" />
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
