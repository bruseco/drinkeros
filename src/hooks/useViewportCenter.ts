import { useEffect, useRef, useState } from 'react';

/**
 * Mede a "centralidade" do elemento no viewport (0 = fora/borda, 1 = no centro vertical).
 * Útil para iluminar o card que está passando no centro da tela durante o scroll.
 */
export function useViewportCenter<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T | null>(null);
  const [centrality, setCentrality] = useState(0);

  useEffect(() => {
    let raf = 0;

    const update = () => {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight || document.documentElement.clientHeight;
      const elCenter = rect.top + rect.height / 2;
      const viewportCenter = vh / 2;
      const distance = Math.abs(elCenter - viewportCenter);
      // Tolerância: até 60% da altura da viewport, vai caindo linearmente
      const maxDistance = vh * 0.6;
      const value = Math.max(0, 1 - distance / maxDistance);
      // Curva suave (easeOut)
      setCentrality(value * value * (3 - 2 * value));
    };

    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  return { ref, centrality };
}
