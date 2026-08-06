import type { Region } from "../data/regions";

export function RegionHeader({ region }: { region: Region }) {
  return (
    <div className="sticky top-0 z-10 -mx-1 mb-4 mt-10 border-b border-ink/10 bg-cream/95 px-1 py-2.5 backdrop-blur-sm">
      <p className="font-serif text-xs font-semibold uppercase tracking-[0.3em] text-ink-soft">{region.name}</p>
    </div>
  );
}
