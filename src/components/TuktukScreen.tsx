import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { bestScoreOf, leaderboard } from "../utils/community";
import { useCommunity } from "../utils/communityContext";
import { useTuktukRecord } from "../utils/tuktukRecord";
import { BananaIcon, TuktukGame, type RideResult } from "./TuktukGame";
import { JoinSheet } from "./JoinSheet";

/** Zijaanzicht van een tuktuk, voor de kaart in de Gids en bovenaan dit scherm. */
export function TuktukIllustration({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 80" className={className} aria-hidden>
      <ellipse cx="62" cy="72" rx="48" ry="4" fill="rgba(30,20,10,0.18)" />
      {/* Dak */}
      <path d="M30 14 Q34 6 46 6 H92 Q102 6 104 16 L106 22 H28 Z" fill="#1e3f34" />
      <rect x="28" y="18" width="78" height="4" fill="#e3a67e" />
      {/* Carrosserie */}
      <path d="M22 60 L22 40 Q22 30 32 26 L40 22 L44 22 L44 54 L100 54 L106 22 L110 24 L110 60 Z" fill="#cf7411" />
      <path d="M8 60 Q8 40 22 34 L30 30 L30 60 Z" fill="#cf7411" />
      {/* Ramen en open zijkant */}
      <path d="M32 28 L42 24 L42 44 L28 44 Q28 34 32 28 Z" fill="#9fc7cf" />
      <rect x="48" y="24" width="52" height="28" rx="4" fill="#3a2a1d" opacity="0.85" />
      <rect x="64" y="34" width="30" height="14" rx="3" fill="#9c5030" />
      {/* Koplamp en wielen */}
      <circle cx="11" cy="46" r="3.5" fill="#fff6c9" />
      <circle cx="24" cy="62" r="9" fill="#1c1712" />
      <circle cx="24" cy="62" r="3.5" fill="#8e8577" />
      <circle cx="94" cy="62" r="9" fill="#1c1712" />
      <circle cx="94" cy="62" r="3.5" fill="#8e8577" />
    </svg>
  );
}

const MEDALS = ["🥇", "🥈", "🥉"];

/**
 * Tuktuk leren rijden in de Gids: uitleg, je eigen record en het scorebord
 * van de groep. Het spel zelf opent schermvullend erboven.
 */
export function TuktukScreen() {
  const community = useCommunity();
  const { record, addRide } = useTuktukRecord();
  const [playing, setPlaying] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const { enabled, snapshot, userId, username, submitScore, refresh } = community;
  const isMember = username !== null;

  useEffect(() => {
    if (enabled) refresh();
  }, [enabled, refresh]);

  const board = useMemo(() => leaderboard(snapshot.scores, snapshot.usernames), [snapshot.scores, snapshot.usernames]);
  const serverBest = bestScoreOf(snapshot.scores, userId);

  const handleRideEnd = useCallback(
    (ride: RideResult) => {
      addRide(ride);
      if (!enabled) return null;
      if (!isMember) return "Word lid van de groep om op het scorebord te komen.";
      if (ride.score <= serverBest) return null;
      submitScore({ score: ride.score, distance: ride.distance, reachedStop: ride.reachedStop });
      return "Op het scorebord gezet!";
    },
    [addRide, enabled, isMember, serverBest, submitScore],
  );

  const close = useCallback(() => setPlaying(false), []);

  return (
    <>
      <p className="mt-3 font-serif text-sm font-semibold uppercase tracking-[0.35em] text-terracotta-dark">Mini-game</p>
      <h1 className="mt-2 font-serif text-4xl font-semibold text-ink">Tuktuk leren rijden</h1>
      <p className="mt-2 text-base text-ink-soft">
        Oefen alvast voor het echte werk. Ontwijk koeien, kuilen en bussen, en heb altijd een banaan bij je voor de
        olifant.
      </p>

      <section className="relative mt-6 overflow-hidden rounded-3xl bg-forest p-6 text-cream shadow-card">
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-[#4a4038]">
          <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 bg-[repeating-linear-gradient(90deg,#faf5ea_0_18px,transparent_18px_36px)] opacity-80" />
        </div>
        <div className="relative flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sand">Jouw record</p>
            <p className="mt-1 font-serif text-5xl font-bold tabular-nums">{record.best.toLocaleString("nl-NL")}</p>
            <p className="mt-1 text-sm text-cream/80">
              {record.reachedStop ? `Tot ${record.reachedStop} gekomen` : "Nog niet gereden"}
              {record.games > 0 && ` · ${record.games} ${record.games === 1 ? "rit" : "ritten"}`}
            </p>
          </div>
          <TuktukIllustration className="-mb-3 h-20 w-28 shrink-0 motion-safe:animate-[tuktuk-pop_0.5s_ease-out]" />
        </div>
        <button
          type="button"
          onClick={() => setPlaying(true)}
          className="relative mt-5 mb-8 w-full rounded-full bg-cream px-6 py-3.5 text-base font-semibold text-terracotta-dark shadow-card transition hover:bg-white active:scale-95"
        >
          Start de motor
        </button>
      </section>

      <h2 className="mt-10 mb-3 font-serif text-2xl font-semibold text-ink">Zo werkt het</h2>
      <ul className="flex flex-col gap-2 text-sm text-ink">
        <Rule title="Sturen">Veeg of tik links en rechts. Op een toetsenbord: de pijltjes.</Rule>
        <Rule title="De olifant" icon={<BananaIcon className="h-5 w-5" />}>
          Hij blokkeert de hele weg. Geef hem een banaan, met de knop onderin of door omhoog te vegen. Je kunt er drie
          dragen, en voor elke olifant ligt er eentje op de weg.
        </Rule>
        <Rule title="Punten">Elke meter telt. Kokosnoten +10, theeblaadjes +25, een gevoerde olifant +15.</Rule>
        <Rule title="De route">
          Je rijdt de echte reis: van de kust via de Culturele Driehoek en de mistige theeheuvels naar de zuidkust. Bij
          elke stop gaat het harder.
        </Rule>
      </ul>

      {enabled && (
        <section aria-labelledby="tuktuk-board" className="mt-10">
          <h2 id="tuktuk-board" className="mb-3 font-serif text-2xl font-semibold text-ink">
            Scorebord
          </h2>
          {board.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-ink/20 p-5 text-center text-sm text-ink-soft">
              Nog niemand op het bord. Jij de eerste?
            </p>
          ) : (
            <ol className="overflow-hidden rounded-2xl border border-ink/10 bg-white/70 shadow-card">
              {board.map((entry, i) => {
                const mine = entry.userId === userId;
                return (
                  <li
                    key={entry.userId}
                    className={`flex items-center gap-3 border-b border-ink/5 px-4 py-3 last:border-b-0 ${mine ? "bg-sand/40" : ""}`}
                  >
                    <span className="w-7 shrink-0 text-center font-serif text-lg font-semibold text-ink-soft">
                      {MEDALS[i] ?? i + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-ink">
                        {entry.username}
                        {mine && <span className="ml-1.5 text-xs font-normal text-ink-soft">(jij)</span>}
                      </span>
                      {entry.reachedStop && (
                        <span className="block truncate text-xs text-ink-soft">
                          {entry.distance.toLocaleString("nl-NL")} m · tot {entry.reachedStop}
                        </span>
                      )}
                    </span>
                    <span className="font-serif text-xl font-bold tabular-nums text-ink">
                      {entry.score.toLocaleString("nl-NL")}
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
          {!isMember && (
            <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-cream-dark p-4">
              <p className="text-sm text-ink-soft">Doe mee met de groep om je score op het bord te zetten.</p>
              <button
                type="button"
                onClick={() => setJoinOpen(true)}
                className="shrink-0 rounded-full bg-terracotta-dark px-4 py-2 text-sm font-semibold text-cream shadow-card transition hover:bg-terracotta active:scale-95"
              >
                Meedoen
              </button>
            </div>
          )}
          <JoinSheet open={joinOpen} onClose={() => setJoinOpen(false)} />
        </section>
      )}

      {playing && <TuktukGame best={record.best} onClose={close} onRideEnd={handleRideEnd} />}
    </>
  );
}

function Rule({ title, icon, children }: { title: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <li className="rounded-2xl border border-ink/10 bg-white/70 p-4 shadow-card">
      <span className="flex items-center gap-1.5 font-semibold text-ink">
        {icon}
        {title}
      </span>
      <span className="mt-1 block text-ink-soft">{children}</span>
    </li>
  );
}
