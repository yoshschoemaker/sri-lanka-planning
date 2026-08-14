import * as THREE from "three";
import type { SeaShoreField } from "./seaDistanceField";

/**
 * The sea's mesh: a polar disc, dense where the island is and coarse out at the
 * horizon.
 *
 * The old sea was `planeGeometry(60, 60, 64, 64)` — 0.94 world units per quad,
 * uniformly, which is about three and a half vertices across the longest wave
 * and none at all across the shortest. Worse, it spent the same density 30
 * units out to sea as it did against the coast, so most of those 4225 vertices
 * were displacing empty water nobody was looking at.
 *
 * ## Why a disc built in JS, not a remap in the vertex shader
 *
 * Remapping a plane's vertices in the vertex shader is fewer lines, but:
 *  - three computes the bounding sphere from the *unremapped* attribute, so the
 *    mesh either needs frustumCulled={false} or a hand-patched sphere, and a
 *    hand-patched sphere is a silent-breakage waiting to happen.
 *  - a square grid reaches 1.41x further at its corners than at its edges, so
 *    the distance haze in Water.tsx would fade at a different radius depending
 *    on the compass direction.
 *  - building it here is what allows the shore field to be baked into a vertex
 *    *attribute*. A shader remap would have to sample the field texture in the
 *    vertex stage instead, and vertex texture fetch in GLSL ES needs an
 *    explicit LOD — a classic works-on-desktop, fails-on-a-phone trap.
 */

/** Vertices per ring. */
const SPOKES = { high: 224, low: 144 } as const;

/** Ring spacing over the coastal band, then how fast that spacing grows per unit of radius beyond it. */
const SPACING = {
  high: { near: 0.09, growth: 0.07 },
  low: { near: 0.14, growth: 0.1 },
} as const;

/** Where the fine band ends. The coastline reaches 4.66 from the origin at its furthest, so this covers all of it plus the surf zone outside it. */
const COASTAL_RADIUS = 5;

/**
 * Hidden under the island, so there is no point tessellating it. The origin is
 * 1.49 units from the nearest coastline, and the beach slab is opaque across
 * its whole footprint through the entire vertical range the sea occupies, so
 * nothing inside this radius can be seen from a camera clamped to 35-75 degrees
 * of polar angle. A centre vertex still closes the disc as cheap insurance
 * against that reasoning being wrong one day.
 */
const INNER_RADIUS = 1.2;

/**
 * Far edge. Water.tsx hazes the sea into the scene background well before here,
 * so reaching further buys nothing — and this radius is chosen to keep the
 * furthest vertex inside the camera's existing `far: 100`, which is why the
 * documented near/far depth-precision fix in TripMap3D needs no adjustment.
 */
const OUTER_RADIUS = 34;

export type SeaDetail = keyof typeof SPOKES;

function ringRadii(detail: SeaDetail): number[] {
  const { near, growth } = SPACING[detail];
  const radii: number[] = [];
  let r = INNER_RADIUS;
  while (r < OUTER_RADIUS) {
    radii.push(r);
    r += near + growth * Math.max(0, r - COASTAL_RADIUS);
  }
  radii.push(OUTER_RADIUS);
  return radii;
}

/**
 * Flat in XZ with Y = 0 — the mesh carries no rotation, so `position.xz` in the
 * vertex shader is world XZ directly. That is worth the small oddity of a
 * "plane" geometry that isn't a plane: the old sea had to be rotated -90 degrees
 * about X and then read `position.xy` as a stand-in for world XZ, with a comment
 * explaining the indirection. Here every wavelength in the shader is a real
 * world distance with nothing to reinterpret.
 */
export function buildSeaGeometry(detail: SeaDetail, field: SeaShoreField): THREE.BufferGeometry {
  const spokes = SPOKES[detail];
  const radii = ringRadii(detail);

  // One extra vertex for the centre of the fan.
  const vertexCount = radii.length * spokes + 1;
  const positions = new Float32Array(vertexCount * 3);
  const shore = new Float32Array(vertexCount * 4);

  const write = (index: number, x: number, z: number) => {
    positions[index * 3] = x;
    positions[index * 3 + 2] = z;
    const sample = field.sample(x, z);
    shore[index * 4] = sample.distance;
    shore[index * 4 + 1] = sample.dirX;
    shore[index * 4 + 2] = sample.dirZ;
    shore[index * 4 + 3] = sample.shelf;
  };

  write(0, 0, 0);
  for (let ring = 0; ring < radii.length; ring++) {
    const r = radii[ring];
    for (let spoke = 0; spoke < spokes; spoke++) {
      const theta = (spoke / spokes) * Math.PI * 2;
      write(1 + ring * spokes + spoke, r * Math.cos(theta), r * Math.sin(theta));
    }
  }

  const quadCount = (radii.length - 1) * spokes;
  const indices = new Uint32Array(quadCount * 6 + spokes * 3);
  let cursor = 0;
  for (let spoke = 0; spoke < spokes; spoke++) {
    const next = (spoke + 1) % spokes;
    indices[cursor++] = 0;
    indices[cursor++] = 1 + next;
    indices[cursor++] = 1 + spoke;
  }
  for (let ring = 0; ring < radii.length - 1; ring++) {
    const inner = 1 + ring * spokes;
    const outer = inner + spokes;
    for (let spoke = 0; spoke < spokes; spoke++) {
      // The last spoke indexes back to spoke 0, so the seam shares its vertices
      // outright. Even if it did not, every term in the shader is a function of
      // world position, so the two sides would still agree exactly.
      const next = (spoke + 1) % spokes;
      indices[cursor++] = inner + spoke;
      indices[cursor++] = outer + spoke;
      indices[cursor++] = outer + next;
      indices[cursor++] = inner + spoke;
      indices[cursor++] = outer + next;
      indices[cursor++] = inner + next;
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aShore", new THREE.BufferAttribute(shore, 4));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.computeBoundingSphere();
  // The vertex shader lifts the surface after culling has already been decided,
  // so the sphere has to allow for the swell it does not know about.
  if (geometry.boundingSphere) geometry.boundingSphere.radius += 0.4;
  return geometry;
}
