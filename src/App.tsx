import { useCallback, useEffect, useRef, useState } from "react";
import { trip, stops, transportModes, notes, openQuestions } from "./data/data";
import { Header } from "./components/Header";
import { HeroBanner } from "./components/HeroBanner";
import { SplashScreen } from "./components/SplashScreen";
import { DailyCountdownConfetti } from "./components/DailyCountdownConfetti";
import { TripStats } from "./components/TripStats";
import { FlightCard } from "./components/FlightCard";
import { FilterBar, type ModeFilter, type PriorityFilter, type StatusFilter } from "./components/FilterBar";
import { ItineraryList } from "./components/ItineraryList";
import { TripMapScene } from "./components/TripMapScene";
import { MapModal } from "./components/MapModal";
import { TripInfoAccordion } from "./components/TripInfoAccordion";
import { useReducedMotion } from "./utils/useReducedMotion";
import { useMediaQuery } from "./utils/useMediaQuery";

/** Matches the lg breakpoint that turns the map panel sticky (see the grid below); scroll-driven selection only makes sense while the map stays on screen next to the list. */
const DESKTOP_QUERY = "(min-width: 1024px)";

/** Thin band centered in the viewport: a stop counts as "in focus" only while it crosses this band, not merely anywhere on screen. */
const SCROLL_FOCUS_ROOT_MARGIN = "-45% 0px -45% 0px";

function App() {
  const [selected, setSelected] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [modeFilter, setModeFilter] = useState<ModeFilter>("all");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all");
  const [mapOutOfView, setMapOutOfView] = useState(false);
  const [mapModalOpen, setMapModalOpen] = useState(false);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const mapAnchorRef = useRef<HTMLDivElement>(null);
  /** Fallback for closeMapModal when nothing is selected — mobile has no scroll-linked selection (see the isDesktop-gated observer below), so there's no card to land back on. */
  const savedScrollRef = useRef(0);
  const prefersReducedMotion = useReducedMotion();
  const isDesktop = useMediaQuery(DESKTOP_QUERY);

  const registerRef = useCallback((id: string, el: HTMLDivElement | null) => {
    if (el) cardRefs.current.set(id, el);
    else cardRefs.current.delete(id);
  }, []);

  const handleSelect = useCallback(
    (id: string) => {
      setSelected(id);
      cardRefs.current.get(id)?.scrollIntoView({
        behavior: prefersReducedMotion ? "auto" : "smooth",
        block: "center",
      });
    },
    [prefersReducedMotion],
  );

  useEffect(() => {
    const el = mapAnchorRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setMapOutOfView(!entry.isIntersecting), {
      threshold: 0,
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isDesktop) return;

    const cards = Array.from(cardRefs.current.values());
    if (cards.length === 0) return;

    // Distance-to-center per currently-focused card id; only ids inside the
    // thin center band are tracked, so the closest one is always the card the
    // user is actually reading, not just whatever happened to change last.
    const focused = new Map<string, number>();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = entry.target.id.replace(/^stop-/, "");
          if (entry.isIntersecting) {
            const cardCenter = entry.boundingClientRect.top + entry.boundingClientRect.height / 2;
            focused.set(id, Math.abs(cardCenter - window.innerHeight / 2));
          } else {
            focused.delete(id);
          }
        }

        let closestId: string | null = null;
        let closestDistance = Infinity;
        for (const [id, distance] of focused) {
          if (distance < closestDistance) {
            closestDistance = distance;
            closestId = id;
          }
        }
        if (closestId) setSelected(closestId);
      },
      { rootMargin: SCROLL_FOCUS_ROOT_MARGIN, threshold: 0 },
    );

    for (const card of cards) observer.observe(card);
    return () => observer.disconnect();
  }, [isDesktop]);

  const openMapModal = useCallback(() => {
    savedScrollRef.current = window.scrollY;

    // Mobile has no scroll-linked selection (see the isDesktop-gated observer
    // above), so `selected` can be stale here — find the card nearest the
    // viewport center right now, the same way that observer would, so the map
    // opens on the stop you're actually looking at.
    let closestId: string | null = null;
    let closestDistance = Infinity;
    for (const [id, el] of cardRefs.current) {
      const rect = el.getBoundingClientRect();
      const distance = Math.abs(rect.top + rect.height / 2 - window.innerHeight / 2);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestId = id;
      }
    }
    if (closestId) setSelected(closestId);

    setMapModalOpen(true);
  }, []);

  const closeMapModal = useCallback(() => {
    setMapModalOpen(false);
    // Prefer landing back on the selected stop's card (it may have changed
    // while the modal was open) over the raw saved scroll position, which is
    // only a reliable anchor when nothing is/was selected.
    const selectedCard = selected ? cardRefs.current.get(selected) : null;
    if (selectedCard) selectedCard.scrollIntoView({ behavior: "auto", block: "center" });
    else window.scrollTo({ top: savedScrollRef.current, behavior: "auto" });
  }, [selected]);

  return (
    <div className="min-h-screen bg-cream">
      <SplashScreen />
      <DailyCountdownConfetti trip={trip} />
      <Header trip={trip} />

      <HeroBanner />

      <main className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-12">
        <TripStats trip={trip} stops={stops} transportModes={transportModes} onJumpToStop={handleSelect} />

        <section className="mt-12 mb-10 sm:mt-14">
          <h2 className="mb-4 font-serif text-2xl font-semibold text-ink">Vluchten</h2>
          <div className="flex flex-col gap-4 sm:flex-row">
            <FlightCard flight={trip.flights.outbound} direction="heen" />
            <FlightCard flight={trip.flights.return} direction="terug" />
          </div>
        </section>

        <TripInfoAccordion
          trip={trip}
          stops={stops}
          openQuestions={openQuestions}
          notes={notes}
          onJumpToStop={handleSelect}
        />

        <div className="mb-6">
          <FilterBar
            transportModes={transportModes}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            modeFilter={modeFilter}
            onModeFilterChange={setModeFilter}
            priorityFilter={priorityFilter}
            onPriorityFilterChange={setPriorityFilter}
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
              priorityFilter={priorityFilter}
            />
          </div>

          <div ref={mapAnchorRef} className="order-1 lg:sticky lg:top-6 lg:order-2">
            <TripMapScene
              variant="panel"
              paused={mapModalOpen}
              stops={stops}
              transportModes={transportModes}
              selected={selected}
              onSelect={handleSelect}
              statusFilter={statusFilter}
              modeFilter={modeFilter}
            />
          </div>
        </div>
      </main>

      {mapOutOfView && (
        <button
          type="button"
          onClick={openMapModal}
          aria-label="Kaart openen"
          className="fixed bottom-5 right-5 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-terracotta-dark text-cream shadow-lg shadow-ink/20 transition-transform active:scale-95 lg:hidden"
        >
          <span aria-hidden className="text-xl leading-none">
            🗺
          </span>
        </button>
      )}

      <MapModal
        open={mapModalOpen}
        onClose={closeMapModal}
        stops={stops}
        transportModes={transportModes}
        selected={selected}
        onSelect={handleSelect}
        statusFilter={statusFilter}
        modeFilter={modeFilter}
      />
    </div>
  );
}

export default App;
