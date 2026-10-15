import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { galleryVideos } from "./galleryVideos";
import { navigate } from "./useHashRoute";

/* ------------------------------------------------------------------ *
 * Tile states
 *
 * A video request can fail for two completely different reasons, and they
 * need different answers:
 *
 *   MISSING -> the server really has no such file (404, or the SPA's
 *              index.html fallback). Tell the user to add the file.
 *   FAILED  -> the file is there but the request died on the way: a download
 *              manager (IDM and friends) grabbing the media request, an
 *              ad-blocker, the browser's connection limit, a flaky network.
 *              Never claim the file is missing — retry instead.
 * ------------------------------------------------------------------ */
const IDLE = "idle"; // not near the viewport yet, nothing requested
const LOADING = "loading"; // asking the server whether the file is there
const READY = "ready"; // file confirmed present, so it can be opened
const MISSING = "missing"; // confirmed absent on the server
const FAILED = "failed"; // request aborted / blocked -> retryable

// A tile never downloads a video. All it does is ask the server whether the
// file exists — a HEAD request, so headers and not one byte of footage — and
// only when the tile gets near the viewport. The video itself is fetched when
// she actually opens one, by the lightbox.
//
// That distinction is the whole point: with 10 tiles on screen, a <video> in
// each one pulled metadata (and usually a first chunk) for all ten at once,
// which is slow on a phone connection and pointless for the nine she did not
// ask for. Probes are still staggered and still wait for the viewport, because
// a burst of ten requests is what makes download managers pounce.
const PROBE_STAGGER_MS = 120;
const PROBE_STAGGER_MAX = 6;
const MAX_AUTO_RETRIES = 2;
const RETRY_DELAY_MS = 800;

const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const toFa = (value) => String(value).replace(/\d/g, (d) => PERSIAN_DIGITS[Number(d)]);

const stripLeadingSlash = (path) => path.replace(/^\//, "");

/**
 * Ask the server whether the file is actually there.
 * Returns "missing" only on a definitive answer, so an aborted request can
 * never be mistaken for a missing file.
 */
async function probeSource(src) {
  try {
    const response = await fetch(src, { method: "HEAD", cache: "no-store" });

    if (response.status === 404 || response.status === 410) return "missing";

    if (response.ok) {
      const type = response.headers.get("content-type") || "";
      // Vite's dev server (and most static hosts) answer unknown paths with
      // the SPA's index.html and a 200 — that is a missing file, not a video.
      if (type.includes("text/html")) return "missing";
      return "exists";
    }

    // 405 / 5xx / redirect weirdness: inconclusive, so don't blame the file.
    return "unknown";
  } catch {
    return "unknown"; // aborted, offline, blocked -> retryable
  }
}

/* ------------------------------------------------------------------ *
 * Inline icons (no icon dependency, matching the hand-rolled SVGs in Hero)
 * ------------------------------------------------------------------ */
function ArrowLeftIcon({ className = "h-4 w-4" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
    </svg>
  );
}

function PlayIcon({ className = "h-4 w-4" }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 5.14v13.72a1 1 0 001.52.85l11.14-6.86a1 1 0 000-1.7L9.52 4.29A1 1 0 008 5.14z" />
    </svg>
  );
}

function FilmIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3.75 6.75A1.5 1.5 0 015.25 5.25h13.5a1.5 1.5 0 011.5 1.5v10.5a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5V6.75zM3.75 9.75h16.5M3.75 14.25h16.5M8.25 5.25v13.5M15.75 5.25v13.5"
      />
    </svg>
  );
}

function RetryIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
      />
    </svg>
  );
}

function CloseIcon({ className = "h-4 w-4" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function ChevronIcon({ className = "h-5 w-5", direction = "left" }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      viewBox="0 0 24 24"
      style={direction === "right" ? { transform: "scaleX(-1)" } : undefined}
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
    </svg>
  );
}

/* ------------------------------------------------------------------ *
 * Shared surface styling — same recipe as the wish cards on the home page
 * ------------------------------------------------------------------ */
const CARD_SURFACE =
  "bg-white/70 backdrop-blur-md border border-rose-100/60 shadow-[0_4px_20px_-4px_rgba(244,63,94,0.06)]";

const SOFT_GRADIENT = "bg-gradient-to-br from-purple-100/70 via-rose-50/80 to-amber-100/70";

/* ------------------------------------------------------------------ *
 * One grid tile
 * ------------------------------------------------------------------ */
function VideoTile({ video, index, total, status, onStatus, onOpen }) {
  // Bumped to re-run the probe below. There is no cache-busting URL to change
  // any more, so the number exists purely to re-trigger the effect.
  const [attempt, setAttempt] = useState(0);
  const [posterFailed, setPosterFailed] = useState(false);
  const tileRef = useRef(null);
  const attemptsRef = useRef(0);
  const statusRef = useRef(IDLE);
  const timersRef = useRef([]);
  const aliveRef = useRef(true);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((timer) => window.clearTimeout(timer));
    timersRef.current = [];
  }, []);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      clearTimers();
    };
  }, [clearTimers]);

  const settle = useCallback(
    (next) => {
      if (!aliveRef.current) return;
      statusRef.current = next;
      onStatus(index, next);
    },
    [index, onStatus],
  );

  // Kick off a re-attempt: bumping the attempt number re-runs the probe effect
  // below, which is a genuinely fresh request (it is sent with cache: no-store).
  const reload = useCallback(
    (delay) => {
      if (!aliveRef.current) return;

      const start = () => {
        if (!aliveRef.current) return;
        setAttempt((current) => current + 1);
        settle(LOADING);
      };

      if (delay > 0) {
        const timer = window.setTimeout(start, delay);
        timersRef.current.push(timer);
      } else {
        start();
      }
    },
    [settle],
  );

  // Only ask about the file once the tile is close to the viewport, and
  // stagger the probes so they never arrive in one burst.
  useEffect(() => {
    if (status !== IDLE) return undefined;

    const delay = Math.min(index, PROBE_STAGGER_MAX) * PROBE_STAGGER_MS;

    if (typeof IntersectionObserver === "undefined") {
      const timer = window.setTimeout(() => settle(LOADING), delay);
      timersRef.current.push(timer);
      return () => window.clearTimeout(timer);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.some((entry) => entry.isIntersecting);
        if (!visible) return;
        observer.disconnect();
        const timer = window.setTimeout(() => settle(LOADING), delay);
        timersRef.current.push(timer);
      },
      { rootMargin: "250px 0px", threshold: 0.01 },
    );

    if (tileRef.current) observer.observe(tileRef.current);

    return () => observer.disconnect();
  }, [index, settle, status]);

  // Ask the server whether the file is there. Headers only — this request
  // carries no video data, which is the entire point of the exercise.
  useEffect(() => {
    if (status !== LOADING) return undefined;

    let cancelled = false;

    (async () => {
      const verdict = await probeSource(video.src);
      if (cancelled || !aliveRef.current) return;

      if (verdict === "exists") {
        attemptsRef.current = 0;
        settle(READY);
        return;
      }

      if (verdict === "missing") {
        settle(MISSING);
        return;
      }

      // Inconclusive — an aborted or blocked request, which is not the same as
      // a missing file. Retry a couple of times before offering a manual one.
      if (attemptsRef.current < MAX_AUTO_RETRIES) {
        attemptsRef.current += 1;
        reload(RETRY_DELAY_MS);
        return;
      }

      settle(FAILED);
    })();

    return () => {
      cancelled = true;
    };
  }, [attempt, reload, settle, status, video.src]);

  const handleRetryClick = useCallback(() => {
    attemptsRef.current = 0;
    statusRef.current = LOADING;
    clearTimers();
    reload(0);
  }, [clearTimers, reload]);

  const isOpenable = status === READY;
  const isRetrying = status === FAILED;

  const label = isOpenable
    ? `پخش ${video.title}`
    : isRetrying
      ? `${video.title} — برای تلاش دوباره کلیک کن`
      : status === MISSING
        ? `${video.title} — هنوز ویدیویی اضافه نشده`
        : `${video.title} — در حال آماده‌سازی`;

  return (
    <button
      ref={tileRef}
      type="button"
      onClick={() => {
        if (isOpenable) onOpen(index);
        else if (isRetrying) handleRetryClick();
      }}
      aria-label={label}
      aria-disabled={!isOpenable && !isRetrying}
      className={`group relative block w-full overflow-hidden rounded-3xl text-right transition-all duration-300 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#FFF8F6] ${CARD_SURFACE} ${
        isOpenable || isRetrying
          ? "cursor-pointer hover:-translate-y-0.5 hover:shadow-[0_10px_30px_-4px_rgba(244,63,94,0.14)]"
          : "cursor-default"
      }`}
    >
      <div className="relative aspect-video w-full overflow-hidden bg-gradient-to-br from-purple-100 via-rose-50 to-amber-100">
        {/* Deliberately no <video> in this tile. A still image is the only
            thing that could be shown here for free, and only if one exists —
            see the `poster` note in public/videos/README.md. Without a poster
            the gradient and the play glyph below stand in. */}
        {status === READY && video.poster && !posterFailed && (
          <img
            src={video.poster}
            alt=""
            loading="lazy"
            onError={() => setPosterFailed(true)}
            className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
          />
        )}

        {(status === IDLE || status === LOADING) && (
          <div className={`absolute inset-0 flex items-center justify-center ${SOFT_GRADIENT}`}>
            <div className="animate-pulse text-rose-300/70">
              <FilmIcon className="h-7 w-7" />
            </div>
          </div>
        )}

        {status === MISSING && (
          <div className={`absolute inset-0 flex flex-col items-center justify-center gap-2 ${SOFT_GRADIENT}`}>
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-dashed border-rose-300/70 bg-white/70 text-rose-400">
              <FilmIcon className="h-5 w-5" />
            </div>
            <p className="text-[11px] font-medium tracking-wide text-rose-400/90" dir="ltr">
              {stripLeadingSlash(video.src)}
            </p>
          </div>
        )}

        {status === FAILED && (
          <div className={`absolute inset-0 flex flex-col items-center justify-center gap-2 ${SOFT_GRADIENT}`}>
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/80 text-rose-500 shadow-sm transition-transform duration-300 group-hover:scale-110">
              <RetryIcon className="h-5 w-5" />
            </div>
            <p className="text-[11px] font-semibold text-rose-500">تلاش دوباره</p>
          </div>
        )}

        {isOpenable && (
          <>
            {/* Scrim keeps the caption readable over a poster image */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-rose-950/30 via-transparent to-transparent" />

            <span className="pointer-events-none absolute right-3 top-3 rounded-full bg-white/85 px-2.5 py-1 text-[11px] font-bold text-rose-500 shadow-sm backdrop-blur-sm">
              {toFa(index + 1)} / {toFa(total)}
            </span>

            {/* Always on, not a hover reveal: with no footage in the tile this
                glyph is the only thing separating "ready to play" from "still
                checking", so it cannot wait for a mouse. */}
            <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/85 pl-1 text-rose-500 shadow-[0_8px_24px_-6px_rgba(0,0,0,0.35)] backdrop-blur-sm transition-transform duration-300 group-hover:scale-110">
                <PlayIcon className="h-5 w-5" />
              </span>
            </span>
          </>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <p className="truncate text-sm font-semibold tracking-tight text-gray-800">{video.title}</p>
        <span className="flex-shrink-0 text-xs text-rose-300 transition-colors duration-200 group-hover:text-rose-400">
          {isOpenable ? "✨ ▶️" : status === FAILED ? "🔄" : "🎞️"}
        </span>
      </div>
    </button>
  );
}

/* ------------------------------------------------------------------ *
 * Video stage inside the lightbox.
 * Keyed by video id from <Lightbox />, so its state resets naturally
 * when navigating between videos.
 * ------------------------------------------------------------------ */
function PlayerStage({ video, missing, prevIndex, nextIndex, onIndexChange }) {
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const showMissing = missing;
  const showRetry = !missing && failed;

  return (
    // flex-auto + min-h-0 is the whole fix: the stage sizes to the video and
    // is then allowed to SHRINK below it when the panel's max-h-[92vh] clamps.
    // Without min-h-0 a column flex item refuses to go smaller than its
    // content, which is what let a tall video stretch the panel past 92vh.
    // flex-auto (basis: auto) rather than flex-1 (basis: 0%) because the panel
    // has no definite height of its own, and a zero basis contributes to an
    // auto-height container in a browser-dependent way.
    <div className="relative flex min-h-0 flex-auto items-center justify-center bg-black">
      {showMissing || showRetry ? (
        // An explicit width here, because the card shrink-wraps its content and
        // there is no video to give it one in this state.
        <div className={`flex min-h-[14rem] w-[min(26rem,calc(100vw_-_3rem))] flex-col items-center justify-center gap-3 p-6 text-center ${SOFT_GRADIENT}`}>
          <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full border border-dashed border-rose-300/70 bg-white/70 text-rose-400">
            {showRetry ? <RetryIcon className="h-6 w-6" /> : <FilmIcon className="h-6 w-6" />}
          </div>

          {showRetry ? (
            <>
              <p className="text-sm font-medium text-rose-500">ویدیو پخش نشد</p>
              <p className="max-w-xs text-[11px] leading-relaxed text-gray-500">
                احتمالاً یک نرم‌افزار دانلود‌منیجر یا مسدودکننده، درخواست پخش رو قطع کرده.
              </p>
              <button
                type="button"
                onClick={() => {
                  setFailed(false);
                  setAttempt((current) => current + 1);
                }}
                className="mt-1 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-purple-600 via-rose-500 to-amber-500 px-5 py-2 text-xs font-bold text-white shadow-[0_8px_24px_-8px_rgba(244,63,94,0.6)] transition-all duration-300 hover:-translate-y-0.5"
              >
                <RetryIcon className="h-3.5 w-3.5" />
                <span>تلاش دوباره</span>
              </button>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-rose-500">این ویدیو هنوز اضافه نشده</p>
              <p className="text-[11px] text-gray-500" dir="ltr">
                {stripLeadingSlash(video.src)}
              </p>
            </>
          )}
        </div>
      ) : (
        <video
          key={`${video.id}-${attempt}`}
          src={video.src}
          poster={video.poster}
          controls
          autoPlay
          playsInline
          onError={() => setFailed(true)}
          // The picture is bounded in BOTH directions with absolute caps, so it
          // stops growing once it hits them instead of tracking the window:
          //   width  <= 56rem (896px), and never wider than the viewport
          //   height <= 34rem (544px), and 70vh on shorter windows
          // A replaced element with width/height auto and both maxes set is
          // fitted inside that box at its own aspect ratio by the browser, so a
          // 16:9 clip stays 894x503 and a 9:16 one becomes 306x544 — and the
          // card shrink-wraps whichever it turns out to be. This is what stops
          // a tall clip from becoming a 1325px-high card on a 1440p monitor.
          className="h-auto w-auto max-h-[min(70vh,34rem)] max-w-[min(56rem,calc(100vw_-_1.5rem))] bg-black object-contain sm:max-w-[min(56rem,calc(100vw_-_3rem))]"
        />
      )}

      {/* Side navigation */}
      {prevIndex !== null && (
        <button
          type="button"
          onClick={() => onIndexChange(prevIndex)}
          aria-label="ویدیوی قبلی"
          className="absolute left-2 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-gray-700 shadow-lg backdrop-blur-sm transition-all duration-200 hover:scale-105 hover:text-rose-500 sm:flex"
        >
          <ChevronIcon direction="left" />
        </button>
      )}
      {nextIndex !== null && (
        <button
          type="button"
          onClick={() => onIndexChange(nextIndex)}
          aria-label="ویدیوی بعدی"
          className="absolute right-2 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-gray-700 shadow-lg backdrop-blur-sm transition-all duration-200 hover:scale-105 hover:text-rose-500 sm:flex"
        >
          <ChevronIcon direction="right" />
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Lightbox player
 * ------------------------------------------------------------------ */
function Lightbox({ videos, statuses, index, onClose, onIndexChange }) {
  const video = videos[index];

  // Neighbouring videos worth navigating to. Only files the server confirmed
  // are absent get skipped — a tile whose preview never loaded still plays.
  const { prevIndex, nextIndex } = useMemo(() => {
    const find = (step) => {
      for (let i = 1; i <= videos.length; i += 1) {
        const candidate = (index + step * i + videos.length) % videos.length;
        if (statuses[candidate] !== MISSING) return candidate;
      }
      return null;
    };
    return { prevIndex: find(-1), nextIndex: find(1) };
  }, [index, statuses, videos.length]);

  // Escape / arrow keys + background scroll lock
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft" && prevIndex !== null) onIndexChange(prevIndex);
      if (event.key === "ArrowRight" && nextIndex !== null) onIndexChange(nextIndex);
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose, onIndexChange, nextIndex, prevIndex]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#2b0a1c]/70 p-3 backdrop-blur-md sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={video.title}
      onClick={onClose}
    >
      {/* The panel is a COLUMN flexbox and nothing inside it scrolls.
          `min-w-0` matters: as a flex item in the overlay's row flexbox, its
          automatic minimum size would otherwise be driven by the video's
          intrinsic width (1920px for a 1080p file), which is what pushed the
          card past the viewport and produced the horizontal scrollbar.
          `overflow-hidden` replaces `overflow-y-auto` because with the video
          sized by the box (below) there is never anything to scroll — and
          `overflow-y: auto` also forces `overflow-x` to compute to `auto`,
          which is how a stray pixel turned into a second scrollbar.

          `w-auto` (not w-full) so the card SHRINK-WRAPS the picture instead of
          always being 896px wide: a portrait clip then gets a portrait card
          rather than a wide one with black bars down the sides. max-w-full
          keeps it inside the overlay's padding. */}
      <div
        className="relative flex max-h-[92vh] w-auto min-w-0 max-w-full flex-col overflow-hidden rounded-3xl border border-rose-100/60 bg-white shadow-[0_30px_80px_-20px_rgba(0,0,0,0.5)]"
        onClick={(event) => event.stopPropagation()}
      >
        {/* Player bar */}
        <div className="flex flex-shrink-0 items-center justify-between gap-3 border-b border-rose-100/60 bg-gradient-to-r from-[#FFFDF9] to-[#FFF0FA] px-4 py-3" dir="ltr">
          <span className="flex-shrink-0 rounded-full bg-rose-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-rose-600 shadow-sm">
            {toFa(index + 1)} / {toFa(videos.length)}
          </span>

          {/* max-w keeps a long caption from widening the whole card, since the
              card now shrink-wraps its content. truncate does the rest. */}
          <p className="min-w-0 max-w-[14rem] truncate text-sm font-semibold text-gray-700" dir="rtl">
            {video.title}
          </p>

          <button
            type="button"
            onClick={onClose}
            aria-label="بستن"
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-white/80 text-gray-500 shadow-sm ring-1 ring-rose-100 transition-all duration-200 hover:-translate-y-0.5 hover:text-rose-500 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-300"
          >
            <CloseIcon />
          </button>
        </div>

        <PlayerStage
          key={video.id}
          video={video}
          missing={statuses[index] === MISSING}
          prevIndex={prevIndex}
          nextIndex={nextIndex}
          onIndexChange={onIndexChange}
        />

        {/* flex-shrink-0 is already in here so this drops straight back into
            the column layout if you uncomment it.
        <p className="flex-shrink-0 bg-white/90 px-4 py-2.5 text-center text-[11px] text-gray-400">
          با <span className="font-semibold text-rose-400">Esc</span> بسته می‌شه · با{" "}
          <span className="font-semibold text-rose-400">←</span> <span className="font-semibold text-rose-400">→</span> بین
          ویدیوها جابه‌جا شو
        </p> */}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Gallery page
 * ------------------------------------------------------------------ */
function Gallery() {
  const [statuses, setStatuses] = useState(() => galleryVideos.map(() => IDLE));
  const [openIndex, setOpenIndex] = useState(null);

  const handleStatus = useCallback((index, status) => {
    setStatuses((previous) => {
      if (previous[index] === status) return previous;
      const next = [...previous];
      next[index] = status;
      return next;
    });
  }, []);

  const missingCount = statuses.filter((status) => status === MISSING).length;

  return (
    <div
      className="relative min-h-screen overflow-x-clip bg-gradient-to-b from-[#FFFDF9] via-[#FFF5F5] to-[#FFF0FA] antialiased selection:bg-rose-200 selection:text-rose-900 rtl"
      dir="rtl"
    >
      {/* Background Ambient Glows — same as the hero.
          Kept inside their own clipped layer (instead of clipping the page
          root) so they can hang off the edges without ever creating a
          horizontal scrollbar, while the sticky header keeps working. */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute top-[-10%] right-[-10%] h-[45vw] w-[45vw] rounded-full bg-purple-200/40 blur-[120px]" />
        <div className="absolute bottom-[10%] left-[-10%] h-[40vw] w-[40vw] rounded-full bg-rose-200/40 blur-[100px]" />
      </div>

      {/* Header: back button (left) + "Happy Birthday" (right) */}
      <header className="sticky top-0 z-30 border-b border-rose-100/60 bg-[#FFFDF9]/80 backdrop-blur-md" dir="ltr">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <button
            type="button"
            onClick={() => navigate("home")}
            className={`group flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold text-gray-700 transition-all duration-300 hover:-translate-y-0.5 hover:text-rose-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-300 ${CARD_SURFACE}`}
          >
            <ArrowLeftIcon className="h-4 w-4 transition-transform duration-300 group-hover:-translate-x-0.5" />
            <span>برگرد</span>
          </button>

          <div className="flex flex-col items-end">
            <h1 className="bg-gradient-to-r from-purple-600 via-rose-500 to-amber-500 bg-clip-text pb-0.5 text-2xl font-extrabold tracking-tight text-transparent drop-shadow-sm sm:text-3xl">
              تولده میو
            </h1>
            {/* <p className="text-[11px] font-medium text-gray-500 sm:text-xs" dir="rtl">
              گالری ویدیوها ✨
            </p> */}
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-6xl px-4 pb-16 pt-8 sm:px-6">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          {/* <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-rose-600 shadow-sm">
            Gallery
          </span>
          <p className="max-w-md text-sm font-medium leading-loose text-gray-500 sm:text-base">
            ده ویدیوی قشنگ، فقط برای تو — روی هر کدوم بزن تا بزرگ و با صدا پخش بشه ❤️
          </p> */}

          {missingCount > 0 && (
            <p className="mt-1 rounded-2xl border border-dashed border-rose-200/80 bg-white/60 px-4 py-2 text-xs leading-relaxed text-rose-500/90 shadow-[0_4px_20px_-8px_rgba(244,63,94,0.12)] backdrop-blur-sm">
              <span className="font-semibold">{toFa(missingCount)}</span> ویدیو هنوز اضافه نشده — فایل‌ها رو با اسم{" "}
              <span dir="ltr" className="font-semibold">
                1.mp4
              </span>{" "}
              تا{" "}
              <span dir="ltr" className="font-semibold">
                10.mp4
              </span>{" "}
              داخل پوشه‌ی <span dir="ltr" className="font-semibold">public/videos</span> بذار تا همین‌جا ظاهر بشن.
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
          {galleryVideos.map((video, index) => (
            <VideoTile
              key={video.id}
              video={video}
              index={index}
              total={galleryVideos.length}
              status={statuses[index]}
              onStatus={handleStatus}
              onOpen={setOpenIndex}
            />
          ))}
        </div>

        {/* <div className="mt-14 flex flex-col items-center gap-4 text-center">
          <span className="text-rose-300">✨ ❤️ ✨</span>
          <button
            type="button"
            onClick={() => navigate("home")}
            className="group flex items-center gap-2 rounded-full bg-gradient-to-r from-purple-600 via-rose-500 to-amber-500 px-6 py-3 text-sm font-bold text-white shadow-[0_10px_30px_-8px_rgba(244,63,94,0.5)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_14px_36px_-8px_rgba(244,63,94,0.65)] active:translate-y-0"
          >
            <ArrowLeftIcon className="h-4 w-4 transition-transform duration-300 group-hover:-translate-x-0.5" />
            <span>برگشت به پیام‌ها</span>
          </button>
        </div> */}
      </main>

      {openIndex !== null && (
        <Lightbox
          videos={galleryVideos}
          statuses={statuses}
          index={openIndex}
          onClose={() => setOpenIndex(null)}
          onIndexChange={setOpenIndex}
        />
      )}
    </div>
  );
}

export default Gallery;