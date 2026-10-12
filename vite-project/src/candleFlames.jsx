import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { candleConfig as cfg } from "./candleConfig";
import { ensureCandleStateSize} from "./candleState";
import { heroSceneDebug } from "./heroModels";

/* ------------------------------------------------------------------ *
 * Reading the candles out of the model
 *
 * The positions come from the cached GLTF scene rather than from the clone,
 * because the clone's nodes are React-managed: drei's <Clone> re-renders every
 * node with `visible`, `scale` and `material` copied off the original, so
 * anything set on them by hand can be silently reverted by the next render —
 * and a window resize alone re-renders this scene. Reading the original is
 * synchronous, so it can happen in a useMemo instead of an effect, and the
 * numbers are identical because <Clone> copies transforms verbatim.
 *
 * Kept at module scope for the same reason applyFade is in Hero.jsx: it walks
 * an object that came out of a hook, and a plain function's parameters are not
 * render values.
 * ------------------------------------------------------------------ */
function discoverCandles(scene, pattern) {
  const matcher = new RegExp(pattern);
  const inverseRoot = new THREE.Matrix4();
  const local = new THREE.Matrix4();
  const found = [];

  scene.updateWorldMatrix(true, true);
  inverseRoot.copy(scene.matrixWorld).invert();

  scene.traverse((node) => {
    if (!matcher.test(node.name || "")) return;
    local.multiplyMatrices(inverseRoot, node.matrixWorld);
    found.push({
      name: node.name,
      position: new THREE.Vector3().setFromMatrixPosition(local),
    });
  });

  // The cake turns, so ordering the cascade by angle around the ring makes it
  // travel round the cake instead of jumping about at random.
  found.sort(
    (a, b) =>
      Math.atan2(a.position.z, a.position.x) - Math.atan2(b.position.z, b.position.x),
  );

  return found;
}

/**
 * Hide the model's own baked flame cones. They are replaced by the ones drawn
 * here, which can be lit, flickered and extinguished individually.
 *
 * This touches one property on one material that nothing in React manages —
 * <Clone> copies the material by reference, it never sets its properties — so
 * unlike `visible` on a node, this cannot be written back by a re-render.
 */
function hideBakedFlames(scene, materialName) {
  const touched = [];
  scene.traverse((node) => {
    if (!node.isMesh || !node.material) return;
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
      if (material.name !== materialName || touched.includes(material)) continue;
      touched.push(material);
      material.userData.candleHidden = material.visible;
      material.visible = false;
    }
  });
  return touched;
}

function restoreBakedFlames(materials) {
  for (const material of materials) {
    if (material.userData.candleHidden === undefined) continue;
    material.visible = material.userData.candleHidden;
    delete material.userData.candleHidden;
  }
}

/* ------------------------------------------------------------------ *
 * Flicker
 *
 * Three sine waves at mutually unrelated speeds. One wave looks like a
 * metronome, two look like a pulse, three at unrelated rates read as air.
 * Each candle gets its own phase offset so they never sync up.
 * ------------------------------------------------------------------ */
function brightnessAt(elapsed, phase) {
  const noise =
    Math.sin(elapsed * cfg.flickerSpeed + phase) * 0.5 +
    Math.sin(elapsed * cfg.flickerSecondSpeed + phase * 1.7) * 0.3 +
    Math.sin(elapsed * cfg.flickerSpeed * 0.37 + phase * 2.3) * 0.2;
  return 1 + noise * cfg.flickerAmount * 0.5;
}

function sizeAt(elapsed, phase) {
  const noise =
    Math.sin(elapsed * cfg.flickerSpeed * 1.31 + phase * 2.1) * 0.6 +
    Math.sin(elapsed * cfg.flickerSecondSpeed * 0.83 + phase) * 0.4;
  return 1 + noise * cfg.flickerScaleAmount;
}

/**
 * How far through going out one candle is: 0 = burning, 1 = out.
 *
 * Two ways in. A blow starts a cascade where each candle follows the last
 * after cascadeStepMs; a tap takes just that one candle out on its own clock.
 * Whichever started later wins, so tapping after a blow still works.
 */
/**
 * How far through going out one candle is: 0 = burning, 1 = out.
 *
 * Two ways in: a blow starts a cascade where each candle follows the last
 * after cascadeStepMs, and a tap takes just that one candle out on its own
 * clock.
 *
 * Each trigger is timed independently and the results are MAXed, which makes
 * the progress monotonic — it can only ever go up until relightCandles resets
 * it. Picking the latest trigger instead, as this originally did, meant a tap
 * on a candle that was already out restarted its fade from zero, and zero is
 * "fully lit": the flame popped back into existence for 340ms and then died
 * again. The max also gives the useful behaviour for free that a tap during
 * the cascade takes effect immediately rather than waiting its turn.
 */
/**
 * How far through going out one candle is: 0 = burning, 1 = out.
 *
 * Blowing into the microphone is the only trigger. Each candle follows the
 * last after cascadeStepMs, so the cascade travels round the ring, and the
 * whole thing is monotonic within a cycle: blowOutAllCandles refuses to move
 * blowStart unless every candle is lit, so progress can never run backwards
 * and flash a dead flame back to life. relightCandles is the only reset.
 */
function outProgressAt(state, index, now) {
  if (state.blowStart < 0) return 0;

  const started = state.blowStart + index * cfg.cascadeStepMs;
  if (now < started) return 0;

  return Math.min(1, (now - started) / cfg.flameFadeMs);
}

/**
 * The whole per-frame update.
 *
 * Module scope, parameters in, for the same reason as everything else here: it
 * writes to three.js objects reachable from hook results, and the React
 * Compiler analyses a useFrame callback as though it ran during render.
 */
function updateCandles(rig, state, elapsed, now, reducedMotion, lightRatio, onExtinguished) {
  let allOut = true;

  for (let i = 0; i < rig.candles.length; i += 1) {
    const candle = rig.candles[i];
    const out = outProgressAt(state, i, now);
    const alive = 1 - out;
    if (alive > 0.001) allOut = false;

    const brightness = reducedMotion ? 1 : brightnessAt(elapsed, candle.phase);
    const wobble = reducedMotion ? 1 : sizeAt(elapsed, candle.phase);

    // Pinch out: height collapses faster than width, which is what a flame
    // actually does when its vapour supply is cut off.
    const width = Math.max(0.0001, alive * wobble);
    candle.flame.scale.set(width, Math.max(0.0001, alive * alive * wobble), width);
    candle.flame.visible = alive > 0.001;

    candle.coreMat.opacity = alive;
    candle.midMat.opacity = Math.min(1, alive * 0.9 * brightness);
    candle.haloMat.opacity = alive * 0.5 * brightness;

    // lightDistance is in WORLD units but this whole rig sits inside the stage
    // group, which heroFit scales down to as little as 0.4 on a phone. Light
    // falloff is 1/d², so leaving it alone would make the candles roughly six
    // times harsher on a phone than on a desktop. Scaling distance by k and
    // intensity by k² cancels exactly: at a point k times closer, k²I/(kd)² is
    // still I/d². So the glow reads the same on every screen.
    if (candle.light) {
      candle.light.distance = cfg.lightDistance * lightRatio;
      candle.light.intensity =
        cfg.lightIntensity * lightRatio * lightRatio * alive * brightness;
    }

    // A wisp off the wick, clocked from the moment the flame finished dying.
    // Lives OUTSIDE the scaling group, or it would be squashed to nothing by
    // the same pinch that just removed the flame.
    const sinceOut = state.lastOutAt[i];
    const smokeT =
      !reducedMotion && out >= 1 && typeof sinceOut === "number" && sinceOut > 0
        ? Math.min(1, (now - sinceOut) / cfg.smokeMs)
        : 1;

    if (smokeT < 1 && candle.smoke) {
      candle.smoke.visible = true;
      candle.smoke.position.y = cfg.flameHeight * 0.4 + smokeT * cfg.smokeRise;
      const spread = 1 + smokeT * 1.6;
      candle.smoke.scale.set(spread, 1 + smokeT * 0.8, spread);
      candle.smokeMat.opacity = cfg.smokeOpacity * (1 - smokeT);
    } else if (candle.smoke) {
      candle.smoke.visible = false;
      candle.smokeMat.opacity = 0;
    }

    if (out >= 1 && !(state.lastOutAt[i] > 0)) state.lastOutAt[i] = now;
    if (out < 1) state.lastOutAt[i] = -1;
        // Recorded so the mutators in candleState.js can refuse to restart a
    // candle that has already finished going out.
    if (out >= 1) state.out[i] = true;
  }

  if (allOut && !state.extinguishedReported && rig.candles.length > 0) {
    state.extinguishedReported = true;
    if (onExtinguished) onExtinguished();
  }
}

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ------------------------------------------------------------------ *
 * The candle rig
 *
 * Rendered as a CHILD of <Clone>, which drei appends to the cloned root node.
 * That is the whole trick: everything here inherits the cake's scale of 7, its
 * rotation, <Center>'s offset and the spin group for free, and stays glued to
 * the right candle as the cake turns.
 *
 * It is also why the hero's tuned framing does not move. <Center> recentres on
 * its subtree's bounding box, and the model's own bbox already spans y 0 to
 * 0.06 with the flame tips at 0.054 and a radius of 0.03. Flames, tap targets
 * and smoke all stay inside that box, so the measured bbox — and therefore the
 * centring offset — is exactly what it was before.
 * ------------------------------------------------------------------ */
function CandleFlames({ scene, state, onExtinguished, stageScale = 1 }) {
  const candles = useMemo(() => discoverCandles(scene, cfg.flameNodePattern), [scene]);

  const rigRef = useRef(null);
  const flameRefs = useRef([]);
  const smokeRefs = useRef([]);
  const lightRefs = useRef([]);

  // One material set per candle, created here rather than as JSX props: R3F
  // would otherwise re-apply whatever it was given and fight the per-frame
  // opacity writes. Disposed on unmount because three.js materials hold GL
  // programs.
  const materials = useMemo(
    () =>
      candles.map(() => ({
        core: new THREE.MeshBasicMaterial({
          color: new THREE.Color(cfg.coreColor),
          transparent: true,
          opacity: 1,
          depthWrite: false,
          toneMapped: false,
          side: THREE.DoubleSide,
        }),
        mid: new THREE.MeshBasicMaterial({
          color: new THREE.Color(cfg.midColor),
          transparent: true,
          opacity: 0.9,
          depthWrite: false,
          toneMapped: false,
          side: THREE.DoubleSide,
        }),
        halo: new THREE.MeshBasicMaterial({
          color: new THREE.Color(cfg.haloColor),
          transparent: true,
          opacity: 0.5,
          depthWrite: false,
          toneMapped: false,
          blending: THREE.AdditiveBlending,
          side: THREE.DoubleSide,
        }),
        smoke: new THREE.MeshBasicMaterial({
          color: new THREE.Color("#d8d2cf"),
          transparent: true,
          opacity: 0,
          depthWrite: false,
        }),
      })),
    [candles],
  );

  useEffect(
    () => () => {
      for (const set of materials) {
        set.core.dispose();
        set.mid.dispose();
        set.halo.dispose();
        set.smoke.dispose();
      }
    },
    [materials],
  );

  // The rig holds material references, so it has to be rebuilt if they change.
  useEffect(() => {
    rigRef.current = null;
  }, [materials]);

  useEffect(() => {
    const hidden = hideBakedFlames(scene, cfg.flameMaterialName);
    if (heroSceneDebug) {
      console.info(
        `[candles] ${candles.length} flame nodes matched /${cfg.flameNodePattern}/, ` +
          `${hidden.length} baked flame material(s) hidden`,
      );
      candles.forEach((candle, i) =>
        console.info(
          `[candles]   ${i}: ${candle.name} at x ${candle.position.x.toFixed(4)}, ` +
            `y ${candle.position.y.toFixed(4)}, z ${candle.position.z.toFixed(4)}`,
        ),
      );
    }
    // A hot reload or an unmount must not leave the shared GLTF cache with its
    // flames switched off for whoever mounts next.
    return () => restoreBakedFlames(hidden);
  }, [candles, scene]);

  useFrame(({ clock }) => {
    // The state object is created in Hero before the model has loaded, so it
    // cannot know how many candles this particular cake turned out to have.
    ensureCandleStateSize(state, candles.length);

    if (!rigRef.current || rigRef.current.count !== candles.length) {
      const built = [];
      for (let i = 0; i < candles.length; i += 1) {
        const flame = flameRefs.current[i];
        const smoke = smokeRefs.current[i];
        // Refs settle during commit; on the very first frame they may not be
        // there yet, in which case try again next frame rather than half-build.
        if (!flame || !smoke) return;
        built.push({
          flame,
          smoke,
          coreMat: materials[i].core,
          midMat: materials[i].mid,
          haloMat: materials[i].halo,
          smokeMat: materials[i].smoke,
          light: lightRefs.current[i] || null,
          // Spread the phases round the circle so neighbours differ.
          phase: (i / Math.max(1, candles.length)) * Math.PI * 2,
        });
      }
      rigRef.current = { candles: built, count: candles.length };
    }

    updateCandles(
      rigRef.current,
      state,
      clock.getElapsedTime(),
      performance.now(),
      prefersReducedMotion(),
      // heroFit shrinks the whole stage on narrow screens; the candle lights
      // have to shrink with it or their 1/d² falloff gets harsher the smaller
      // the cake is. The config's numbers are authored for stageScale 1.
      stageScale || 1,
      onExtinguished,
    );
  });

  if (candles.length === 0) return null;


  return (
    <group>
      {candles.map((candle, index) => {
        const hasLight = index % cfg.lightEveryCandle === 0;
        const position = candle.position.toArray();

        return (
          // Outer group holds the position only. Everything that must NOT be
          // squashed by the pinch-out animation lives here, and only the inner
          // flame group scales.
          <group key={candle.name} position={position}>
            <group
              ref={(element) => {
                flameRefs.current[index] = element;
              }}
            >
              {/* Bright core */}
              <mesh
                material={materials[index].core}
                position={[0, cfg.flameHeight / 2, 0]}
                renderOrder={3}
              >
                <coneGeometry args={[cfg.flameRadius, cfg.flameHeight, 10]} />
              </mesh>

              {/* Orange body */}
              <mesh
                material={materials[index].mid}
                position={[0, (cfg.flameHeight * cfg.midScale) / 2, 0]}
                scale={cfg.midScale}
                renderOrder={2}
              >
                <coneGeometry args={[cfg.flameRadius, cfg.flameHeight, 10]} />
              </mesh>

              {/* Additive halo — this is what stops the flame reading as a
                  solid orange traffic cone. */}
              <mesh
                material={materials[index].halo}
                position={[0, (cfg.flameHeight * cfg.haloScale) / 2, 0]}
                scale={cfg.haloScale}
                renderOrder={1}
              >
                <coneGeometry args={[cfg.flameRadius, cfg.flameHeight, 10]} />
              </mesh>
            </group>

            {/* Real light. An emissive material lights nothing else in
                three.js, so without this the flames glow while the icing
                beside them stays flat — which is exactly what makes baked
                flames look pasted on. */}
            {hasLight && (
              <pointLight
                ref={(element) => {
                  lightRefs.current[index] = element;
                }}
                position={[0, cfg.flameHeight + cfg.lightTipOffset, 0]}
                color={cfg.lightColor}
                intensity={cfg.lightIntensity}
                distance={cfg.lightDistance}
                decay={cfg.lightDecay}
              />
            )}

            {/* Smoke wisp */}
            <mesh
              ref={(element) => {
                smokeRefs.current[index] = element;
              }}
              material={materials[index].smoke}
              position={[0, cfg.flameHeight * 0.4, 0]}
              visible={false}
              renderOrder={0}
            >
              <sphereGeometry args={[cfg.flameRadius * 1.2, 8, 8]} />
            </mesh>

          </group>
        );
      })}
    </group>
  );
}

export default CandleFlames;