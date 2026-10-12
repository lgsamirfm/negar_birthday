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
   *
   * There is no stagger between candles any more: the meter picks them off one
   * at a time as it rises, so the "cascade" is her own breath. These two are
   * how long a single flame takes to change its mind in each direction.
   * ---------------------------------------------------------------- */
  flameFadeMs: 340, // how long one flame takes to shrink away
  relightMs: 260, // …and to catch again when the bar falls back
  smokeMs: 620, // a faint grey wisp rising off the wick afterwards
  smokeRise: 0.004, // model units the wisp travels
  smokeOpacity: 0.28,

  /* ---------------------------------------------------------------- *
   * Microphone — blow detection
   *
   * The whole rule: the meter IS the candles. Half a bar means half of them
   * are out; a full bar means all of them are, and that is the moment it stops
   * being reversible. Let the bar fall before then and they come back.
   *
   * The meter is simply the incoming loudness divided by meterFullScaleRms,
   * so that ONE number is all there is to tune:
   *   meter barely moves when she blows -> lower it (try 0.10)
   *   meter is full when she just talks -> raise it (try 0.22)
   * Mic gain varies a lot between devices, and autoGainControl is off (see
   * below), so expect to nudge this once on the real hardware.
   *
   * ⚠️ Because the mapping is direct, anything loud enough to move the bar
   * moves the candles: at the default 0.15, ordinary talking (RMS ~0.05) sits
   * around a third of the bar and will gutter three of the eight. That is
   * harmless now — they come straight back when the noise stops, and only a
   * sustained level above ~0.94 can finish the job — but if the room is loud,
   * raising meterFullScaleRms is the one knob that fixes it.
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
  // 0 = jumpy, 0.9 = very laggy. This one is doing more work than it looks:
  // it smooths the bar AND the candle count, so a value that is too low makes
  // the last candle flicker in and out on a steady breath.
  meterSmoothing: 0.82,

  // How far the bar has to fall before a candle that has just gone out is
  // allowed to come back, as a fraction of one candle's share of the meter
  // (1/8 of the bar here). Without this deadband, a level sitting exactly on a
  // boundary puts the same candle out and relights it every frame. 0.4 leaves
  // candle one coming back at ~1% of the bar, so "the bar goes down to zero,
  // they all relight" still reads as true. Raise it if they still flicker.
  candleHysteresis: 0.4,
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
