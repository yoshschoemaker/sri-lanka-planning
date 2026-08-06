import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import type { PhotoUrl } from "../types/trip";
import { Lightbox } from "./Lightbox";

interface PhotoGalleryProps {
  photos: PhotoUrl[] | undefined;
  alt: string;
}

export function PhotoGallery({ photos, alt }: PhotoGalleryProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  if (!photos || photos.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-dashed border-ink/20 bg-sand/25 px-4 py-6 text-sm text-ink-soft">
        <CameraIcon className="h-5 w-5 shrink-0 text-ink-soft/50" />
        Nog geen foto&apos;s toegevoegd
      </div>
    );
  }

  return (
    <>
      <div className="flex snap-x snap-mandatory gap-2.5 overflow-x-auto pb-1">
        {photos.map((photo, i) => (
          <button
            key={photo + i}
            type="button"
            onClick={() => setLightboxIndex(i)}
            aria-label={`${alt}, foto ${i + 1} van ${photos.length} vergroten`}
            className="group relative h-24 w-32 shrink-0 snap-start overflow-hidden rounded-lg outline-none sm:h-28 sm:w-36"
          >
            <img
              src={photo}
              alt=""
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          </button>
        ))}
      </div>

      <AnimatePresence>
        {lightboxIndex !== null && (
          <Lightbox
            photos={photos}
            index={lightboxIndex}
            alt={alt}
            onClose={() => setLightboxIndex(null)}
            onIndexChange={setLightboxIndex}
          />
        )}
      </AnimatePresence>
    </>
  );
}

export function CameraIcon({ className }: { className?: string }) {
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
      <path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" />
      <circle cx="12" cy="13.5" r="3.25" />
    </svg>
  );
}
