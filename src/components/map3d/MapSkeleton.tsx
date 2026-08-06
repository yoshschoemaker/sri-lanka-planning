/** Suspense fallback shown briefly while the 3D map chunk downloads. */
export function MapSkeleton() {
  return (
    <div className="flex h-full w-full items-center justify-center rounded-[inherit] bg-sand/40">
      <span className="animate-pulse text-sm font-medium text-ink-soft">Kaart wordt geladen…</span>
    </div>
  );
}
