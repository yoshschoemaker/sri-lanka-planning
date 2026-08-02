import { PROJECTION } from "../data/srilankaShape";

/** Projects a lat/lon pair to the same SVG coordinate space as the island silhouette. */
export function project(lat: number, lon: number): { x: number; y: number } {
  const x = (lon - PROJECTION.lonRef) * PROJECTION.cosLatRef * PROJECTION.scale + PROJECTION.translateX;
  const y = (PROJECTION.latRef - lat) * PROJECTION.scale + PROJECTION.translateY;
  return { x, y };
}
