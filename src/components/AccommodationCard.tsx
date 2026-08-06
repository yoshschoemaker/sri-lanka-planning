import type { Accommodation } from "../types/trip";
import { PhotoGallery } from "./PhotoGallery";

interface AccommodationCardProps {
  accommodation: Accommodation | undefined;
}

export function AccommodationCard({ accommodation }: AccommodationCardProps) {
  if (!accommodation) {
    return (
      <p className="inline-flex items-center gap-1 self-start rounded-full bg-terracotta/10 px-2.5 py-1 text-xs font-medium text-terracotta-dark">
        ○ Verblijf nog niet gekozen
      </p>
    );
  }

  return (
    <div className="rounded-xl border border-ink/10 bg-white/60 p-3.5 sm:p-4">
      <PhotoGallery photos={accommodation.photos} alt={accommodation.name} />

      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div>
          <p className="font-serif text-base font-semibold text-ink">{accommodation.name}</p>
          {accommodation.note && <p className="text-xs text-ink-soft">{accommodation.note}</p>}
        </div>

        {accommodation.url && (
          <a
            href={accommodation.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex shrink-0 items-center gap-1 rounded-full border border-ink/15 bg-white/60 px-3 py-1.5 text-xs font-medium text-ink-soft transition-colors hover:border-terracotta-light hover:text-terracotta-dark"
          >
            Bekijk boeking ↗
          </a>
        )}
      </div>
    </div>
  );
}
