import { useState, type FormEvent, type ReactNode } from "react";
import type { BookingDetails, Budget, Stop, Trip } from "../types/trip";
import {
  buildBudgetOverview,
  cancellationStatus,
  formatEuro,
  platformOf,
  splitDivisor,
  type BudgetSplit,
} from "../utils/budget";
import { useBudgetUnlock } from "../utils/budgetLock";
import { todayIso } from "../utils/currentStop";
import { formatDayMonth } from "../utils/formatDate";
import { BedIcon, CompassIcon, MoonIcon, PlaneIcon, UserIcon, WalletIcon } from "./icons";
import { PlatformLogo } from "./PlatformLogo";
import { Photo } from "./Photo";
import { PHOTO_SIZES } from "../utils/photos";

interface BudgetViewProps {
  trip: Trip;
  stops: Stop[];
  budget: Budget;
}

const SPLITS: { id: BudgetSplit; label: string }[] = [
  { id: "total", label: "Totaal" },
  { id: "couple", label: "Per stel" },
  { id: "person", label: "Per persoon" },
];

const SPLIT_STORAGE_KEY = "srilanka-trip:budget-split";

/** Onthoudt per toestel welke weergave je het laatst koos. Lukt opslaan niet, dan begint het gewoon bij Totaal. */
function readSplit(): BudgetSplit {
  try {
    const raw = window.localStorage.getItem(SPLIT_STORAGE_KEY);
    return raw === "couple" || raw === "person" ? raw : "total";
  } catch {
    return "total";
  }
}

function writeSplit(split: BudgetSplit): void {
  try {
    window.localStorage.setItem(SPLIT_STORAGE_KEY, split);
  } catch {
    // Alleen een gemak; zonder opslag geldt de keuze voor deze sessie.
  }
}

function PageHeader({ people, travellers }: { people: number; travellers?: string[] }) {
  const names =
    travellers && travellers.length > 1
      ? `${travellers.slice(0, -1).join(", ")} en ${travellers[travellers.length - 1]}`
      : null;
  return (
    <>
      <p className="font-serif text-sm font-semibold uppercase tracking-[0.35em] text-terracotta-dark">Kosten</p>
      <h1 className="mt-2 font-serif text-4xl font-semibold text-ink">Budget</h1>
      <p className="mt-2 text-base text-ink-soft">
        Wat de reis kost voor {names ?? `${people} personen`}.
      </p>
    </>
  );
}

/**
 * De Budget-tab. Eenmalig per toestel achter een wachtwoord (zie
 * utils/budgetLock.ts voor wat dat wel en niet afschermt).
 */
export function BudgetView(props: BudgetViewProps) {
  const { unlocked, unlock } = useBudgetUnlock();

  return (
    <div className="pt-safe">
      <main className="mx-auto max-w-3xl px-5 py-8 sm:px-8 sm:py-12">
        <PageHeader people={props.budget.people} travellers={props.budget.travellers} />
        {unlocked ? <BudgetContent {...props} /> : <UnlockForm onUnlock={unlock} />}
      </main>
    </div>
  );
}

function UnlockForm({ onUnlock }: { onUnlock: (input: string) => Promise<boolean> }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    const ok = await onUnlock(value);
    setBusy(false);
    setError(!ok);
  };

  return (
    <form onSubmit={submit} className="mt-8 rounded-3xl border border-ink/10 bg-white/70 p-6 shadow-card sm:p-8">
      <WalletIcon className="h-8 w-8 text-terracotta-dark" />
      <h2 className="mt-3 font-serif text-2xl font-semibold text-ink">Prijzen afgeschermd</h2>
      <p className="mt-1 text-sm text-ink-soft">Vul het wachtwoord in. Dat hoeft op dit toestel maar één keer.</p>
      <label htmlFor="budget-password" className="sr-only">
        Wachtwoord
      </label>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input
          id="budget-password"
          type="password"
          autoComplete="off"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(false);
          }}
          aria-invalid={error}
          aria-describedby={error ? "budget-password-error" : undefined}
          className="min-w-0 flex-1 rounded-full border border-ink/20 bg-white px-4 py-2.5 text-base text-ink outline-none focus:border-terracotta"
          placeholder="Wachtwoord"
        />
        <button
          type="submit"
          disabled={busy || value.length === 0}
          className="rounded-full bg-terracotta-dark px-5 py-2.5 text-sm font-semibold text-cream shadow-card transition hover:bg-terracotta active:scale-95 disabled:opacity-50"
        >
          Ontgrendel
        </button>
      </div>
      {error && (
        <p id="budget-password-error" role="alert" className="mt-2 text-sm text-terracotta-dark">
          Dat is niet het goede wachtwoord.
        </p>
      )}
    </form>
  );
}

/**
 * Wat de reis kost: de verblijven, de vliegtickets en het totaal. Alle bedragen
 * staan als groepstotaal in content/trip.json; de knoppen bovenaan delen ze
 * alleen bij het tonen door per stel of per persoon.
 */
function BudgetContent({ trip, stops, budget }: BudgetViewProps) {
  const [split, setSplit] = useState<BudgetSplit>(readSplit);
  const overview = buildBudgetOverview(stops, budget);
  const divisor = splitDivisor(split, budget.people);
  const show = (amount: number) => formatEuro(amount / divisor);
  const suffix = split === "couple" ? " per stel" : split === "person" ? " per persoon" : "";
  const today = todayIso();

  const chooseSplit = (next: BudgetSplit) => {
    setSplit(next);
    writeSplit(next);
  };

  const { outbound } = trip.flights;

  return (
    <>
      <div role="group" aria-label="Bedragen tonen als" className="mt-6 inline-flex gap-1 rounded-full border border-ink/15 bg-white/60 p-1">
        {SPLITS.map((option) => (
          <button
            key={option.id}
            type="button"
            aria-pressed={split === option.id}
            onClick={() => chooseSplit(option.id)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
              split === option.id ? "bg-ink text-cream" : "text-ink-soft hover:bg-ink/5"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <section aria-labelledby="budget-stays" className="mt-8">
        <h2 id="budget-stays" className="mb-3 flex items-center gap-2 font-serif text-2xl font-semibold text-ink">
          <BedIcon className="h-5 w-5 text-ink-soft" />
          Verblijven
        </h2>
        <ul className="overflow-hidden rounded-2xl border border-ink/10 bg-white/70 shadow-card">
          {overview.stays.map((line) => (
            <li key={line.stopId} className="flex items-start gap-3 border-b border-ink/5 px-4 py-3 last:border-b-0 sm:px-5">
              {line.photo ? (
                <Photo
                  path={line.photo}
                  alt=""
                  sizes={PHOTO_SIZES.cardThumb}
                  className="mt-0.5 h-12 w-12 shrink-0 rounded-xl object-cover sm:h-16 sm:w-16"
                />
              ) : (
                <div className="mt-0.5 h-12 w-12 shrink-0 rounded-xl border border-dashed border-ink/20 sm:h-16 sm:w-16" aria-hidden />
              )}
              <div className="min-w-0 flex-1">
                <p className="font-medium text-ink">{line.stopName}</p>
                <p className="truncate text-sm text-ink-soft">{line.accommodation ?? "Nog niet geboekt"}</p>
                <p className="text-xs text-ink-soft">
                  {line.dates} · {line.nights} {line.nights === 1 ? "nacht" : "nachten"}
                </p>
                {line.accommodation && (
                  <BookingMeta booking={line.booking} url={line.url} price={line.price} show={show} today={today} />
                )}
              </div>
              <div className="shrink-0 text-right">
                {line.price === null && line.estimate !== null ? (
                  <>
                    <p className="font-serif text-lg font-semibold tabular-nums text-ink-soft">
                      <span className="mr-0.5 text-sm font-normal">±</span>
                      {show(line.estimate)}
                    </p>
                    <p className="text-xs text-ink-soft">schatting</p>
                  </>
                ) : line.price === null ? (
                  <p className="text-sm italic text-ink-soft">prijs volgt</p>
                ) : (
                  <>
                    <p className="font-serif text-lg font-semibold tabular-nums text-ink">{show(line.price)}</p>
                    <p className="inline-flex items-center gap-1 text-xs tabular-nums text-ink-soft">
                      <MoonIcon className="h-3 w-3 shrink-0" />
                      {show(line.price / line.nights)} p/n
                    </p>
                  </>
                )}
              </div>
            </li>
          ))}
          <li className="flex items-start gap-3 bg-sand/40 px-4 py-3 sm:px-5">
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-ink">Totaal verblijven</p>
              {overview.staysMissing > 0 && (
                <p className="text-xs text-ink-soft">
                  {overview.staysMissing} {overview.staysMissing === 1 ? "verblijf" : "verblijven"} nog zonder prijs
                </p>
              )}
            </div>
            <div className="shrink-0 text-right">
              <p className="font-serif text-lg font-semibold tabular-nums text-ink">{show(overview.staysTotal)}</p>
              {overview.pricedNights > 0 && (
                <p className="inline-flex items-center gap-1 text-xs tabular-nums text-ink-soft">
                  <MoonIcon className="h-3 w-3 shrink-0" />
                  gem. {show(overview.staysTotal / overview.pricedNights)} per nacht
                </p>
              )}
            </div>
          </li>
        </ul>
      </section>

      <section aria-labelledby="budget-flights" className="mt-8">
        <h2 id="budget-flights" className="mb-3 flex items-center gap-2 font-serif text-2xl font-semibold text-ink">
          <PlaneIcon className="h-5 w-5 text-ink-soft" />
          Vliegtickets
        </h2>
        <div className="flex items-start gap-3 rounded-2xl border border-ink/10 bg-white/70 px-4 py-3 shadow-card sm:px-5">
          <div className="min-w-0 flex-1">
            <p className="font-medium text-ink">
              {outbound.from} ⇄ {outbound.to}
            </p>
            <p className="text-sm text-ink-soft">
              {outbound.airline} · via {outbound.via}
            </p>
            {outbound.baggage && <p className="text-xs text-ink-soft">{outbound.baggage}</p>}
            <BookingMeta booking={budget.flightBooking} price={overview.flights} show={show} today={today} />
          </div>
          <div className="shrink-0 text-right">
            {overview.flights === null ? (
              <p className="text-sm italic text-ink-soft">prijs volgt</p>
            ) : (
              <p className="font-serif text-lg font-semibold tabular-nums text-ink">{show(overview.flights)}</p>
            )}
          </div>
        </div>
      </section>

      {overview.extras.length > 0 && (
        <section aria-labelledby="budget-extras" className="mt-8">
          <h2 id="budget-extras" className="mb-3 flex items-center gap-2 font-serif text-2xl font-semibold text-ink">
            <CompassIcon className="h-5 w-5 text-ink-soft" />
            Vervoer ter plaatse
          </h2>
          <ul className="overflow-hidden rounded-2xl border border-ink/10 bg-white/70 shadow-card">
            {overview.extras.map((line) => (
              <li key={line.label} className="flex items-start gap-3 border-b border-ink/5 px-4 py-3 last:border-b-0 sm:px-5">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-ink">{line.label}</p>
                  {line.note && <p className="text-sm text-ink-soft">{line.note}</p>}
                  <BookingMeta booking={line.booking} price={line.amount} show={show} today={today} />
                </div>
                <div className="shrink-0 text-right">
                  {line.amount === null ? (
                    <p className="text-sm italic text-ink-soft">prijs volgt</p>
                  ) : (
                    <>
                      <p className="font-serif text-lg font-semibold tabular-nums text-ink">
                        {line.estimate && <span className="mr-0.5 text-sm font-normal text-ink-soft">±</span>}
                        {show(line.amount)}
                      </p>
                      {line.estimate && <p className="text-xs text-ink-soft">schatting</p>}
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="budget-total" className="mt-10 rounded-3xl bg-forest p-6 text-cream shadow-card sm:p-8">
        <p id="budget-total" className="text-xs font-semibold uppercase tracking-[0.2em] text-sand">
          Prognose totaal{suffix}
        </p>
        <p className="mt-1 font-serif text-5xl font-bold tabular-nums" aria-live="polite">
          {show(overview.forecastTotal)}
        </p>
        <p className="mt-2 text-sm text-cream/80">
          Verblijven, vliegtickets en vervoer, inclusief schattingen voor wat nog geen vaste prijs heeft.
        </p>

        {/* Eén balk, drie delen die samen precies de prognose zijn. */}
        {overview.forecastTotal > 0 && (
          <div className="mt-5 flex h-2.5 w-full overflow-hidden rounded-full bg-cream/15" aria-hidden>
            <span className="bg-cream" style={{ width: `${(overview.paidTotal / overview.forecastTotal) * 100}%` }} />
            <span className="bg-sand/70" style={{ width: `${(overview.openTotal / overview.forecastTotal) * 100}%` }} />
            <span
              className="bg-[repeating-linear-gradient(135deg,rgba(250,245,234,0.45)_0_4px,transparent_4px_8px)]"
              style={{ width: `${(overview.estimatedTotal / overview.forecastTotal) * 100}%` }}
            />
          </div>
        )}

        <dl className="mt-4 flex flex-col gap-2.5 text-sm">
          <ForecastRow swatch="bg-cream" label="Al betaald" amount={show(overview.paidTotal)} />
          <ForecastRow swatch="bg-sand/70" label="Nog te betalen" detail="vaste prijzen" amount={show(overview.openTotal)} />
          <ForecastRow
            swatch="bg-[repeating-linear-gradient(135deg,rgba(250,245,234,0.7)_0_3px,transparent_3px_6px)] ring-1 ring-cream/40"
            label="Nog onzeker"
            detail="schattingen"
            amount={`± ${show(overview.estimatedTotal)}`}
          />
        </dl>

        {overview.missingCount > 0 && (
          <p className="mt-4 border-t border-cream/15 pt-3 text-xs text-cream/70">
            {overview.missingCount} {overview.missingCount === 1 ? "post heeft" : "posten hebben"} nog geen prijs en ook
            geen schatting, en tellen nog niet mee.
          </p>
        )}
      </section>
    </>
  );
}

function ForecastRow({ swatch, label, detail, amount }: { swatch: string; label: string; detail?: string; amount: string }) {
  return (
    <div className="flex items-baseline gap-2.5">
      <span className={`h-2.5 w-2.5 shrink-0 translate-y-px rounded-sm ${swatch}`} aria-hidden />
      <dt className="flex-1 text-cream/90">
        {label}
        {detail && <span className="ml-1.5 text-xs text-cream/60">{detail}</span>}
      </dt>
      <dd className="font-serif text-lg font-semibold tabular-nums">{amount}</dd>
    </div>
  );
}

const CHIP = "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium";

/**
 * De boekingsgegevens van één post als een rij labels: waar het staat, wie het
 * boekte, de betaalstatus, de incasso en of annuleren nog kan. Wat niet is
 * ingevuld, wordt weggelaten.
 */
function BookingMeta({
  booking,
  url,
  price,
  show,
  today,
}: {
  booking: BookingDetails | undefined;
  url?: string;
  price: number | null;
  show: (amount: number) => string;
  today: string;
}) {
  const chips: ReactNode[] = [];
  const platform = platformOf(booking, url);

  // Volgorde: eerst waar de boeking staat, dan of het betaald is en of je
  // nog terug kunt, daarna wie het regelde en de praktische details.
  if (platform) {
    chips.push(
      <span key="platform" className={`${CHIP} gap-1 bg-white text-ink ring-1 ring-ink/10`}>
        <PlatformLogo platform={platform} className="h-3 w-3 shrink-0" />
        {platform}
      </span>,
    );
  }
  if (booking?.awaitingConfirmation) {
    chips.push(
      <span key="confirm" className={`${CHIP} bg-sand text-ink`}>
        nog niet bevestigd
      </span>,
    );
  }
  if (booking?.payment === "paid") {
    chips.push(
      <span key="pay" className={`${CHIP} bg-forest/10 text-forest-dark`}>
        betaald
      </span>,
    );
  } else if (booking?.payment === "partial") {
    chips.push(
      <span key="pay" className={`${CHIP} bg-sand text-ink`}>
        deels betaald{booking.paidAmount != null && price !== null ? ` · ${show(booking.paidAmount)} van ${show(price)}` : ""}
      </span>,
    );
  } else if (booking?.payment === "unpaid") {
    chips.push(
      <span key="pay" className={`${CHIP} bg-terracotta-dark/10 text-terracotta-dark`}>
        nog niet betaald
      </span>,
    );
  }

  const cancel = cancellationStatus(booking, today);
  if (cancel.kind === "anytime") {
    chips.push(
      <span key="cancel" className={`${CHIP} bg-forest/10 text-forest-dark`}>
        altijd gratis annuleren
      </span>,
    );
  } else if (cancel.kind === "free") {
    chips.push(
      <span key="cancel" className={`${CHIP} bg-forest/10 text-forest-dark`}>
        gratis annuleren t/m {formatDayMonth(cancel.until)}
      </span>,
    );
  } else if (cancel.kind === "expired" || cancel.kind === "none") {
    chips.push(
      <span key="cancel" className={`${CHIP} bg-ink/5 text-ink-soft`}>
        niet meer annuleerbaar
      </span>,
    );
  }

  if (booking?.bookedBy) {
    chips.push(
      <BookedByChip key="by" name={booking.bookedBy} />,
    );
  }
  if (booking?.settled) {
    chips.push(
      <span key="settled" className={`${CHIP} bg-forest/10 text-forest-dark`}>
        verrekend
      </span>,
    );
  }
  if (booking?.payAtProperty && booking.payment !== "paid") {
    chips.push(
      <span key="property" className={`${CHIP} bg-ink/5 text-ink-soft`}>
        betalen bij accommodatie
      </span>,
    );
  }
  if (booking?.chargeDate && booking.payment !== "paid") {
    chips.push(
      <span key="charge" className={`${CHIP} bg-ink/5 text-ink-soft`}>
        incasso {formatDayMonth(booking.chargeDate)}
      </span>,
    );
  } else if (booking?.chargeNote && booking.payment !== "paid") {
    chips.push(
      <span key="charge" className={`${CHIP} bg-ink/5 text-ink-soft`}>
        incasso {booking.chargeNote}
      </span>,
    );
  }
  if (booking?.card) {
    chips.push(
      <span key="card" className={`${CHIP} bg-ink/5 text-ink-soft`}>
        creditcard ··{booking.card}
      </span>,
    );
  }

  if (chips.length === 0) return null;
  return <div className="mt-1.5 flex flex-wrap gap-1">{chips}</div>;
}

/**
 * Wie het boekte, compact als icoon plus naam. "Geboekt door" verschijnt bij
 * hover (title) en, omdat een telefoon geen hover heeft, ook na een tik.
 */
function BookedByChip({ name }: { name: string }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <button
      type="button"
      title={`Geboekt door ${name}`}
      aria-label={`Geboekt door ${name}`}
      onClick={() => setExpanded((prev) => !prev)}
      className={`${CHIP} gap-1 bg-ink/5 text-ink-soft transition-colors hover:bg-ink/10`}
    >
      <UserIcon className="h-3 w-3 shrink-0" />
      {expanded ? `geboekt door ${name}` : name}
    </button>
  );
}
