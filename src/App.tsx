import { useCallback, useEffect, useRef, useState } from "react";
import { trip, stops, daytrips, transportModes, notes, openQuestions } from "./data/data";
import { Header } from "./components/Header";
import { FilterBar, type ModeFilter, type StatusFilter } from "./components/FilterBar";
import { ItineraryList } from "./components/ItineraryList";
import { TripMap } from "./components/TripMap";
import { OpenQuestions } from "./components/OpenQuestions";

function App() {
  const [selected, setSelected] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [modeFilter, setModeFilter] = useState<ModeFilter>("all");
  const [mapOutOfView, setMapOutOfView] = useState(false);
  const cardRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const mapAnchorRef = useRef<HTMLDivElement>(null);

  const registerRef = useCallback((n: number, el: HTMLDivElement | null) => {
    if (el) cardRefs.current.set(n, el);
    else cardRefs.current.delete(n);
  }, []);

  const handleSelect = useCallback((n: number) => {
    setSelected(n);
    cardRefs.current.get(n)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  useEffect(() => {
    const el = mapAnchorRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setMapOutOfView(!entry.isIntersecting), {
      threshold: 0,
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const scrollToMap = useCallback(() => {
    mapAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  return (
    <div className="min-h-screen bg-cream">
      <Header trip={trip} stops={stops} />

      <main className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-12">
        <OpenQuestions questions={openQuestions} />

        <div className="mb-6">
          <FilterBar
            transportModes={transportModes}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            modeFilter={modeFilter}
            onModeFilterChange={setModeFilter}
          />
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_1.1fr] lg:items-start lg:gap-10">
          <div className="order-2 lg:order-1">
            <h2 className="mb-4 font-serif text-2xl font-semibold text-ink">Route</h2>
            <ItineraryList
              stops={stops}
              transportModes={transportModes}
              selected={selected}
              onSelect={handleSelect}
              registerRef={registerRef}
              statusFilter={statusFilter}
              modeFilter={modeFilter}
            />
          </div>

          <div ref={mapAnchorRef} className="order-1 lg:sticky lg:top-6 lg:order-2">
            <TripMap
              stops={stops}
              daytrips={daytrips}
              transportModes={transportModes}
              selected={selected}
              onSelect={handleSelect}
              statusFilter={statusFilter}
              modeFilter={modeFilter}
            />
          </div>
        </div>

        <footer className="mt-14 border-t border-ink/10 pt-6 text-sm text-ink-soft">
          <ul className="flex flex-col gap-1.5">
            {notes.map((note) => (
              <li key={note} className="flex gap-2">
                <span aria-hidden>·</span>
                {note}
              </li>
            ))}
          </ul>
        </footer>
      </main>

      {mapOutOfView && (
        <button
          type="button"
          onClick={scrollToMap}
          aria-label="Terug naar de kaart"
          className="fixed bottom-5 right-5 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-terracotta-dark text-cream shadow-lg shadow-ink/20 transition-transform active:scale-95 lg:hidden"
        >
          <span aria-hidden className="text-xl leading-none">
            🗺
          </span>
        </button>
      )}
    </div>
  );
}

export default App;
