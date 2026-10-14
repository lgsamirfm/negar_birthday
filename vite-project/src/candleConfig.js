/**
 * ─────────────────────────────────────────────────────────────────────
 *  THE BIRTHDAY CANDLES — every number you might want to change
 * ─────────────────────────────────────────────────────────────────────
 * Your strawberry_cake.glb already contains 8 candles and 8 flames:
 *
 *   pCylinder95 … pCylinder102   purple_wax body + white_wick tip
 *   pCone1 … pCone8              orange_fire  (already emissive, strength 10)
 *
 * So there is no second "blown out" model to make and nothing extra to
 * download. Instead the model's own flame cones are hidden and replaced by
 * ones drawn here, which is what makes three things possible that the baked
 * geometry could never do: they cast real light onto the icing, they flicker,
 * and they can go out one at a time.
 *
 * WHY REPLACE THEM RATHER THAN JUST TOGGLE `visible`?
 * drei's <Clone> re-renders every node with `visible`, `scale` and `material`
 * as props copied off the cached original. Anything set on those nodes by hand
 * can therefore be silently overwritten by the next render — a window resize
 * alone re-renders the scene. Owning the flames outright sidesteps the whole
 * question. The one thing touched on the model itself is a single material
 * property (`orange_fire.visible`), which nothing in React manages, so nothing
 * will ever write it back.
 *
 * ⚠️ THE WORLD IS TINY. The cake is 0.06 units across in the file and scaled
 * by 7 in heroModels.js, so it ends up ~0.42 units wide. Every distance below
 * is in the model's own units unless it says WORLD.
 */

export const candleConfig = {
  /* ---------------------------------------------------------------- *
   * Finding the candles in the model
   *
   * WHICH model gets candles is decided in src/heroModels.js, by
   * `candles: true` on that entry. Nothing here selects a model.
   * ---------------------------------------------------------------- */
  // Node names of the flame cones, matched as a RegExp against node.name.
  // In strawberry_cake.glb this hits pCone1…pCone8 — exactly 8 of 210 nodes,
  // with 0 false positives — and leaves the 8 pCylinder95…102 candles alone.
  flameNodePattern: "^pCone\\d+$",

  // Material the model's own flames use. Hidden once, at mount, so the baked
  // cones do not double up with the ones drawn here.
  flameMaterialName: "orange_fire",

  /* ---------------------------------------------------------------- *
   * Flame shape (model units)
   *
   * The model's own cones are ~0.0018 tall, so these sit at the same scale.
   * ---------------------------------------------------------------- */
  flameHeight: 0.0026,
  flameRadius: 0.00075,
  // Three nested cones, each sized as a multiplier over the core: a white-hot
  // centre, an orange body, and a wide additive glow. Two layers read as a
  // solid cone with a fringe round it; three read as fire.
  midScale: 1.45,
  haloScale: 2.1,
  coreColor: "#fff3c4", // near-white hot centre
  midColor: "#ffb03a", // the body of the flame
  haloColor: "#ff7a18", // outer glow, drawn additively

  /* ---------------------------------------------------------------- *
   * Light — THE part that sells it
   *
   * An emissive material makes the flame look bright but lights nothing else
   * (three.js emissive casts no light), which is why the model looked flat.
   * These are real point lights, so the frosting glows warm near each wick.
   *
   * intensity and distance are the two to tune by eye, and they fight each
   * other: with decay 2 the falloff is 1/d², so a small distance with a high
   * intensity gives a tight hot pool, and a large distance with a low one
   * gives a soft overall glow.
   *   too dim            -> raise lightIntensity (try doubling)
   *   only the top glows -> raise lightDistance
   *   whole cake orange  -> lower lightIntensity or lower lightDistance
   * `distance` is in WORLD units (after the model's scale of 7), `intensity`
   * is candela under three.js's physical lighting.
   * ---------------------------------------------------------------- */
  lightColor: "#ffb45e",
  lightIntensity: 0.022,
  lightDistance: 0.34, // WORLD units — the cake is ~0.42 across
  lightDecay: 2,
  lightTipOffset: 0.0016, // model units above the flame node's origin

  // A light on every candle is 8 extra point lights on top of the scene's
  // existing 4, which is a real cost on a phone. 2 puts a light on every
  // other candle (4 lights) and still lights the whole ring evenly, because
  // the flames themselves go out one by one regardless. Set 1 for all 8.
  lightEveryCandle: 2,

  /* ---------------------------------------------------------------- *
   * Flicker
   *
   * Two sine waves at unrelated speeds, plus a per-candle phase offset so
   * they never pulse in sync — synchronised flicker looks like a strobe.
   * ---------------------------------------------------------------- */
  flickerAmount: 0.38, // 0 = perfectly steady, 1 = guttering in the wind
  flickerSpeed: 7.5,
  flickerSecondSpeed: 13.0,
  flickerScaleAmount: 0.16, // how much the flame itself wobbles in size

  /* ---------------------------------------------------------------- *
   * Blowing out
   * ---------------------------------------------------------------- */
  cascadeStepMs: 90, // gap between each candle going out
  flameFadeMs: 340, // how long one flame takes to shrink away
  smokeMs: 620, // a faint grey wisp rising off the wick afterwards
  smokeRise: 0.004, // model units the wisp travels
  smokeOpacity: 0.28,

  /* ---------------------------------------------------------------- *
   * Microphone — blow detection
   *
   * The whole rule: the meter is above half for more than two seconds, and
   * the candles go out. No room calibration, no noise floor, nothing to wait
   * for, no status message about it.
   *
   * The meter is simply the incoming loudness divided by meterFullScaleRms,
   * so that ONE number is all there is to tune:
   *   meter barely moves when she blows -> lower it (try 0.10)
   *   meter is full when she just talks -> raise it (try 0.22)
   * Mic gain varies a lot between devices, and autoGainControl is off (see
   * below), so expect to nudge this once on the real hardware.
   * ---------------------------------------------------------------- */
  // These three MUST stay false. Echo cancellation, noise suppression and
  // auto gain control exist to remove steady broadband noise — which is
  // precisely what a blow is. With them on, the browser deletes the blow
  // before the analyser ever sees it, and detection silently never fires.
  audioConstraints: {
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false,
  },

  meterFullScaleRms: 0.15, // loudness that fills the meter completely
  blowLevelThreshold: 0.5, // meter must be above this fraction…
  blowSustainMs: 1500, // …for this long. Two seconds is a real breath;
  // drop it to ~1200 if it feels like a chore.
  blowCooldownMs: 900, // ignore further blows for this long afterwards
  meterSmoothing: 0.72, // 0 = jumpy, 0.9 = very laggy

  // When the meter drops back below half, the two-second hold drains this many
  // times faster than it filled. 2 forgives a single ragged frame or a tiny
  // gap; it will NOT forgive someone who puffs rhythmically instead of blowing
  // one continuous breath — they drain as fast as they fill and never reach
  // two seconds. If she struggles, drop this to 0.5 (a dip then costs only a
  // quarter of its own length) or to 0 to make the hold never drain at all.
  holdDecayRate: 2,

  // Optional extra guard, OFF by default. A blow is a broadband rush of air
  // with its energy piled up below ~500 Hz, while shouting and clapping put
  // plenty above it. If the candles start going out while people are talking
  // and laughing over the top of her, set this to true and the detector will
  // additionally require most of the energy to be in the low band.
  requireLowBand: false,
  blowLowBandHz: 500,
  blowLowRatio: 0.55,
};

/**
 * True when this browser can do microphone blow detection at all.
 * getUserMedia is restricted to secure contexts, so a plain http:// deploy
 * will fail here and the tap/button fallbacks take over. localhost counts as
 * secure, which is why it works in development.
 */
export function micIsAvailable() {
  if (typeof navigator === "undefined") return false;
  const secure = typeof window !== "undefined" && window.isSecureContext;
  return Boolean(
    secure &&
      navigator.mediaDevices &&
      typeof navigator.mediaDevices.getUserMedia === "function" &&
      (typeof window !== "undefined") &&
      (window.AudioContext || window.webkitAudioContext),
  );
}