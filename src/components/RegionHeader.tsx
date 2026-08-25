import type { Region } from "../types/trip";

/**
 * Tussenkop in de route, plakkend aan de bovenkant zolang je door die regio
 * scrollt.
 *
 * Rendert zelf het <li>, en niet een div die de aanroeper inpakt: dit staat in
 * de <ol> van de route, waar alleen <li> als direct kind mag staan. De sticky
 * hoort daarbij op het <li> zelf, want position: sticky wordt begrensd door zijn
 * containing block. Op een ingepakte div binnen dit <li> zou dat het <li> zijn,
 * dat precies zo hoog is als de kop, en dan plakt er niets.
 */
export function RegionHeader({ region }: { region: Region }) {
  return (
    <li className="sticky top-0 z-10 -mx-1 mb-4 mt-10 list-none border-b border-ink/10 bg-cream/95 px-1 py-2.5 backdrop-blur-sm">
      <p className="font-serif text-xs font-semibold uppercase tracking-[0.3em] text-ink-soft">{region.name}</p>
    </li>
  );
}
