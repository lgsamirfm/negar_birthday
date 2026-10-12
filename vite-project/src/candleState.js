/* ------------------------------------------------------------------ *
 * Shared candle state
 *
 * Created once in Hero and handed to the canvas BY REFERENCE, because React
 * context does not cross into <Canvas> — R3F runs its own reconciler root.
 * Plain props do cross, so that is what carries it.
 *
 * It is a mutable object rather than React state on purpose. The candle
 * animation runs at 60fps inside useFrame; driving it through setState would
 * re-render the hero and the whole three.js scene every frame. Instead
 * useFrame reads this object directly and only the discrete moments (all out,
 * relit) cross back into React.
 *
 * Every write goes through one of the module-scope functions below, and the one
 * read useFrame needs (outProgressAt) lives here beside them so the clock maths
 * exists exactly once. Keeping the writes in plain functions is the same
 * discipline as applyFade in Hero.jsx: the React Compiler analyses a useFrame or
 * event callback as though it ran during render and refuses writes to anything
 * reachable from a hook result, while a plain function's own parameters are not
 * render values.
 *
 * There is exactly ONE way to put the candles out: blow into the microphone.
 * No clicking, no tapping the flames, no button that fakes it. HOW MANY go out
 * is decided by how hard she blows — see applyMeterLevel.
 * ------------------------------------------------------------------ */

import { candleConfig as cfg } from "./candleConfig";

/**
 * @param {number} count how many candles to expect. Only a starting size —
 *   ensureCandleStateSize grows it to match the model once it has loaded,
 *   because Hero cannot know how many flames a given .glb contains.
 */
export function createCandleState(count = 8) {
  return {
    out: new Array(count).fill(false), // the TARGET: is this candle meant to be out?
    // Clocks for the two transitions. null means "not running". They are NOT
    // -1, because a reversal back-dates the clock (see applyMeterLevel) and can
    // legitimately land it before the time origin — a negative sentinel would
    // then be mistaken for "no clock" and snap the flame to its end state.
    outAt: new Array(count).fill(null), // when it started going out
    litAt: new Array(count).fill(null), // when it started coming back
    // 0 = burning, 1 = out, written every frame by CandleFlames. The mutators
    // read it so a reversal mid-fade can carry on from where it had got to.
    progress: new Array(count).fill(0),
    lastOutAt: new Array(count).fill(-1), // when each finished dying, to clock smoke from
    outCount: 0, // how many are targeted out — the baseline hysteresis works from
    locked: false, // every candle out; the meter no longer controls anything
    extinguishedReported: false, // so onExtinguished fires exactly once
  };
}

export function ensureCandleStateSize(state, count) {
  while (state.out.length < count) state.out.push(false);
  while (state.outAt.length < count) state.outAt.push(null);
  while (state.litAt.length < count) state.litAt.push(null);
  while (state.progress.length < count) state.progress.push(0);
  while (state.lastOutAt.length < count) state.lastOutAt.push(-1);
  state.outCount = Math.min(state.outCount, state.out.length);
}

/**
 * How far through going out one candle is: 0 = burning, 1 = out.
 *
 * The meter drives this in both directions, one candle at a time: out over
 * flameFadeMs when applyMeterLevel targets it, and back over relightMs when the
 * level falls again. Whichever clock is set is the one that runs, and the
 * mutators start each new clock from the progress the old one had reached — so
 * a candle caught half way out carries on growing back instead of snapping to
 * full size and shrinking all over again.
 */
export function outProgressAt(state, index, now) {
  if (state.out[index]) {
    const started = state.outAt[index];
    if (started === null) return 1; // targeted out with no clock: already gone
    return Math.min(1, (now - started) / cfg.flameFadeMs);
  }

  const started = state.litAt[index];
  if (started === null) return 0; // never been out
  return Math.max(0, 1 - (now - started) / cfg.relightMs);
}

/**
 * The meter drives the candles directly, in both directions.
 *
 * Half a bar with eight candles means four of them out. Let the bar fall and
 * they come back one by one, so a breath that is not quite strong enough costs
 * nothing — she just has to blow again. They are picked off in the order
 * discoverCandles found them, which is angular order round the ring, so the
 * extinguishing travels round the cake instead of happening at random.
 *
 * Returns true once EVERY candle is out. That is the one irreversible moment:
 * `locked` is set and the level stops mattering, so dropping the bar to zero
 * afterwards cannot undo a completed wish. relightCandles is the only way back.
 */
export function applyMeterLevel(state, level, now = performance.now()) {
  const total = state.out.length;
  if (total === 0) return false;
  if (state.locked) return true;

  const step = 1 / total;
  let count = state.outCount;

  // Candle `count` is the next one to go out, and it goes at half a step into
  // its own slice of the meter — which is what makes level 0.5 mean exactly
  // half the candles. Candle `count - 1` is the last one out, and it only comes
  // back once the level has fallen candleHysteresis of a step below that. The
  // deadband is what stops a steady breath from flickering a boundary candle
  // out and back in every single frame.
  while (count < total && level >= (count + 0.5) * step) count += 1;
  while (count > 0 && level < (count - 0.5 - cfg.candleHysteresis) * step) count -= 1;

  for (let i = 0; i < total; i += 1) {
    const shouldOut = i < count;
    if (shouldOut === state.out[i]) continue;

    // Start the new fade from wherever the old one had reached, so a candle
    // caught half way out simply grows back instead of snapping to full size
    // and then shrinking all over again.
    const progress = state.progress[i] || 0;
    state.out[i] = shouldOut;
    if (shouldOut) {
      state.outAt[i] = now - progress * cfg.flameFadeMs;
      state.litAt[i] = null;
    } else {
      state.litAt[i] = now - (1 - progress) * cfg.relightMs;
      state.outAt[i] = null;
    }
  }

  state.outCount = count;
  if (count === total) state.locked = true;
  return state.locked;
}

/** Light them all again so she can do it once more. */
export function relightCandles(state, now = performance.now()) {
  for (let i = 0; i < state.out.length; i += 1) {
    if (!state.out[i]) continue;
    state.out[i] = false;
    state.outAt[i] = null;
    state.litAt[i] = now - (1 - (state.progress[i] || 0)) * cfg.relightMs;
  }
  state.outCount = 0;
  state.locked = false;
  state.extinguishedReported = false;
}
