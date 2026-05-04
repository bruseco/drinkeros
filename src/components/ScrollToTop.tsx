import { useLayoutEffect } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

// In-memory scroll position cache keyed by location.key
const scrollPositions = new Map<string, number>();
let lastKey: string | null = null;

const ScrollToTop = () => {
  const location = useLocation();
  const navType = useNavigationType(); // 'POP' | 'PUSH' | 'REPLACE'

  useLayoutEffect(() => {
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }

    // Save scroll position of the previous location before navigating away
    const saveScroll = () => {
      if (lastKey) {
        scrollPositions.set(lastKey, window.scrollY);
      }
    };
    window.addEventListener("scroll", saveScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", saveScroll);
    };
  }, []);

  useLayoutEffect(() => {
    // Save current key's scroll before transitioning
    if (lastKey && lastKey !== location.key) {
      // Already saved by scroll listener — nothing to do
    }

    if (navType === "POP") {
      // Going back/forward: restore saved position
      const saved = scrollPositions.get(location.key) ?? 0;
      // Wait for DOM to render
      requestAnimationFrame(() => {
        window.scrollTo(0, saved);
      });
    } else {
      // New navigation: scroll to top
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    }

    lastKey = location.key;
  }, [location.key, navType]);

  return null;
};

export default ScrollToTop;
