import { useMemo } from "react";
import * as THREE from "three";
import type { MapScatter } from "../../utils/useMapScatter";
import { ScatteredInstances } from "./ScatteredInstances";

/**
 * Granite boulders. Sri Lanka's dry zone is scattered with them — the same
 * ancient gneiss that Sigiriya and Pidurangala are single enormous lumps of — and
 * the terrain data's flat northern plain reads as empty without any.
 *
 * Placed by the shared scatter (src/data/habitats.ts puts them in the dry zone and
 * along the high terrace edges), rendered as one InstancedMesh.
 */

// A rust-warm grey rather than a brown: SigiriyaRock.tsx documents learning that
// anything in the terrain's own olive-brown family disappears against the
// hillside, and these are the same rock as that monolith.
const ROCK_COLOR = new THREE.Color("#9a8577");
const ROCK_COLOR_WARM = new THREE.Color("#a8776a");

/**
 * A single faceted lump. An icosahedron squashed unevenly on all three axes gives
 * every instance a different silhouette once the scatter's own rotation and scale
 * are applied on top — a sphere would need far more segments to look like stone,
 * and would still look like a ball.
 */
function buildBoulderGeometry(): THREE.BufferGeometry {
  const rock = new THREE.IcosahedronGeometry(0.032, 0);
  rock.scale(1.2, 0.72, 0.95);
  // Sunk slightly, so boulders look bedded into the ground rather than set on it.
  rock.translate(0, 0.014, 0);
  return rock;
}

export function Boulders({ scatter }: { scatter: MapScatter }) {
  const geometry = useMemo(buildBoulderGeometry, []);

  return (
    <ScatteredInstances
      items={scatter.boulder}
      geometry={geometry}
      colorA={ROCK_COLOR}
      colorB={ROCK_COLOR_WARM}
      roughness={0.95}
      maxTilt={0.3}
    />
  );
}
