import { useEffect, useState } from "react";

const GALLERY_HASH = "#/gallery";
const HOME_HASH = "#/";

function readRoute() {
  const path = window.location.hash.replace(/^#\/?/, "").toLowerCase();
  return path.startsWith("gallery") ? "gallery" : "home";
}

export function navigate(route) {
  const next = route === "gallery" ? GALLERY_HASH : HOME_HASH;

  // Already there: just jump back to the top instead of doing nothing.
  if (window.location.hash === next) {
    window.scrollTo({ top: 0, behavior: "auto" });
    return;
  }

  window.location.hash = next;
}

export function useHashRoute() {
  const [route, setRoute] = useState(readRoute);

  useEffect(() => {
    const sync = () => {
      setRoute(readRoute());
      window.scrollTo({ top: 0, behavior: "auto" });
    };

    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  return route;
}