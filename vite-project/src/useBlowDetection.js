import { useCallback, useEffect, useRef, useState } from "react";
import { candleConfig, micIsAvailable } from "./candleConfig";

/**
 * status:
 *   idle         not listening
 *   requesting   permission prompt is on screen
 *   listening    live — the meter is moving and a blow will register
 *   denied       she said no to the mic (or the browser blocked it)
 *   unsupported  no getUserMedia, no AudioContext, or not a secure context
 *
 * `denied` and `unsupported` are the signal to show the tap/button fallbacks.
 */

/**
 * One analyser sample.
 *
 * Deliberately a plain module-scope function that mutates the rig it is
 * handed. The React Compiler treats writes to anything reachable from a hook
 * result inside a callback as render-phase mutation; a plain function's own
 * parameters are not render values, so this is both allowed by the linter and
 * honest about what it is — driving a Web Audio graph, not React state.
 */
function sampleBlow(rig, nowMs, deltaMs) {
  const { analyser, timeBuf, freqBuf, ctx } = rig;
  const cfg = candleConfig;

  // Loudness, straight off the raw waveform. There is no noise floor and no
  // calibration window: the meter is this one number over meterFullScaleRms.
  analyser.getFloatTimeDomainData(timeBuf);
  let sum = 0;
  for (let i = 0; i < timeBuf.length; i += 1) sum += timeBuf[i] * timeBuf[i];
  const rms = Math.sqrt(sum / timeBuf.length);

  // Smoothed so the bar reads as a breath rather than a strobe.
  const raw = Math.min(1, rms / cfg.meterFullScaleRms);
  rig.level = rig.level * cfg.meterSmoothing + raw * (1 - cfg.meterSmoothing);

  // Optional guard, off by default — see requireLowBand in candleConfig.js.
  // A blow piles its energy up below ~500 Hz; a clap or a shout does not.
  let lowRatio = 1;
  if (cfg.requireLowBand) {
    analyser.getByteFrequencyData(freqBuf);
    const binHz = ctx.sampleRate / 2 / freqBuf.length;
    const cut = Math.max(1, Math.round(cfg.blowLowBandHz / binHz));
    let low = 0;
    let high = 0;
    for (let i = 0; i < freqBuf.length; i += 1) {
      if (i < cut) low += freqBuf[i];
      else high += freqBuf[i];
    }
    lowRatio = low / Math.max(1, low + high);
  }

  const blowing = rig.level > cfg.blowLevelThreshold && lowRatio > cfg.blowLowRatio;

  // Held, not instantaneous. The hold drains rather than resetting to zero, so
  // a breath that dips for a frame does not throw away two seconds of blowing —
  // it just costs a little. holdDecayRate sets how much; see candleConfig.js.
  if (blowing) rig.held += deltaMs;
  else rig.held = Math.max(0, rig.held - deltaMs * cfg.holdDecayRate);

  let blew = false;
  if (rig.held >= cfg.blowSustainMs && nowMs >= rig.cooldownUntil) {
    blew = true;
    rig.held = 0;
    rig.cooldownUntil = nowMs + cfg.blowCooldownMs;
  }

  return {
    level: rig.level,
    hold: Math.min(1, rig.held / cfg.blowSustainMs),
    blew,
    rms,
    lowRatio,
  };
}

/**
 * Blow detection through the microphone.
 *
 *   const { status, start, stop } = useBlowDetection({ onBlow, onLevel });
 *
 * `start()` must be called from a click/tap handler: iOS Safari will not
 * resume an AudioContext that was not created inside a user gesture, and a
 * permission prompt with no gesture behind it is frequently auto-denied.
 *
 * The meter is delivered through `onLevel(level, hold)` on every animation
 * frame rather than through state, because 60 setState calls a second would
 * re-render the whole hero (and with it the three.js scene) for a progress
 * bar. Write both straight to DOM nodes' styles instead. `hold` is how far
 * through the two seconds she is, which is what stops a 2-second requirement
 * feeling broken — the meter is full and nothing is happening.
 */
export function useBlowDetection({ onBlow, onLevel }) {
  const [status, setStatus] = useState("idle");
  const rigRef = useRef(null);
  const onBlowRef = useRef(null);
  const onLevelRef = useRef(null);

  // Latest-callback refs, refreshed after every render so the audio loop never
  // closes over a stale handler and never has to be torn down and rebuilt.
  useEffect(() => {
    onBlowRef.current = onBlow;
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
      // (another app owns it). All of them mean: fall back to tapping.
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
    // 2048 gives ~21 Hz per bin at 44.1 kHz, which is fine enough to separate
    // "energy below 500 Hz" from "energy above it". smoothingTimeConstant 0
    // because sampleBlow does its own smoothing.
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0;

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
      freqBuf: new Uint8Array(analyser.frequencyBinCount),
      lastNow: performance.now(),
      held: 0,
      level: 0,
      cooldownUntil: 0,
      raf: 0,
    };
    rigRef.current = rig;

    const tick = (nowMs) => {
      const current = rigRef.current;
      if (!current || current !== rig) return; // torn down mid-frame

      const deltaMs = Math.min(64, nowMs - rig.lastNow); // clamp tab-switch gaps
      rig.lastNow = nowMs;

      const sample = sampleBlow(rig, nowMs, deltaMs);

      if (onLevelRef.current) onLevelRef.current(sample.level, sample.hold);

      if (sample.blew) {
        // Release the microphone before announcing anything, so the browser's
        // recording indicator goes off the moment the blow lands rather than
        // staying hot through the whole cascade.
        teardown();
        setStatus("idle");
        if (onBlowRef.current) onBlowRef.current();
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