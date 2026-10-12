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
 * Every write goes through one of the module-scope functions below. That is
 * the same discipline as applyFade in Hero.jsx: the React Compiler analyses a
 * useFrame or event callback as though it ran during render and refuses writes
 * to anything reachable from a hook result, while a plain function's own
 * parameters are not render values.
 *
 * There is exactly ONE way to put the candles out: blow into the microphone.
 * No clicking, no tapping the flames, no button that fakes it.
 * ------------------------------------------------------------------ */

/**
 * @param {number} count how many candles to expect. Only a starting size —
 *   ensureCandleStateSize grows it to match the model once it has loaded,
 *   because Hero cannot know how many flames a given .glb contains.
 */
export function createCandleState(count = 8) {
  return {
    blowStart: -1, // when the cascade began, or -1 for "still lit"
    lastOutAt: new Array(count).fill(-1), // when each finished dying, to clock smoke from
    out: new Array(count).fill(false), // a candle that is out stays out until relit
    extinguishedReported: false, // so onExtinguished fires exactly once
  };
}

export function ensureCandleStateSize(state, count) {
  while (state.lastOutAt.length < count) state.lastOutAt.push(-1);
  while (state.out.length < count) state.out.push(false);
}

/**
 * One puff: every candle follows the last after cascadeStepMs.
 *
 * Refuses to start unless every candle is lit. A fresh blowStart restarts each
 * fade from zero, and zero means fully lit, so blowing again part way through
 * a cascade — or after one — would flash the flames back into existence and
 * then kill them all over again. The UI cannot reach that state, but the
 * invariant belongs here rather than being left to the caller.
 */
export function blowOutAllCandles(state, now = performance.now()) {
  if (state.out.some(Boolean)) return;
  state.blowStart = now;
  state.extinguishedReported = false;
}

/** Light them all again so she can do it once more. */
export function relightCandles(state) {
  state.blowStart = -1;
  state.lastOutAt.fill(-1);
  state.out.fill(false);
  state.extinguishedReported = false;
}