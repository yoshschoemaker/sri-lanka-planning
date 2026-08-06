import type { ReactNode } from "react";

export type StatTileTone = "neutral" | "positive" | "warning";

interface StatTileProps {
  icon: string;
  label: string;
  value?: ReactNode;
  detail?: ReactNode;
  tone?: StatTileTone;
  children?: ReactNode;
}

const TONE_CLASSES: Record<StatTileTone, string> = {
  neutral: "text-ink",
  positive: "text-forest-dark",
  warning: "text-terracotta-dark",
};

export function StatTile({ icon, label, value, detail, tone = "neutral", children }: StatTileProps) {
  return (
    <div className="flex flex-col gap-1.5 rounded-2xl border border-ink/10 bg-white/70 p-4 sm:p-5">
      <span className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-ink-soft">
        <span aria-hidden>{icon}</span>
        {label}
      </span>
      {value != null && (
        <p className={`font-serif text-2xl font-semibold sm:text-3xl ${TONE_CLASSES[tone]}`}>{value}</p>
      )}
      {detail && <p className="text-xs text-ink-soft">{detail}</p>}
      {children}
    </div>
  );
}
