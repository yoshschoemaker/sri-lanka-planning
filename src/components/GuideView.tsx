import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { allTips, allWords, dailyWords, tipModules, wordGroups, type SinhalaWord, type TipModule } from "../data/guideContent";
import { wordOfTheDay } from "../utils/wordOfTheDay";
import { practiceDeck, useGuideProgress, type GuideProgress, type WordStatus } from "../utils/guideProgress";
import { useReducedMotion } from "../utils/useReducedMotion";
import { CheckIcon, ChevronNavIcon } from "./icons";

type Screen = { kind: "home" } | { kind: "words" } | { kind: "flashcards" } | { kind: "tips"; moduleId: string };

function ProgressBar({ value, total, label }: { value: number; total: number; label: string }) {
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={value}
      className="h-1.5 w-full overflow-hidden rounded-full bg-ink/10"
    >
      <div
        className="h-full rounded-full bg-forest transition-[width] duration-500"
        style={{ width: `${total ? (value / total) * 100 : 0}%` }}
      />
    </div>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="-ml-2 inline-flex items-center gap-1 rounded-full px-2 py-1 text-sm font-medium text-ink-soft transition hover:bg-ink/5 hover:text-ink"
    >
      <ChevronNavIcon direction="left" className="h-4 w-4" />
      Gids
    </button>
  );
}

function countKnown(progress: GuideProgress) {
  return allWords.filter((w) => progress.words[w.id] === "known").length;
}

function countRead(progress: GuideProgress, tips = allTips) {
  return tips.filter((tip) => progress.readTips.includes(tip.id)).length;
}

// --- Start -----------------------------------------------------------------

function HomeScreen({
  progress,
  onOpen,
  onReset,
}: {
  progress: GuideProgress;
  onOpen: (screen: Screen) => void;
  onReset: () => void;
}) {
  const today = useMemo(() => wordOfTheDay(dailyWords), []);
  const known = countKnown(progress);
  const read = countRead(progress);
  const total = allWords.length + allTips.length;
  const hasProgress = known > 0 || read > 0 || Object.keys(progress.words).length > 0;

  return (
    <>
      <p className="font-serif text-sm font-semibold uppercase tracking-[0.35em] text-terracotta-dark">Ayubowan</p>
      <h1 className="mt-2 font-serif text-4xl font-semibold text-ink">Gids</h1>
      <p className="mt-2 text-base text-ink-soft">Een beetje Singalees en wat je moet weten voor je gaat.</p>

      <div className="mt-5 flex items-center gap-3">
        <ProgressBar value={known + read} total={total} label="Totale voortgang" />
        <span className="shrink-0 text-xs font-medium text-ink-soft">
          {known + read} / {total}
        </span>
      </div>

      <section
        aria-labelledby="word-of-the-day"
        className="mt-8 rounded-2xl border border-terracotta-light/60 bg-white/70 p-6 text-center shadow-card"
      >
        <h2 id="word-of-the-day" className="text-xs font-semibold uppercase tracking-[0.2em] text-terracotta-dark">
          Woord van de dag
        </h2>
        <p className="mt-3 font-serif text-4xl font-semibold text-ink">{today.word}</p>
        <p lang="si" className="mt-1 text-xl text-ink-soft">
          {today.script}
        </p>
        <p className="mt-3 text-base text-ink">{today.meaning}</p>
        <p className="mt-0.5 text-sm italic text-ink-soft">Zeg: {today.say}</p>
        {today.tip && <p className="mx-auto mt-3 max-w-sm text-sm text-ink-soft">{today.tip}</p>}
        <button
          type="button"
          onClick={() => onOpen({ kind: "flashcards" })}
          className="mt-5 rounded-full bg-terracotta-dark px-5 py-2.5 text-sm font-semibold text-cream shadow-card transition hover:bg-terracotta active:scale-95"
        >
          Woorden oefenen
        </button>
      </section>

      <h2 className="mt-10 mb-4 font-serif text-2xl font-semibold text-ink">Onderwerpen</h2>
      <ul className="flex flex-col gap-3">
        <ModuleCard
          title="Taal"
          intro={`${allWords.length} woorden: begroeten, bestellen en tellen.`}
          value={known}
          total={allWords.length}
          unit="gekend"
          onClick={() => onOpen({ kind: "words" })}
        />
        {tipModules.map((module) => (
          <ModuleCard
            key={module.id}
            title={module.title}
            intro={module.intro}
            value={countRead(progress, module.tips)}
            total={module.tips.length}
            unit="gelezen"
            onClick={() => onOpen({ kind: "tips", moduleId: module.id })}
          />
        ))}
      </ul>

      {hasProgress && (
        <button
          type="button"
          onClick={() => {
            if (window.confirm("Alle voortgang in de Gids wissen?")) onReset();
          }}
          className="mt-8 text-xs font-medium text-ink-soft underline-offset-2 hover:text-terracotta-dark hover:underline"
        >
          Voortgang wissen
        </button>
      )}
    </>
  );
}

function ModuleCard({
  title,
  intro,
  value,
  total,
  unit,
  onClick,
}: {
  title: string;
  intro: string;
  value: number;
  total: number;
  unit: string;
  onClick: () => void;
}) {
  const done = value === total;
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="w-full rounded-2xl border border-ink/10 bg-white/70 p-4 text-left shadow-card transition-colors hover:border-terracotta-light active:scale-[0.99]"
      >
        <div className="flex items-baseline justify-between gap-3">
          <span className="font-serif text-xl font-semibold text-ink">{title}</span>
          <span className={`inline-flex items-center gap-1 text-xs font-medium ${done ? "text-forest-dark" : "text-ink-soft"}`}>
            {done && <CheckIcon className="h-3.5 w-3.5" />}
            {value} / {total} {unit}
          </span>
        </div>
        <p className="mt-1 text-sm text-ink-soft">{intro}</p>
        <div className="mt-3">
          <ProgressBar value={value} total={total} label={`${title}: ${value} van ${total} ${unit}`} />
        </div>
      </button>
    </li>
  );
}

// --- Woordenlijst ------------------------------------------------------------

function WordsScreen({
  progress,
  onStatus,
  onPractice,
}: {
  progress: GuideProgress;
  onStatus: (id: string, status: WordStatus | null) => void;
  onPractice: () => void;
}) {
  return (
    <>
      <h1 className="mt-3 font-serif text-4xl font-semibold text-ink">Taal</h1>
      <p className="mt-2 text-base text-ink-soft">
        Vink af wat je kent. Wat je nog niet kent komt vaker langs bij het oefenen.
      </p>
      <button
        type="button"
        onClick={onPractice}
        className="mt-5 rounded-full bg-terracotta-dark px-5 py-2.5 text-sm font-semibold text-cream shadow-card transition hover:bg-terracotta active:scale-95"
      >
        Woorden oefenen
      </button>

      {wordGroups.map((group) => (
        <section key={group.id} className="mt-8">
          <h2 className="mb-3 font-serif text-xl font-semibold text-ink">{group.title}</h2>
          <ul className="flex flex-col gap-2">
            {group.words.map((word) => (
              <WordRow key={word.id} word={word} status={progress.words[word.id]} onStatus={onStatus} />
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}

function WordRow({
  word,
  status,
  onStatus,
}: {
  word: SinhalaWord;
  status: WordStatus | undefined;
  onStatus: (id: string, status: WordStatus | null) => void;
}) {
  const known = status === "known";
  return (
    <li className="flex items-start gap-3 rounded-xl border border-ink/10 bg-white/60 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
          <span className="font-serif text-lg font-semibold text-ink">{word.word}</span>
          <span className="text-sm text-ink">{word.meaning}</span>
        </div>
        <p className="mt-0.5 text-sm text-ink-soft">
          <span className="italic">{word.say}</span>
          <span className="mx-1.5 text-ink/30">·</span>
          <span lang="si">{word.script}</span>
        </p>
        {word.tip && <p className="mt-1.5 text-xs leading-relaxed text-ink-soft">{word.tip}</p>}
      </div>
      <button
        type="button"
        onClick={() => onStatus(word.id, known ? null : "known")}
        aria-pressed={known}
        aria-label={`${word.word} ken ik`}
        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition active:scale-90 ${
          known ? "border-forest bg-forest text-cream" : "border-ink/20 text-transparent hover:border-forest hover:text-forest/50"
        }`}
      >
        <CheckIcon className="h-4 w-4" />
      </button>
    </li>
  );
}

// --- Flitskaarten ------------------------------------------------------------

function FlashcardsScreen({
  progress,
  onStatus,
  onDone,
}: {
  progress: GuideProgress;
  onStatus: (id: string, status: WordStatus) => void;
  onDone: () => void;
}) {
  // Het stapeltje ligt vast bij de start van een ronde. Zou het meebewegen met
  // de voortgang, dan verdween elk woord dat je "ken ik" geeft meteen onder je
  // handen uit de telling.
  const [round, setRound] = useState(0);
  const deck = useMemo(() => practiceDeck(allWords, progress), [round]); // eslint-disable-line react-hooks/exhaustive-deps
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [knownThisRound, setKnownThisRound] = useState(0);
  const prefersReducedMotion = useReducedMotion();

  const finished = index >= deck.length;
  const card = deck[index];

  function answer(status: WordStatus) {
    onStatus(card.id, status);
    if (status === "known") setKnownThisRound((n) => n + 1);
    setFlipped(false);
    setIndex((i) => i + 1);
  }

  function again() {
    setRound((r) => r + 1);
    setIndex(0);
    setKnownThisRound(0);
    setFlipped(false);
  }

  if (finished) {
    return (
      <div className="mt-10 rounded-2xl border border-ink/10 bg-white/70 p-8 text-center shadow-card">
        <p className="font-serif text-3xl font-semibold text-ink">Istuti!</p>
        <p className="mt-2 text-base text-ink-soft">
          Ronde klaar: {knownThisRound} van {deck.length} gekend.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={again}
            className="rounded-full bg-terracotta-dark px-5 py-2.5 text-sm font-semibold text-cream shadow-card transition hover:bg-terracotta active:scale-95"
          >
            Nog een ronde
          </button>
          <button
            type="button"
            onClick={onDone}
            className="rounded-full border border-ink/15 px-5 py-2.5 text-sm font-medium text-ink transition hover:bg-ink/5 active:scale-95"
          >
            Terug naar de Gids
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="mt-4 flex items-center gap-3">
        <ProgressBar value={index} total={deck.length} label="Voortgang van deze ronde" />
        <span className="shrink-0 text-xs font-medium text-ink-soft">
          {index + 1} / {deck.length}
        </span>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.button
          key={`${card.id}-${flipped}`}
          type="button"
          onClick={() => setFlipped((f) => !f)}
          aria-label={flipped ? `${card.word}: ${card.meaning}. Tik om terug te draaien` : `${card.word}. Tik om de betekenis te zien`}
          initial={prefersReducedMotion ? { opacity: 0 } : { rotateY: -90, opacity: 0 }}
          animate={prefersReducedMotion ? { opacity: 1 } : { rotateY: 0, opacity: 1 }}
          exit={prefersReducedMotion ? { opacity: 0 } : { rotateY: 90, opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="mt-6 flex min-h-64 w-full flex-col items-center justify-center rounded-3xl border border-terracotta-light/60 bg-white/80 p-8 text-center shadow-card"
        >
          {flipped ? (
            <>
              <span className="font-serif text-3xl font-semibold text-ink">{card.meaning}</span>
              <span className="mt-2 text-base italic text-ink-soft">Zeg: {card.say}</span>
              {card.tip && <span className="mt-4 max-w-sm text-sm text-ink-soft">{card.tip}</span>}
            </>
          ) : (
            <>
              <span className="font-serif text-4xl font-semibold text-ink">{card.word}</span>
              <span lang="si" className="mt-2 text-2xl text-ink-soft">
                {card.script}
              </span>
              <span className="mt-6 text-xs font-medium uppercase tracking-[0.2em] text-ink-soft/70">Tik om te draaien</span>
            </>
          )}
        </motion.button>
      </AnimatePresence>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => answer("practice")}
          className="rounded-full border border-ink/15 bg-white/60 px-4 py-3 text-sm font-semibold text-ink transition hover:bg-ink/5 active:scale-95"
        >
          Nog oefenen
        </button>
        <button
          type="button"
          onClick={() => answer("known")}
          className="rounded-full bg-forest px-4 py-3 text-sm font-semibold text-cream shadow-card transition hover:bg-forest-dark active:scale-95"
        >
          Ken ik
        </button>
      </div>
    </>
  );
}

// --- Weetjes -------------------------------------------------------------------

function TipsScreen({
  module,
  progress,
  onToggle,
}: {
  module: TipModule;
  progress: GuideProgress;
  onToggle: (id: string) => void;
}) {
  return (
    <>
      <h1 className="mt-3 font-serif text-4xl font-semibold text-ink">{module.title}</h1>
      <p className="mt-2 text-base text-ink-soft">{module.intro}</p>
      <ul className="mt-6 flex flex-col gap-3">
        {module.tips.map((tip) => {
          const read = progress.readTips.includes(tip.id);
          return (
            <li
              key={tip.id}
              className={`rounded-2xl border p-4 transition-colors ${read ? "border-forest/30 bg-forest/5" : "border-ink/10 bg-white/70 shadow-card"}`}
            >
              <h2 className="font-serif text-lg font-semibold text-ink">{tip.title}</h2>
              <p className="mt-1 text-sm leading-relaxed text-ink-soft">{tip.body}</p>
              <button
                type="button"
                onClick={() => onToggle(tip.id)}
                aria-pressed={read}
                className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition active:scale-95 ${
                  read ? "bg-forest text-cream" : "border border-ink/15 text-ink-soft hover:border-forest hover:text-forest-dark"
                }`}
              >
                <CheckIcon className="h-3.5 w-3.5" />
                {read ? "Gelezen" : "Markeer als gelezen"}
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}

// --- Pagina ------------------------------------------------------------------

/**
 * De Gids: basis-Singalees en wat je over het land moet weten. De voortgang
 * staat per toestel in localStorage (zie utils/guideProgress.ts), dus ieder
 * houdt zijn eigen bij.
 */
export function GuideView() {
  const [screen, setScreen] = useState<Screen>({ kind: "home" });
  const { progress, setWordStatus, toggleTipRead, reset } = useGuideProgress();

  // Elk scherm begint bovenaan, zoals een nieuwe pagina.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [screen]);

  const tipModule = screen.kind === "tips" ? tipModules.find((m) => m.id === screen.moduleId) : undefined;
  const home = () => setScreen({ kind: "home" });

  return (
    <div className="pt-safe">
      <main className="mx-auto max-w-2xl px-5 py-8 sm:px-8 sm:py-12">
        {screen.kind !== "home" && <BackButton onClick={home} />}

        {screen.kind === "home" && <HomeScreen progress={progress} onOpen={setScreen} onReset={reset} />}
        {screen.kind === "words" && (
          <WordsScreen progress={progress} onStatus={setWordStatus} onPractice={() => setScreen({ kind: "flashcards" })} />
        )}
        {screen.kind === "flashcards" && <FlashcardsScreen progress={progress} onStatus={setWordStatus} onDone={home} />}
        {tipModule && <TipsScreen module={tipModule} progress={progress} onToggle={toggleTipRead} />}
      </main>
    </div>
  );
}
