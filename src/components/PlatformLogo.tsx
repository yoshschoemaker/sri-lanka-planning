/**
 * Klein merkje voor het boekingsplatform, als inline SVG zodat het scherp is
 * op elk formaat en niets extra's hoeft te laden. Onbekend platform: niets.
 */
export function PlatformLogo({ platform, className }: { platform: string | null; className?: string }) {
  const name = platform?.toLowerCase() ?? "";

  if (name.includes("airbnb")) {
    return (
      <svg viewBox="0 0 100 100" className={className} aria-hidden>
        <g fill="none" stroke="#ff5a5f" strokeWidth={9} strokeLinejoin="round" strokeLinecap="round">
          <path d="M50 74C46 79 40 88 31 89C18 90 10 78 16 66L38 22C41 16 44 12 50 12C56 12 59 16 62 22L84 66C90 78 82 90 69 89C60 88 54 79 50 74Z" />
          <path d="M50 74C44 66 38 58 38 50C38 43 43 39 50 39C57 39 62 43 62 50C62 58 56 66 50 74Z" />
        </g>
      </svg>
    );
  }

  if (name.includes("booking")) {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden>
        <text x="2" y="20" fontSize="21" fontWeight="800" fontFamily="Arial, Helvetica, sans-serif" fill="#163a7e">
          B
        </text>
        <circle cx="19.5" cy="18" r="2.8" fill="#05a4e1" />
      </svg>
    );
  }

  return null;
}
