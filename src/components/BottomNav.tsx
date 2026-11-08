import type { ReactNode } from "react";
import { CompassIcon, MapIcon, SuitcaseIcon, WalletIcon } from "./icons";

export type AppTab = "reis" | "doen" | "budget" | "kaart";

interface BottomNavProps {
  active: AppTab;
  onChange: (tab: AppTab) => void;
}

const TABS: { id: AppTab; label: string; icon: ReactNode }[] = [
  { id: "reis", label: "Reis", icon: <SuitcaseIcon className="h-5.5 w-5.5" /> },
  { id: "doen", label: "Doen", icon: <CompassIcon className="h-5.5 w-5.5" /> },
  // De Gids staat tijdelijk uit; GuideView en zijn content blijven bestaan.
  { id: "budget", label: "Budget", icon: <WalletIcon className="h-5.5 w-5.5" /> },
  { id: "kaart", label: "Kaart", icon: <MapIcon className="h-5.5 w-5.5" /> },
];

/**
 * Hoofdnavigatie. Op mobiel een balk over de volle breedte, zoals in een app;
 * op desktop een zwevende pil onderin het midden. De hoogte staat als
 * --bottom-nav-height in index.css, zodat toasts en de install-banner erboven
 * blijven en de pagina genoeg ruimte onderaan houdt.
 */
export function BottomNav({ active, onChange }: BottomNavProps) {
  return (
    <nav
      aria-label="Hoofdnavigatie"
      className="pb-safe px-safe fixed inset-x-0 bottom-0 z-30 border-t border-ink/10 bg-cream/90 backdrop-blur-md lg:inset-x-auto lg:bottom-4 lg:left-1/2 lg:-translate-x-1/2 lg:rounded-full lg:border lg:px-1.5 lg:shadow-float"
    >
      <ul className="grid h-16 grid-cols-4 lg:flex lg:h-14 lg:items-center lg:gap-1">
        {TABS.map((tab) => {
          const isActive = tab.id === active;
          return (
            <li key={tab.id}>
              <button
                type="button"
                onClick={() => onChange(tab.id)}
                aria-current={isActive ? "page" : undefined}
                className={`flex h-full w-full flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors active:scale-95 lg:h-11 lg:flex-row lg:gap-2 lg:rounded-full lg:px-5 lg:text-sm ${
                  isActive
                    ? "text-terracotta-dark lg:bg-terracotta-dark lg:text-cream"
                    : "text-ink-soft hover:text-ink lg:hover:bg-ink/5"
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
