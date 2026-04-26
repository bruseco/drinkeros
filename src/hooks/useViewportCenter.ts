import { useEffect, useRef, useState } from 'react';

/**
 * Mede a "centralidade" do elemento no viewport (0 = fora/borda, 1 = no centro vertical).
 * Atualiza continuamente para permitir animações contínuas (ex.: oscilação) baseadas no valor.
 */
export function useViewportCenter<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T | null>(null);
  const [centrality, setCentrality] = useState(0);

  useEffect(() => {
    let raf = 0;
    let mounted = true;

    const tick = () => {
      if (!mounted) return;
      const el = ref.current;
      if (el) {
        const rect = el.getBoundingClientRect();
        const vh = window.innerHeight || document.documentElement.clientHeight;
        const elCenter = rect.top + rect.height / 2;
        const viewportCenter = vh / 2;
        const distance = Math.abs(elCenter - viewportCenter);
        const maxDistance = vh * 0.6;
        const value = Math.max(0, 1 - distance / maxDistance);
        const eased = value * value * (3 - 2 * value);
        setCentrality((prev) => (Math.abs(prev - eased) > 0.005 ? eased : prev));
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => {
      mounted = false;
      cancelAnimationFrame(raf);
    };
  }, []);

  return { ref, centrality };
}
