import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { stops } from "../data/tripContent";
import {
  canFeed,
  createGame,
  drainEvents,
  feed,
  MAX_BANANAS,
  routeFromStops,
  score,
  SEGMENT,
  steer,
  step,
  stopAt,
  type GameState,
  type ObstacleKind,
} from "../game/tuktuk/engine";
import { render } from "../game/tuktuk/render";
import { CloseIcon } from "./icons";

export interface RideResult {
  score: number;
  distance: number;
  reachedStop: string | null;
  crash: ObstacleKind;
}

interface TuktukGameProps {
  best: number;
  onClose: () => void;
  /** Geeft een regel terug voor onder de score, bijvoorbeeld of hij op het scorebord staat. */
  onRideEnd: (result: RideResult) => string | null;
}

type Phase = "ready" | "playing" | "paused" | "over";

const STEP = 1 / 120;
const SWIPE = 28;

const CRASH_LINES: Record<ObstacleKind, string> = {
  cow: "Boem! Een koe heeft hier altijd voorrang.",
  pothole: "Krak. Die kuil zag je te laat.",
  dog: "Oei, een straathond. Hij is ongedeerd, je tuktuk niet.",
  bus: "Een bus wijkt nooit uit. Jij wel, de volgende keer.",
  elephant: "De olifant liet je er niet langs. Had je maar een banaan.",
};

function vibrate(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // Niet elk toestel kan trillen, en iOS doet het helemaal niet.
  }
}

/** Kleine banaan voor de knop en de uitleg; dezelfde vorm als op de weg. */
export function BananaIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path d="M4 7c1 7 7 11 15 9" fill="none" stroke="#c99a1c" strokeWidth="6" strokeLinecap="round" />
      <path d="M4.6 7.4c1.2 6 6.4 9.6 13.6 8.2" fill="none" stroke="#f5cf3a" strokeWidth="3.6" strokeLinecap="round" />
      <circle cx="19.3" cy="16" r="1.2" fill="#5c4320" />
      <circle cx="4" cy="6.6" r="1" fill="#5c4320" />
    </svg>
  );
}

/**
 * Tuktuk leren rijden, schermvullend over de app. De spelregels staan in
 * src/game/tuktuk; dit onderdeel regelt de klok, de besturing en de schermen
 * eromheen. Score en afstand worden elk frame rechtstreeks in de DOM gezet,
 * niet via React-state: dat zou 60 renders per seconde kosten.
 */
export function TuktukGame({ best, onClose, onRideEnd }: TuktukGameProps) {
  const route = useMemo(() => routeFromStops(stops), []);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scoreRef = useRef<HTMLSpanElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<GameState>(createGame(route));
  const phaseRef = useRef<Phase>("ready");
  const pointerRef = useRef<{ x: number; y: number; used: boolean } | null>(null);

  const [phase, setPhaseState] = useState<Phase>("ready");
  const [bananas, setBananas] = useState(0);
  const [feedable, setFeedable] = useState(false);
  const [noBanana, setNoBanana] = useState(false);
  const [stopNames, setStopNames] = useState(() => ({ current: route[0].name, next: route[1 % route.length].name }));
  const [toast, setToast] = useState<string | null>(null);
  const [result, setResult] = useState<(RideResult & { message: string | null; isRecord: boolean }) | null>(null);

  const setPhase = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhaseState(next);
  }, []);

  const start = useCallback(() => {
    stateRef.current = createGame(route);
    setBananas(0);
    setFeedable(false);
    setResult(null);
    setStopNames({ current: route[0].name, next: route[1 % route.length].name });
    setToast(`Vertrek uit ${route[0].name}`);
    setPhase("playing");
  }, [route, setPhase]);

  const giveBanana = useCallback(() => {
    if (phaseRef.current !== "playing") return;
    if (feed(stateRef.current)) vibrate(15);
  }, []);

  // Even laten zien, dan weer weg.
  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 1800);
    return () => window.clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    if (!noBanana) return;
    const id = window.setTimeout(() => setNoBanana(false), 700);
    return () => window.clearTimeout(id);
  }, [noBanana]);

  // De klok: vaste stapjes voor de spelregels, één tekening per frame.
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let view = { width: 0, height: 0 };
    const resize = () => {
      const rect = wrapper.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      view = { width: rect.width, height: rect.height };
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(wrapper);

    let frame = 0;
    let last = performance.now();
    let acc = 0;
    let shownBananas = -1;
    let shownFeedable = false;
    let shownStop = -1;

    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      const state = stateRef.current;
      const elapsed = Math.min(0.05, (now - last) / 1000);
      last = now;

      if (phaseRef.current === "playing") {
        acc += elapsed;
        while (acc >= STEP && state.status === "playing") {
          step(state, STEP);
          acc -= STEP;
        }

        for (const event of drainEvents(state)) {
          if (event.type === "pickup") vibrate(8);
          else if (event.type === "stop") setToast(event.lap > 1 ? `Ronde ${event.lap} · ${event.name}` : `Welkom in ${event.name}`);
          else if (event.type === "no-banana") setNoBanana(true);
          else if (event.type === "crash") {
            vibrate([60, 40, 160]);
            const ride: RideResult = {
              score: score(state),
              distance: Math.floor(state.distance),
              reachedStop: stopAt(state.route, state.distance).stop.name,
              crash: event.kind,
            };
            const message = onRideEnd(ride);
            setResult({ ...ride, message, isRecord: ride.score > best && ride.score > 0 });
            setPhase("over");
          }
        }

        if (state.bananas !== shownBananas) {
          shownBananas = state.bananas;
          setBananas(state.bananas);
        }
        const nowFeedable = canFeed(state);
        if (nowFeedable !== shownFeedable) {
          shownFeedable = nowFeedable;
          setFeedable(nowFeedable);
        }
        if (state.stopIndex !== shownStop) {
          shownStop = state.stopIndex;
          setStopNames({
            current: state.route[state.stopIndex % state.route.length].name,
            next: state.route[(state.stopIndex + 1) % state.route.length].name,
          });
        }
        if (scoreRef.current) scoreRef.current.textContent = score(state).toLocaleString("nl-NL");
        if (progressRef.current) progressRef.current.style.width = `${((state.distance % SEGMENT) / SEGMENT) * 100}%`;
      } else {
        acc = 0;
      }

      if (view.width > 0) render(ctx, state, view);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [best, onRideEnd, setPhase]);

  // Toetsenbord, en pauzeren zodra je de app wegklikt.
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const p = phaseRef.current;
      if (p === "playing") {
        if (e.key === "ArrowLeft" || e.key === "a") steer(stateRef.current, -1);
        else if (e.key === "ArrowRight" || e.key === "d") steer(stateRef.current, 1);
        else if (e.key === "ArrowUp" || e.key === "w" || e.key === " ") giveBanana();
        else if (e.key === "Escape" || e.key === "p") setPhase("paused");
        else return;
        e.preventDefault();
      } else if (e.key === "Escape") {
        e.preventDefault();
        if (p === "paused") setPhase("playing");
        else onClose();
      }
    }
    function handleVisibility() {
      if (document.visibilityState === "hidden" && phaseRef.current === "playing") setPhase("paused");
    }
    window.addEventListener("keydown", handleKey);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("keydown", handleKey);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [giveBanana, onClose, setPhase]);

  // De pagina eronder mag niet meescrollen.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  // Vegen of tikken. Een veeg telt al tijdens het bewegen, zodat twee snelle vegen twee banen zijn.
  function handlePointerDown(e: ReactPointerEvent) {
    if (phaseRef.current !== "playing") return;
    pointerRef.current = { x: e.clientX, y: e.clientY, used: false };
  }
  function handlePointerMove(e: ReactPointerEvent) {
    const p = pointerRef.current;
    if (!p || phaseRef.current !== "playing") return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    if (Math.abs(dx) > SWIPE && Math.abs(dx) > Math.abs(dy)) {
      steer(stateRef.current, dx < 0 ? -1 : 1);
      pointerRef.current = { x: e.clientX, y: e.clientY, used: true };
    } else if (dy < -SWIPE * 1.5 && Math.abs(dy) > Math.abs(dx) && !p.used) {
      giveBanana();
      pointerRef.current = { ...p, used: true };
    }
  }
  function handlePointerUp(e: ReactPointerEvent) {
    const p = pointerRef.current;
    pointerRef.current = null;
    if (!p || p.used || phaseRef.current !== "playing") return;
    const rect = e.currentTarget.getBoundingClientRect();
    steer(stateRef.current, e.clientX - rect.left < rect.width / 2 ? -1 : 1);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Tuktuk leren rijden"
      className="fixed inset-0 z-[60] select-none overflow-hidden bg-ink"
      style={{ touchAction: "none", WebkitUserSelect: "none" }}
    >
      <div
        ref={wrapperRef}
        className="absolute inset-0"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => (pointerRef.current = null)}
      >
        <canvas ref={canvasRef} className="block h-full w-full" aria-hidden />
      </div>

      {/* Score, route en pauze */}
      {phase !== "ready" && (
        <div className="pt-safe px-safe pointer-events-none absolute inset-x-0 top-0">
          <div className="mx-auto flex max-w-md items-start justify-between gap-3 px-4 pt-3">
            <div className="rounded-2xl bg-cream/90 px-3.5 py-2 shadow-card backdrop-blur">
              <span className="block text-[10px] font-semibold uppercase tracking-[0.2em] text-terracotta-dark">Score</span>
              <span ref={scoreRef} className="font-serif text-2xl font-bold tabular-nums text-ink">
                0
              </span>
            </div>
            <div className="mt-1 min-w-0 flex-1 rounded-2xl bg-cream/90 px-3 py-2 shadow-card backdrop-blur">
              <div className="flex items-center justify-between gap-2 text-[11px] font-semibold text-ink">
                <span className="truncate">{stopNames.current}</span>
                <span className="truncate text-ink-soft">{stopNames.next}</span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-ink/10">
                <div ref={progressRef} className="h-full rounded-full bg-terracotta" style={{ width: "0%" }} />
              </div>
            </div>
            <button
              type="button"
              onClick={() => setPhase("paused")}
              aria-label="Pauze"
              className="pointer-events-auto mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-cream/90 text-ink shadow-card backdrop-blur active:scale-95"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
                <rect x="6" y="5" width="4" height="14" rx="1.2" fill="currentColor" />
                <rect x="14" y="5" width="4" height="14" rx="1.2" fill="currentColor" />
              </svg>
            </button>
          </div>
          {toast && (
            <p
              key={toast}
              role="status"
              className="mx-auto mt-3 w-fit rounded-full bg-terracotta-dark px-4 py-1.5 font-serif text-base font-semibold text-cream shadow-float motion-safe:animate-[tuktuk-pop_0.35s_ease-out]"
            >
              {toast}
            </p>
          )}
        </div>
      )}

      {/* Bananen in je tas, en de knop om de olifant te voeren */}
      {phase === "playing" && (
        <div className="pb-safe pointer-events-none absolute inset-x-0 bottom-0">
          <div className="flex justify-center px-4 pb-6">
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={giveBanana}
              aria-label={`Geef de olifant een banaan. Je hebt er ${bananas}.`}
              className={`pointer-events-auto flex items-center gap-2 rounded-full px-4 py-2.5 font-semibold shadow-float transition-all active:scale-95 ${
                feedable
                  ? `scale-110 bg-terracotta-dark text-cream ring-4 ring-sand/70 ${noBanana ? "motion-safe:animate-[tuktuk-shake_0.35s]" : "motion-safe:animate-pulse"}`
                  : "bg-cream/90 text-ink backdrop-blur"
              }`}
            >
              <span className="flex gap-0.5">
                {Array.from({ length: MAX_BANANAS }, (_, i) => (
                  <BananaIcon key={i} className={`h-6 w-6 transition-opacity ${i < bananas ? "opacity-100" : "opacity-25 grayscale"}`} />
                ))}
              </span>
              {feedable && <span className="text-sm">{noBanana || bananas === 0 ? "Geen banaan!" : "Geef banaan!"}</span>}
            </button>
          </div>
        </div>
      )}

      {phase === "ready" && (
        <Card onClose={onClose}>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-terracotta-dark">Mini-game</p>
          <h2 className="mt-1 font-serif text-3xl font-semibold text-ink">Tuktuk leren rijden</h2>
          <p className="mt-2 text-sm text-ink-soft">
            Rij de route van {route[0].name} tot {route[route.length - 1].name}. Hoe verder je komt, hoe harder het gaat.
          </p>
          <ul className="mt-5 flex flex-col gap-3 text-left text-sm text-ink">
            <HowTo icon={<span className="text-lg">👆</span>}>
              <strong>Veeg of tik</strong> links en rechts om van baan te wisselen.
            </HowTo>
            <HowTo icon={<BananaIcon className="h-6 w-6" />}>
              <strong>Olifant op de weg?</strong> Geef hem een banaan, met de knop of door omhoog te vegen. Zonder banaan
              mag je er niet langs.
            </HowTo>
            <HowTo icon={<span className="text-lg">🥥</span>}>
              Kokosnoten en theeblaadjes geven punten. Koeien, kuilen, honden en bussen ontwijken.
            </HowTo>
          </ul>
          <button type="button" onClick={start} autoFocus className={BIG_BUTTON}>
            Start de motor
          </button>
          {best > 0 && <p className="mt-3 text-xs text-ink-soft">Jouw record: {best.toLocaleString("nl-NL")}</p>}
        </Card>
      )}

      {phase === "paused" && (
        <Card onClose={onClose}>
          <h2 className="font-serif text-3xl font-semibold text-ink">Even pauze</h2>
          <p className="mt-2 text-sm text-ink-soft">De motor loopt stationair. Thee erbij?</p>
          <button type="button" onClick={() => setPhase("playing")} autoFocus className={BIG_BUTTON}>
            Verder rijden
          </button>
          <button type="button" onClick={onClose} className={SECONDARY_BUTTON}>
            Stoppen
          </button>
        </Card>
      )}

      {phase === "over" && result && (
        <Card onClose={onClose}>
          {result.isRecord && (
            <p className="mx-auto mb-3 w-fit rounded-full bg-forest px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-cream motion-safe:animate-[tuktuk-pop_0.4s_ease-out]">
              Nieuw record!
            </p>
          )}
          <p className="text-sm text-ink-soft">{CRASH_LINES[result.crash]}</p>
          <p className="mt-4 font-serif text-6xl font-bold tabular-nums text-ink">{result.score.toLocaleString("nl-NL")}</p>
          <p className="mt-1 text-sm text-ink-soft">
            {result.distance.toLocaleString("nl-NL")} m · je kwam tot <strong className="text-ink">{result.reachedStop}</strong>
          </p>
          {result.message && <p className="mt-3 text-sm font-medium text-forest-dark">{result.message}</p>}
          <button type="button" onClick={start} autoFocus className={BIG_BUTTON}>
            Nog een rondje
          </button>
          <button type="button" onClick={onClose} className={SECONDARY_BUTTON}>
            Naar het scorebord
          </button>
        </Card>
      )}
    </div>
  );
}

const BIG_BUTTON =
  "mt-6 w-full rounded-full bg-terracotta-dark px-6 py-3.5 text-base font-semibold text-cream shadow-card transition hover:bg-terracotta active:scale-95";
const SECONDARY_BUTTON =
  "mt-2 w-full rounded-full px-6 py-2.5 text-sm font-semibold text-ink-soft transition hover:bg-ink/5 hover:text-ink";

function Card({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return (
    <div className="pb-safe pt-safe absolute inset-0 flex items-center justify-center bg-ink/45 p-4 backdrop-blur-[2px]">
      <div className="relative w-full max-w-sm rounded-3xl bg-cream p-6 text-center shadow-float motion-safe:animate-[tuktuk-pop_0.3s_ease-out]">
        <button
          type="button"
          onClick={onClose}
          aria-label="Sluiten"
          className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full text-ink transition hover:bg-ink/5 active:scale-95"
        >
          <CloseIcon className="h-5 w-5" />
        </button>
        {children}
      </div>
    </div>
  );
}

function HowTo({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sand/60">{icon}</span>
      <span className="pt-1">{children}</span>
    </li>
  );
}
