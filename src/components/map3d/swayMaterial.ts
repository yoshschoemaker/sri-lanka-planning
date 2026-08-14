import * as THREE from "three";

/**
 * A lit standard material whose vertices lean back and forth in a slow, gusty
 * breeze — for the instanced vegetation, where hundreds of plants have to move
 * without costing anything per frame.
 *
 * ## Why a shader patch rather than moving the instances
 *
 * The obvious approach is to rewrite each instance's matrix in a useFrame, the way
 * PalmTree.tsx rotates its crown group. That works for three hand-placed palms and
 * falls apart at several hundred: every frame would rewrite and re-upload the
 * whole instance matrix buffer for every species. Doing it in the vertex shader
 * instead costs one uniform write per species per frame and nothing else — the
 * GPU was going to transform those vertices anyway.
 *
 * ## Why onBeforeCompile rather than drei's shaderMaterial
 *
 * The scene's convention (see RouteLine3D.tsx) is to write whole custom materials
 * with drei's shaderMaterial. That's right when the material's shading is entirely
 * its own, like the water. Here the shading must stay exactly meshStandardMaterial:
 * the vegetation has to receive the same hemisphere/key/fill lighting and the same
 * day/night blend as everything else it stands next to, and reimplementing all of
 * that by hand to add four lines of vertex displacement would be a bad trade.
 * Patching the standard shader is what three's onBeforeCompile hook is for.
 *
 * ## The motion
 *
 * Displacement scales with a vertex's own height above the geometry's origin, so
 * the base stays planted and only the crown travels — a tree bending, not a tree
 * sliding. Every geometry in Vegetation.tsx is authored with its base at y≈0,
 * which is what makes that work.
 *
 * A second, much slower wave modulates the amplitude so the breeze arrives in
 * gusts and mostly isn't there: the brief was movement that happens *sometimes*,
 * and continuous swaying across an entire island reads as restless rather than
 * alive. The phase comes from each instance's own world position, so a gust rolls
 * across a hillside instead of every plant twitching in unison.
 */

export interface SwayUniforms {
  uSwayTime: { value: number };
  uSwayAmplitude: { value: number };
  uSwaySpeed: { value: number };
}

export interface SwayMaterial extends THREE.MeshStandardMaterial {
  userData: { sway: SwayUniforms };
}

/**
 * `amplitude` is world units of horizontal travel at one unit of height — so with
 * a 0.3-unit-tall tree, 0.05 moves its crown by at most ~0.015. Kept in these
 * terms rather than as a raw factor so tall palms and low scrub can share one
 * number and still move plausibly relative to each other.
 */
export function createSwayMaterial({
  amplitude,
  speed,
  roughness,
  vertexColors,
}: {
  amplitude: number;
  speed: number;
  roughness: number;
  vertexColors: boolean;
}): SwayMaterial {
  const material = new THREE.MeshStandardMaterial({ roughness, flatShading: true, vertexColors }) as SwayMaterial;

  const uniforms: SwayUniforms = {
    uSwayTime: { value: 0 },
    uSwayAmplitude: { value: amplitude },
    uSwaySpeed: { value: speed },
  };
  material.userData = { sway: uniforms };

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uSwayTime = uniforms.uSwayTime;
    shader.uniforms.uSwayAmplitude = uniforms.uSwayAmplitude;
    shader.uniforms.uSwaySpeed = uniforms.uSwaySpeed;

    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        /* glsl */ `
        #include <common>
        uniform float uSwayTime;
        uniform float uSwayAmplitude;
        uniform float uSwaySpeed;
        `,
      )
      // begin_vertex is where three declares `vec3 transformed = vec3( position )`,
      // before instancing and the model-view matrix are applied — so nudging it
      // here displaces in the geometry's own local space, and the instance's
      // rotation then turns that into a different direction per plant for free.
      .replace(
        "#include <begin_vertex>",
        /* glsl */ `
        #include <begin_vertex>

        #ifdef USE_INSTANCING
          vec2 swayOrigin = vec2(instanceMatrix[3].x, instanceMatrix[3].z);
        #else
          vec2 swayOrigin = vec2(0.0);
        #endif

        // Phase from world position: a gust rolls across a hillside rather than
        // every plant moving in lockstep.
        float swayPhase = swayOrigin.x * 3.7 + swayOrigin.y * 2.9;

        // Gust envelope. Cubed so it sits near zero most of the time and only
        // occasionally builds — "sometimes", not a permanent wind.
        float gust = sin(uSwayTime * 0.13 + swayPhase * 0.31) * 0.5 + 0.5;
        gust = 0.12 + 0.88 * gust * gust * gust;

        // Scaled by height above the geometry's own base, so the plant bends
        // instead of sliding.
        float swayReach = max(transformed.y, 0.0) * uSwayAmplitude * gust;

        transformed.x += sin(uSwayTime * uSwaySpeed + swayPhase) * swayReach;
        transformed.z += sin(uSwayTime * uSwaySpeed * 0.81 + swayPhase * 1.4) * swayReach * 0.7;
        `,
      );
  };

  // Without this, three's program cache would hand two sway materials the same
  // compiled program as any other standard material with matching parameters,
  // since the cache key doesn't know about onBeforeCompile's edits.
  material.customProgramCacheKey = () => `sway-${vertexColors ? "vc" : "plain"}`;

  return material;
}
