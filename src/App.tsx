import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { trip, stops, transportModes, notes, openQuestions, todos } from "./data/tripContent";
import { Header } from "./components/Header";
import { HeroBanner } from "./components/HeroBanner";
import { SplashScreen, SPLASH_TOTAL_MS } from "./components/SplashScreen";
import { DailyCountdownConfetti } from "./components/DailyCountdownConfetti";
import { TripStats } from "./components/TripStats";
import { RouteSummary } from "./components/RouteSummary";
import { FlightCard } from "./components/FlightCard";
import { FilterBar, type ModeFilter, type PriorityFilter, type StatusFilter } from "./components/FilterBar";
import { ItineraryList } from "./components/ItineraryList";
import { TripMapScene } from "./components/TripMapScene";
import { TripInfoAccordion } from "./components/TripInfoAccordion";
import { InstallPrompt } from "./components/InstallPrompt";
import { UpdatePrompt } from "./components/UpdatePrompt";
import { OfflineBadge } from "./components/OfflineBadge";
import { BottomNav, type AppTab } from "./components/BottomNav";
import { ActivitiesView } from "./components/ActivitiesView";
import { GuideView } from "./components/GuideView";
import { useReducedMotion } from "./utils/useReducedMotion";
import { useMediaQuery } from "./utils/useMediaQuery";
import { useTripStatus } from "./utils/useTripStatus";
import { currentStopIds, todayIso } from "./utils/currentStop";

/** Matches the lg breakpoint that turns the map panel sticky (see the grid below); scroll-driven selection only makes sense while the map stays on screen next to the list. */
const DESKTOP_QUERY = "(min-width: 1024px)";

/** Thin band centered in the viewport: a stop counts as "in focus" only while it crosses this band, not merely anywhere on screen. */
const SCROLL_FOCUS_ROOT_MARGIN = "-45% 0px -45% 0px";

function App() {
  const [selected, setSelected] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [modeFilter, setModeFilter] = useState<ModeFilter>("all");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all");
  /** Welke pagina er onder de navigatie staat. */
  const [view, setView] = useState<AppTab>("reis");
  /** Stop waar Doen op opent als je via de link op een stopkaart komt. */
  const [activitiesFocus, setActivitiesFocus] = useState<string | null>(null);
  /** Scrollpositie per pagina, zodat terugkeren naar Reis of Doen je plek bewaart. */
  const viewScrollRef = useRef<Partial<Record<AppTab, number>>>({});
  const previousViewRef = useRef<AppTab>(view);
  /** De install-banner bezet de onderrand; de update-toast wijkt ervoor uit. */
  const [installBannerVisible, setInstallBannerVisible] = useState(false);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  /** Zorgt dat de sprong naar de stop van vandaag hoogstens één keer per sessie gebeurt. */
  const jumpedToTodayRef = useRef(false);
  const prefersReducedMotion = useReducedMotion();
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const status = useTripStatus(trip.start, trip.end);

  /**
   * Welke stops vandaag zijn. Leeg zolang de reis niet loopt, zodat er in de
   * maanden ervoor geen willekeurige kaart uitgelicht staat.
   *
   * De datum staat als eigen waarde in de deps in plaats van als aanroep binnen
   * de memo: zo is de afhankelijkheid van "welke dag is het" expliciet, en
   * omdat useTripStatus bij middernacht opnieuw rendert schuift dit mee zonder
   * dat de app herladen hoeft te worden.
   */
  const today = todayIso();
  const todayIds = useMemo(
    () => (status.phase === "ongoing" ? currentStopIds(stops, today) : []),
    [status.phase, today],
  );

  const resetFilters = useCallback(() => {
    setStatusFilter("all");
    setModeFilter("all");
    setPriorityFilter("all");
  }, []);

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

  /**
   * The map's own tour advances `selected` on its own as it visits each
   * stop. On desktop that's a nice touch — the list scrolls in sync beside
   * the sticky map. On mobile, list and map share one page scroll, so that
   * same scrollIntoView would drag the page away from the map mid-tour,
   * i.e. exactly the thing you're trying to watch. Skip the scroll there.
   */
  const handleTourSelect = useCallback(
    (id: string) => {
      setSelected(id);
      if (isDesktop) {
        cardRefs.current.get(id)?.scrollIntoView({
          behavior: prefersReducedMotion ? "auto" : "smooth",
          block: "center",
        });
      }
    },
    [isDesktop, prefersReducedMotion],
  );

  /**
   * Bij het openen onderweg landt de lijst op de stop van vandaag in plaats van
   * bovenaan. Eén keer per sessie: daarna is scrollen weer aan de gebruiker.
   *
   * De vertraging wacht de splash uit. Die zet body-overflow op hidden zolang
   * hij in beeld staat, en een scrollIntoView daaronder komt niet aan. Zelfde
   * reden waarom InstallPrompt en DailyCountdownConfetti dezelfde constante
   * gebruiken.
   */
  useEffect(() => {
    if (jumpedToTodayRef.current) return;
    const todayId = todayIds[0];
    if (!todayId) return;

    const timer = setTimeout(() => {
      // De vlag gaat pas om als de sprong echt gemaakt is, niet bij het
      // plannen ervan. Zette hij hem meteen, dan haalde StrictMode's
      // mount-cleanup-remount in dev de timer weg en zag de tweede run de vlag
      // al staan, waarna er nooit meer iets werd ingepland. Zelfde valkuil als
      // in DailyCountdownConfetti, daar staat hij ook beschreven.
      jumpedToTodayRef.current = true;
      setSelected(todayId);
      cardRefs.current.get(todayId)?.scrollIntoView({ behavior: "auto", block: "center" });
    }, SPLASH_TOTAL_MS + 100);

    return () => clearTimeout(timer);
  }, [todayIds]);

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

  /**
   * Mobiel kent geen scroll-gekoppelde selectie (zie de isDesktop-observer
   * hierboven), dus `selected` kan verouderd zijn. Bij het openen van de kaart
   * pakken we de stopkaart die nu het dichtst bij het midden van het scherm
   * staat, zodat de kaart opent op de stop waar je naar keek.
   */
  const selectCardInView = useCallback(() => {
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
  }, []);

  const handleTabChange = useCallback(
    (tab: AppTab) => {
      if (tab === view) {
        // Nog een tik op de huidige tab: terug naar boven, zoals in de meeste apps.
        window.scrollTo({ top: 0, behavior: prefersReducedMotion ? "auto" : "smooth" });
        return;
      }
      viewScrollRef.current[view] = window.scrollY;
      if (view === "reis" && tab === "kaart") selectCardInView();
      if (tab === "doen") setActivitiesFocus(null);
      setView(tab);
    },
    [prefersReducedMotion, selectCardInView, view],
  );

  const showActivities = useCallback((stopId: string) => {
    viewScrollRef.current.reis = window.scrollY;
    setActivitiesFocus(stopId);
    setView("doen");
  }, []);

  /**
   * Na het wisselen van pagina de scrollpositie zetten. Pas na de render, want
   * daarvoor heeft de nieuwe pagina nog geen hoogte. Niet bij de eerste
   * render: dan houdt de browser zijn eigen scrollherstel.
   */
  useEffect(() => {
    const previous = previousViewRef.current;
    if (previous === view) return;
    previousViewRef.current = view;

    if (view === "doen" && activitiesFocus) {
      document.getElementById(`doen-${activitiesFocus}`)?.scrollIntoView({ behavior: "auto", block: "start" });
      return;
    }
    // Terug van de kaart: land op de stop die daar geselecteerd is, die kan
    // onderweg veranderd zijn.
    const selectedCard = selected ? cardRefs.current.get(selected) : null;
    if (view === "reis" && previous === "kaart" && selectedCard) {
      selectedCard.scrollIntoView({ behavior: "auto", block: "center" });
      return;
    }
    // De Gids begint altijd op zijn startscherm, dus ook bovenaan.
    const restore = view === "reis" || view === "doen" ? viewScrollRef.current[view] : undefined;
    window.scrollTo({ top: restore ?? 0, behavior: "auto" });
  }, [view, activitiesFocus, selected]);

  return (
    <div className="min-h-screen bg-cream pb-[calc(var(--bottom-nav-height)+env(safe-area-inset-bottom,0px))]">
      <SplashScreen />
      <DailyCountdownConfetti trip={trip} />
      <InstallPrompt onVisibilityChange={setInstallBannerVisible} />
      <UpdatePrompt raised={installBannerVisible} />
      <OfflineBadge />

      {view === "doen" && (
        <ActivitiesView
          stops={stops}
          priorityFilter={priorityFilter}
          onPriorityFilterChange={setPriorityFilter}
        />
      )}

      {view === "gids" && <GuideView />}

      {/* De kaart als eigen pagina, precies tot aan de navigatie. */}
      {view === "kaart" && (
        <div className="pt-safe px-safe h-[calc(100dvh-var(--bottom-nav-height)-env(safe-area-inset-bottom,0px))]">
          <TripMapScene
            variant="hero"
            stops={stops}
            transportModes={transportModes}
            selected={selected}
            onSelect={setSelected}
            onTourSelect={setSelected}
            statusFilter={statusFilter}
            modeFilter={modeFilter}
          />
        </div>
      )}

      {/*
        Reis blijft gemount als je naar een andere pagina gaat en wordt alleen
        verborgen: de 3D-kaart erin opnieuw opbouwen kost seconden, en zo
        blijven ook filters en opengeklapte kaarten staan.
      */}
      <div hidden={view !== "reis"}>
        <Header trip={trip} />

        <HeroBanner />

        <main className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-12">
          <TripStats
            trip={trip}
            stops={stops}
            transportModes={transportModes}
            todayStopId={todayIds[0] ?? null}
            onJumpToStop={handleSelect}
          />

          <RouteSummary trip={trip} stops={stops} />

          <section className="mb-10">
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
            todos={todos}
            notes={notes}
            onJumpToStop={handleSelect}
          />

          <div className="mb-6">
            <FilterBar
              stops={stops}
              transportModes={transportModes}
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
              modeFilter={modeFilter}
              onModeFilterChange={setModeFilter}
              onReset={resetFilters}
            />
          </div>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_1.1fr] lg:items-start lg:gap-6">
            <div className="order-2 lg:order-1">
              <h2 className="mb-4 font-serif text-2xl font-semibold text-ink">Route</h2>
              <ItineraryList
                stops={stops}
                transportModes={transportModes}
                selected={selected}
                todayIds={todayIds}
                onSelect={handleSelect}
                registerRef={registerRef}
                statusFilter={statusFilter}
                modeFilter={modeFilter}
                onShowActivities={showActivities}
              />
            </div>

            <div className="order-1 lg:sticky lg:top-6 lg:order-2">
              <TripMapScene
                variant="panel"
                paused={view !== "reis"}
                stops={stops}
                transportModes={transportModes}
                selected={selected}
                onSelect={handleSelect}
                onTourSelect={handleTourSelect}
                statusFilter={statusFilter}
                modeFilter={modeFilter}
              />
            </div>
          </div>
        </main>
      </div>

      <BottomNav active={view} onChange={handleTabChange} />
    </div>
  );
}

export default App;
