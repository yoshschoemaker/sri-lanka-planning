import { useMediaQuery } from "./useMediaQuery";

export type DetailLevel = "low" | "high";

/**
 * Same breakpoint App.tsx uses for its desktop-only behaviour. Duplicated as a
 * literal rather than imported from App.tsx, which would make the 3D layer
 * depend on the page shell.
 */
const DESKTOP_QUERY = "(min-width: 1024px)";

/**
 * How much procedural decoration the map should place. Two levels only,
 * deliberately: the scatter's counts feed straight into InstancedMesh sizes, and
 * two possible values means exactly two things to eyeball rather than a
 * continuum that's never quite tested at any particular width.
 *
 * "low" is the mobile/tablet case, where the map renders either in a 3:4 panel
 * or full-screen in MapModal on a GPU with far less headroom. "high" roughly
 * doubles the counts for desktop, where the same scene has room to be denser.
 * Both levels walk the same seeded candidate stream, so the two layouts are
 * recognisably the same forest with more trees in it — not a reshuffle. (Not
 * strictly a superset: an extra item placed early can spacing-reject a later one
 * the sparser pass had room for. It looks like the same map either way, which is
 * all that's wanted here.)
 */
export function useDetailLevel(): DetailLevel {
  return useMediaQuery(DESKTOP_QUERY) ? "high" : "low";
}
