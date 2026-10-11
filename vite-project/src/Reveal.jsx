import { useEffect, useRef, useState } from "react";

/**
 * Lifts and fades its children into place the first time they scroll into view.
 *
 * The transition itself lives on `.reveal-item` in src/index.css, which is also
 * where `prefers-reduced-motion` switches the effect off — this component only
 * ever decides *when* an element has arrived, never how it moves.
 *
 * Wrapping a card in this (rather than animating the card itself) keeps the
 * reveal transform away from the card's own hover transform, so the two never
 * fight over the same property.
 */
export default function Reveal({ children, delay = 0, className = "" }) {
  const ref = useRef(null);

  // With no IntersectionObserver there is nothing to wait for, so start shown.
  // Initialising this way instead of setting state inside the effect keeps the
  // element from ever rendering in its hidden state on a server.
  const [shown, setShown] = useState(() => typeof IntersectionObserver === "undefined");

  useEffect(() => {
    if (shown) return undefined;

    const node = ref.current;
    if (!node) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setShown(true);
        observer.disconnect(); // one-shot: it never animates out again
      },
      // Fire a little before the element is fully on screen, but only once
      // enough of it is visible that the animation isn't played off-edge.
      { rootMargin: "0px 0px -12% 0px", threshold: 0.15 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [shown]);

  return (
    <div
      ref={ref}
      className={`reveal-item ${shown ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"} ${className}`}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}