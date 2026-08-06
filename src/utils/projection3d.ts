import { project } from "./projection";
import { MAP_VIEWBOX_WIDTH, MAP_VIEWBOX_HEIGHT } from "../data/srilankaShape";
import { WORLD_SCALE } from "../data/srilankaShape3d";

export interface WorldPoint {
  x: number;
  z: number;
}

/** Same [x, z] world-space conversion used to bake src/data/srilankaShape3d.ts. */
export function svgToWorld(x: number, y: number): WorldPoint {
  return {
    x: (x - MAP_VIEWBOX_WIDTH / 2) * WORLD_SCALE,
    z: (y - MAP_VIEWBOX_HEIGHT / 2) * WORLD_SCALE,
  };
}

/** Projects a lat/lon pair straight to the 3D scene's world space (for markers, later phases). */
export function projectToWorld(lat: number, lon: number): WorldPoint {
  const { x, y } = project(lat, lon);
  return svgToWorld(x, y);
}
