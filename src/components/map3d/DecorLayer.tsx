import { Fragment, type ReactNode, type RefObject } from "react";
import { Sparkles } from "@react-three/drei";
import type { DecorItem, DecorType } from "../../data/mapDecor";
import { decorItems } from "../../data/mapDecor";
import type { WorldPoint } from "../../utils/projection3d";
import { getTerrainSurfaceY } from "./Highlands";
import { PalmTree } from "./PalmTree";
import { Stupa } from "./Stupa";
import { Temple } from "./Temple";
import { SigiriyaRock } from "./SigiriyaRock";
import { NineArchesBridge } from "./NineArchesBridge";
import { GalleFort } from "./GalleFort";
import { Waterfall } from "./Waterfall";
import { Leopard } from "./Leopard";
import { Elephant } from "./Elephant";
import { Peacock } from "./Peacock";
import { FishSchool } from "./FishSchool";
import { Turtle } from "./Turtle";
import { Whale } from "./Whale";
import { JungleTree, getRowHeadings } from "./JungleTree";
import { Monkey } from "./Monkey";

/**
 * Everything each renderer might need beyond its own position. Passed as one
 * object so adding a new decor type that happens to need, say, the night value
 * doesn't mean changing every other entry's signature.
 */
export interface DecorContext {
  prefersReducedMotion: boolean;
  nightRef: RefObject<number>;
  /** Whether it's dark enough for fireflies to show. */
  nightFlavor: boolean;
}

type DecorRenderer = (item: DecorItem, context: DecorContext) => ReactNode;

/** Position of a non-grove item. The DEV check in mapDecor.ts warns when one is missing coordinates; here it simply doesn't render. */
function pointOf(item: DecorItem): WorldPoint | null {
  return item.x == null || item.z == null ? null : { x: item.x, z: item.z };
}

/** Wraps a renderer that only ever needs x/z, which is most of them. */
function placed(render: (point: WorldPoint, item: DecorItem, context: DecorContext) => ReactNode): DecorRenderer {
  return (item, context) => {
    const point = pointOf(item);
    return point ? render(point, item, context) : null;
  };
}

/**
 * One entry per decor type in content/decor.json. This registry is the whole
 * seam: placing, moving or removing anything on the island is a JSON edit, and
 * only introducing a genuinely new *kind* of object (a lighthouse, a second
 * species) needs a component plus a line here.
 */
const RENDERERS: Record<DecorType, DecorRenderer> = {
  palmTree: placed((p) => <PalmTree x={p.x} z={p.z} />),
  stupa: placed((p) => <Stupa x={p.x} z={p.z} />),
  sigiriyaRock: placed((p) => <SigiriyaRock x={p.x} z={p.z} />),
  galleFort: placed((p) => <GalleFort x={p.x} z={p.z} />),

  nineArches: placed((p, item) => <NineArchesBridge x={p.x} z={p.z} rotation={item.rotation ?? 0} />),

  waterfall: placed((p, item, ctx) => (
    <Waterfall
      x={p.x}
      z={p.z}
      rotation={item.rotation ?? 0}
      nightRef={ctx.nightRef}
      prefersReducedMotion={ctx.prefersReducedMotion}
    />
  )),

  // The fireflies are opt-in per temple rather than automatic: they read as a
  // lit, lived-in courtyard, which fits the Temple of the Tooth and would be
  // odd on a cave temple you only visit by day. Anchored on the terrain
  // surface, not on a flat island height — this temple stands up in the hill
  // country, and an absolute Y sinks the sparkles below its terrace.
  temple: placed((p, item, ctx) => (
    <>
      <Temple x={p.x} z={p.z} />
      {item.fireflies && (
        <Sparkles
          count={16}
          scale={[0.35, 0.35, 0.35]}
          position={[p.x, getTerrainSurfaceY(p.x, p.z) + 0.08, p.z]}
          size={2.4}
          speed={0.2}
          noise={1.2}
          color="#ffd873"
          opacity={ctx.nightFlavor ? 0.85 : 0.1}
        />
      )}
    </>
  )),

  // The animals that come and go on their own timers (see useAppearanceCycle):
  // their x/z is a home position, i.e. the middle of the short walk each takes,
  // not a spot they stand on.
  leopard: placed((p, _item, ctx) => <Leopard x={p.x} z={p.z} prefersReducedMotion={ctx.prefersReducedMotion} />),
  elephant: placed((p, _item, ctx) => <Elephant x={p.x} z={p.z} prefersReducedMotion={ctx.prefersReducedMotion} />),
  peacock: placed((p, _item, ctx) => <Peacock x={p.x} z={p.z} prefersReducedMotion={ctx.prefersReducedMotion} />),

  // Anchors rather than fixed spots: each swims a bounded patrol loop around
  // its point, so moving one means re-checking it stays clear of the coastline
  // for the whole loop.
  fishSchool: placed((p, _item, ctx) => <FishSchool x={p.x} z={p.z} prefersReducedMotion={ctx.prefersReducedMotion} />),
  turtle: placed((p, _item, ctx) => <Turtle x={p.x} z={p.z} prefersReducedMotion={ctx.prefersReducedMotion} />),
  whale: placed((p, _item, ctx) => <Whale x={p.x} z={p.z} prefersReducedMotion={ctx.prefersReducedMotion} />),

  // The trees are permanent scenery; only the monkey cycles, which is what
  // makes catching it a treat. Each tree faces along the row so the limb the
  // monkey hangs from points at its neighbour.
  monkeyGrove: (item, context) => {
    const trees = item.trees ?? [];
    if (trees.length < 2) return null;
    const headings = getRowHeadings(trees);
    return (
      <>
        {trees.map((tree, i) => (
          <JungleTree key={`${tree.x}-${tree.z}`} x={tree.x} z={tree.z} heading={headings[i]} />
        ))}
        <Monkey trees={trees} prefersReducedMotion={context.prefersReducedMotion} />
      </>
    );
  },
};

/** Renders content/decor.json. Order in the file is render order, which the depth buffer makes irrelevant except for the sea creatures drawn over the water plane. */
export function DecorLayer(context: DecorContext) {
  return (
    <>
      {decorItems.map((item, i) => {
        const render = RENDERERS[item.type];
        if (!render) return null;
        return <Fragment key={`${item.type}-${i}`}>{render(item, context)}</Fragment>;
      })}
    </>
  );
}
