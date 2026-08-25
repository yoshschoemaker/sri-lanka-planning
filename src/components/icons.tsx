/** Gedeelde inline SVG-iconen. Zelfde stroke-stijl als de rest van de UI. */

export function CloseIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      className={className}
      aria-hidden
    >
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

/** Het iOS-deelicoon (vierkant met pijl omhoog), voor de "Zet op beginscherm"-uitleg. */
export function IosShareIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M12 3v12" />
      <path d="M8.5 6.5L12 3l3.5 3.5" />
      <path d="M7 11H5.5A1.5 1.5 0 004 12.5v7A1.5 1.5 0 005.5 21h13a1.5 1.5 0 001.5-1.5v-7A1.5 1.5 0 0018.5 11H17" />
    </svg>
  );
}

/** Plusje in een afgerond vierkant, zoals iOS' "Zet op beginscherm"-rij. */
export function AddToHomeScreenIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <rect x="3.5" y="3.5" width="17" height="17" rx="4.5" />
      <path d="M12 8.5v7M8.5 12h7" />
    </svg>
  );
}

export function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M12 3v11" />
      <path d="M8 10.5l4 4 4-4" />
      <path d="M4 17.5v1.5A2 2 0 006 21h12a2 2 0 002-2v-1.5" />
    </svg>
  );
}

/** Tandwiel voor het instellingenknopje in de header. */
export function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <circle cx="12" cy="12" r="3.1" />
      <path d="M12 2.8l1.1 2.2 2.4-.5 1.3 2.1-1.5 1.9 1.5 1.9-1.3 2.1-2.4-.5L12 14.3l-1.1-2.2-2.4.5L7.2 10.5l1.5-1.9L7.2 6.7l1.3-2.1 2.4.5z" />
    </svg>
  );
}

/** Cirkelpijl voor de handmatige update-controle. */
export function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M20 12a8 8 0 10-2.8 6.1" />
      <path d="M20 5.5V12h-6" />
    </svg>
  );
}

export function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M5 12.5l4.5 4.5L19 7" />
    </svg>
  );
}

/**
 * Uitklap-chevron: wijst omlaag als de sectie dicht is en draait om als hij
 * open staat. De rotatie zit in het icoon zelf, zodat elk uitklappaneel in de
 * app dezelfde beweging maakt.
 */
export function ChevronIcon({ expanded, className }: { expanded: boolean; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`transition-transform duration-200 ${expanded ? "rotate-180" : ""} ${className ?? ""}`}
      aria-hidden
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

/** Navigatie-chevron voor de vorige/volgende-knoppen in de lightbox. Zelfde stroke-gewicht als CloseIcon ernaast. */
export function ChevronNavIcon({ direction, className }: { direction: "left" | "right"; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d={direction === "left" ? "M15 6l-6 6 6 6" : "M9 6l6 6-6 6"} />
    </svg>
  );
}

/** Camera-icoon voor een lege fotogalerij of een stop zonder omslagfoto. */
export function CameraIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" />
      <circle cx="12" cy="13.5" r="3.25" />
    </svg>
  );
}

/** Opgevouwen kaart, voor de knop die de kaart op mobiel opent. Zelfde stroke-taal als de andere iconen, in plaats van de 🗺-emoji die per platform anders (en bonter) rendert. */
export function MapIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M9 4.5 3.5 6.4v13.1L9 17.6l6 1.9 5.5-1.9V4.5L15 6.4z" />
      <path d="M9 4.5v13.1M15 6.4v13.1" />
    </svg>
  );
}

/** Doorgestreepte wolk: de app draait op wat er in de precache staat. */
export function OfflineIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M7.5 18.5h9.2a3.3 3.3 0 0 0 .8-6.5 5.2 5.2 0 0 0-8.2-3.4" />
      <path d="M6.6 11a3.8 3.8 0 0 0 .9 7.5" />
      <path d="M3.5 3.5l17 17" />
    </svg>
  );
}

/*
 * Iconen die eerder emoji waren.
 *
 * Emoji renderen per platform en per versie anders: 🗓 is op iOS een blauwe
 * scheurkalender en op Android een grijze, ⏳ komt op sommige systemen als een
 * gekleurde zandloper terug, en geen van beide volgt het terracotta/cream-palet
 * van de rest van de app. Deze iconen erven currentColor en spreken dezelfde
 * stroke-taal als de knoppen ernaast.
 *
 * De vervoerssoorten houden bewust wél hun emoji: die staan in
 * content/trip.json en zijn dus inhoud die je zonder code kunt aanpassen.
 */

/** Aftellen tot vertrek. */
export function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M3.5 9.75h17M8.5 3.5v3M15.5 3.5v3" />
    </svg>
  );
}

/** Nachten. */
export function MoonIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M20 14.2A8.5 8.5 0 0 1 9.8 4 8.5 8.5 0 1 0 20 14.2Z" />
    </svg>
  );
}

/** Boekingen. */
export function SuitcaseIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <rect x="3" y="7.5" width="18" height="12.5" rx="2.5" />
      <path d="M9 7.5V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5v2" />
      <path d="M9 11v6M15 11v6" />
    </svg>
  );
}

/** Verdeling van de vervoerssoorten. */
export function CompassIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M14.8 9.2l-1.6 4.4-4.4 1.6 1.6-4.4z" />
    </svg>
  );
}

/** Waar je slaapt. */
export function BedIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M3 5v14" />
      <path d="M3 9.5h15.5a2.5 2.5 0 0 1 2.5 2.5V19" />
      <path d="M3 16h18" />
      <path d="M7.5 9.5V16" />
    </svg>
  );
}

/** Hoogtepunt van de reis. */
export function SparkleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12 2.5l1.7 5.3 5.3 1.7-5.3 1.7L12 16.5l-1.7-5.3L5 9.5l5.3-1.7z" />
      <path d="M18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z" opacity="0.65" />
    </svg>
  );
}

/** Doortocht zonder overnachting. */
export function StopwatchIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <circle cx="12" cy="13.5" r="7" />
      <path d="M12 10.5v3l2 1.5M10 3.5h4" />
    </svg>
  );
}

/** Nog te doen of nog niet geboekt: de open tegenhanger van CheckIcon. */
export function CircleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className} aria-hidden>
      <circle cx="12" cy="12" r="7.5" />
    </svg>
  );
}

/** Let op. */
export function WarningIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M12 4.2l8.4 14.6H3.6z" />
      <path d="M12 9.5v4M12 16.3v.2" />
    </svg>
  );
}

/** Te regelen, en de samenvatting van de route. */
export function ClipboardIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M9 4.5H7A1.5 1.5 0 0 0 5.5 6v13A1.5 1.5 0 0 0 7 20.5h10a1.5 1.5 0 0 0 1.5-1.5V6A1.5 1.5 0 0 0 17 4.5h-2" />
      <rect x="9" y="3" width="6" height="3.2" rx="1.1" />
      <path d="M8.75 11h6.5M8.75 15h4.5" />
    </svg>
  );
}

/** Reisinfo. */
export function NotebookIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M6.5 3.5h11A1.5 1.5 0 0 1 19 5v14a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19V5a1.5 1.5 0 0 1 1.5-1.5Z" />
      <path d="M5 8h3M5 12h3M5 16h3M11 7.5h5M11 11.5h5" />
    </svg>
  );
}

/** Nog te bespreken. */
export function QuestionIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9.6 9.4a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .9-1 1.6v.3" />
      <path d="M12 16.6v.2" />
    </svg>
  );
}

/** Praktische notities. */
export function InfoIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5.2M12 7.7v.2" />
    </svg>
  );
}

/** Onderweg naar de vertrekdatum, in de teaser van de header. */
export function HourglassIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M7 3.5h10M7 20.5h10" />
      <path d="M8 3.5v3.1c0 1 .4 1.9 1.2 2.5L12 11.4l-2.8 2.3c-.8.6-1.2 1.5-1.2 2.5v2.3" />
      <path d="M16 3.5v3.1c0 1-.4 1.9-1.2 2.5L12 11.4l2.8 2.3c.8.6 1.2 1.5 1.2 2.5v2.3" />
    </svg>
  );
}

/** Palm voor de splash. */
export function PalmIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M11.6 21c.2-5.2.7-8.7 1.4-10.6" />
      <path d="M13 10.4C11.6 8.9 9.4 8.6 7.4 9.8" />
      <path d="M13 10.4c-.3-2-1.9-3.6-4.1-4" />
      <path d="M13 10.4c1.2-1.7 3.4-2.3 5.5-1.5" />
      <path d="M13 10.4c1-1.8.7-4-.8-5.5" />
    </svg>
  );
}
