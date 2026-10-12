import { useCallback, useEffect, useRef, useState } from "react";
import { candleConfig, micIsAvailable } from "./candleConfig";

/**
 * status:
 *   idle         not listening
 *   requesting   permission prompt is on screen
 *   listening    live — the meter is moving and the candles are following it
 *   denied       she said no to the mic (or the browser blocked it)
 *   unsupported  no getUserMedia, no AudioContext, or not a secure context
 *
 * `denied` and `unsupported` mean the candles cannot be blown out at all, and
 * the UI says so plainly rather than working around it.
 */

/**
 * One analyser sample: how loud it is right now, as a fraction of the meter.
 *
 * Deliberately a plain module-scope function that mutates the rig it is
 * handed. The React Compiler treats writes to anything reachable from a hook
 * result inside a callback as render-phase mutation; a plain function's own
 * parameters are not render values, so this is both allowed by the linter and
 * honest about what it is — driving a Web Audio graph, not React state.
 */
function sampleLevel(rig) {
  const { analyser, timeBuf } = rig;

  // Loudness, straight off the raw waveform. There is no noise floor and no
  // calibration window: the meter is this one number over meterFullScaleRms.
  analyser.getFloatTimeDomainData(timeBuf);
  let sum = 0;
  for (let i = 0; i < timeBuf.length; i += 1) sum += timeBuf[i] * timeBuf[i];
  const rms = Math.sqrt(sum / timeBuf.length);

  // Smoothed so the bar reads as a breath rather than a strobe — and so the
  // candle count does not jitter by one every frame on a steady blow.
  const raw = Math.min(1, rms / candleConfig.meterFullScaleRms);
  rig.level =
    rig.level * candleConfig.meterSmoothing + raw * (1 - candleConfig.meterSmoothing);

  return rig.level;
}

/**
 * Blow detection through the microphone.
 *
 *   const { status, start, stop } = useBlowDetection({ onLevel });
 *
 * `start()` must be called from a click/tap handler: iOS Safari will not
 * resume an AudioContext that was not created inside a user gesture, and a
 * permission prompt with no gesture behind it is frequently auto-denied.
 *
 * The level is delivered through `onLevel(level)` on every animation frame
 * rather than through state, because 60 setState calls a second would re-render
 * the whole hero (and with it the three.js scene) for a progress bar. Write the
 * bar straight to a DOM node's style instead, and hand the number to the
 * candles, which are driven the same way.
 *
 * `onLevel` returning true means "every candle is out, we are finished" — the
 * hook then releases the microphone on the spot, so the browser's recording
 * indicator goes off at the end of the blow instead of staying hot through the
 * celebration.
 */
export function useBlowDetection({ onLevel }) {
  const [status, setStatus] = useState("idle");
  const rigRef = useRef(null);
  const onLevelRef = useRef(null);

  // Latest-callback ref, refreshed after every render so the audio loop never
  // closes over a stale handler and never has to be torn down and rebuilt.
  useEffect(() => {
    onLevelRef.current = onLevel;
  });

  const teardown = useCallback(() => {
    const rig = rigRef.current;
    rigRef.current = null;
    if (!rig) return;
    if (rig.raf) cancelAnimationFrame(rig.raf);
    // Stopping the tracks is what turns the browser's recording indicator off.
    // Leaving them live would keep the mic hot after the candles are out.
    if (rig.stream) rig.stream.getTracks().forEach((track) => track.stop());
    if (rig.source) rig.source.disconnect();
    if (rig.analyser) rig.analyser.disconnect();
    if (rig.ctx && rig.ctx.state !== "closed") rig.ctx.close().catch(() => {});
  }, []);

  const stop = useCallback(() => {
    teardown();
    setStatus((current) =>
      current === "denied" || current === "unsupported" ? current : "idle",
    );
  }, [teardown]);

  const start = useCallback(async () => {
    teardown();

    if (!micIsAvailable()) {
      setStatus("unsupported");
      return false;
    }

    setStatus("requesting");

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: candleConfig.audioConstraints,
      });
    } catch {
      // NotAllowedError (she said no), NotFoundError (no mic), NotReadableError
      // (another app owns it). All of them mean: no candles out today.
      setStatus("denied");
      return false;
    }

    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    let ctx;
    try {
      ctx = new AudioCtx();
      // Created inside the click handler, so this is allowed to succeed.
      if (ctx.state === "suspended") await ctx.resume();
    } catch {
      stream.getTracks().forEach((track) => track.stop());
      setStatus("unsupported");
      return false;
    }

    const analyser = ctx.createAnalyser();
    // 2048 samples of the raw waveform, which is all this reads now — there is
    // no frequency analysis and no low-band guard left to configure.
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0; // sampleLevel does its own smoothing

    const source = ctx.createMediaStreamSource(stream);
    source.connect(analyser);
    // Deliberately NOT connected to ctx.destination: that would play her own
    // breath back at her through the speakers and start feedback.

    const rig = {
      stream,
      ctx,
      analyser,
      source,
      timeBuf: new Float32Array(analyser.fftSize),
      level: 0,
      raf: 0,
    };
    rigRef.current = rig;

    const tick = () => {
      const current = rigRef.current;
      if (!current || current !== rig) return; // torn down mid-frame

      const level = sampleLevel(rig);
      const done = onLevelRef.current ? onLevelRef.current(level) === true : false;

      if (done) {
        // Release the microphone before the candles have even finished going
        // out, so the recording indicator is off the moment the wish is made.
        teardown();
        setStatus("idle");
        return; // torn down; do not schedule another frame
      }

      rig.raf = requestAnimationFrame(tick);
    };

    rig.raf = requestAnimationFrame(tick);
    setStatus("listening");
    return true;
  }, [teardown]);

  // Never leave the microphone hot if the component unmounts mid-listen.
  useEffect(() => teardown, [teardown]);

  return { status, start, stop };
}
