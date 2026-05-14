import React, { useEffect, useRef } from 'react';
import d01 from '@/assets/depoimentos/d01.jpg';
import d02 from '@/assets/depoimentos/d02.jpg';
import d03 from '@/assets/depoimentos/d03.jpg';
import d04 from '@/assets/depoimentos/d04.jpg';
import d05 from '@/assets/depoimentos/d05.jpg';
import d06 from '@/assets/depoimentos/d06.jpg';
import d07 from '@/assets/depoimentos/d07.jpg';
import d08 from '@/assets/depoimentos/d08.jpg';
import d09 from '@/assets/depoimentos/d09.jpg';
import d10 from '@/assets/depoimentos/d10.jpg';

import d11 from '@/assets/depoimentos/d11.jpg';
import d12 from '@/assets/depoimentos/d12.jpg';
import d13 from '@/assets/depoimentos/d13.jpg';
import d14 from '@/assets/depoimentos/d14.jpg';
import d15 from '@/assets/depoimentos/d15.jpg';
import d16 from '@/assets/depoimentos/d16.jpg';
import d17 from '@/assets/depoimentos/d17.jpg';
import d18 from '@/assets/depoimentos/d18.jpg';
import d19 from '@/assets/depoimentos/d19.jpg';
import d20 from '@/assets/depoimentos/d20.jpg';

const TESTIMONIALS = [d01, d02, d03, d04, d05, d06, d07, d08, d09, d10, d11, d12, d13, d14, d15, d16, d17, d18, d19, d20];

const AUTO_SPEED = 12; // px/s para a esquerda (mais lento)
const FRICTION = 0.94; // decay da inércia
const MIN_VELOCITY = 0.05;

const TestimonialsCarousel: React.FC = () => {
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const offsetRef = useRef(0);
  const velocityRef = useRef(0);
  const draggingRef = useRef(false);
  const lastXRef = useRef(0);
  const lastTRef = useRef(0);
  const halfWidthRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  const items = [...TESTIMONIALS, ...TESTIMONIALS];

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const measure = () => {
      halfWidthRef.current = track.scrollWidth / 2;
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(track);
    Array.from(track.querySelectorAll('img')).forEach((img) => {
      if (!(img as HTMLImageElement).complete) {
        img.addEventListener('load', measure, { once: true });
      }
    });

    let lastFrame = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - lastFrame) / 1000);
      lastFrame = now;

      if (!draggingRef.current) {
        if (Math.abs(velocityRef.current) > MIN_VELOCITY) {
          // inércia (px/frame -> aplicada como px/s aproximada)
          offsetRef.current += velocityRef.current;
          velocityRef.current *= FRICTION;
        } else {
          velocityRef.current = 0;
          // auto-scroll lento à esquerda
          offsetRef.current -= AUTO_SPEED * dt;
        }
      }

      // wrap
      const half = halfWidthRef.current;
      if (half > 0) {
        if (offsetRef.current <= -half) offsetRef.current += half;
        else if (offsetRef.current > 0) offsetRef.current -= half;
      }

      track.style.transform = `translate3d(${offsetRef.current}px, 0, 0)`;
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    draggingRef.current = true;
    velocityRef.current = 0;
    lastXRef.current = e.clientX;
    lastTRef.current = performance.now();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    const dx = e.clientX - lastXRef.current;
    const now = performance.now();
    const dt = Math.max(1, now - lastTRef.current);
    offsetRef.current += dx;
    // velocidade em px/frame (~16ms)
    velocityRef.current = (dx / dt) * 16;
    lastXRef.current = e.clientX;
    lastTRef.current = now;
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
  };

  return (
    <div className="relative w-screen left-1/2 -translate-x-1/2 mb-12">
      <h3 className="text-center text-xl md:text-2xl font-black text-white mb-1">
        O que os <span className="text-yellow-300">Drinkeros</span> dizem
      </h3>
      <p className="text-center text-purple-200 text-sm mb-6">
        Depoimentos reais de quem já vive a experiência
      </p>

      <div
        ref={viewportRef}
        className="relative overflow-hidden select-none cursor-grab active:cursor-grabbing touch-pan-y"
        style={{
          maskImage:
            'linear-gradient(to right, transparent 0, black 48px, black calc(100% - 48px), transparent 100%)',
          WebkitMaskImage:
            'linear-gradient(to right, transparent 0, black 48px, black calc(100% - 48px), transparent 100%)',
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        <div
          ref={trackRef}
          className="flex items-center gap-4 will-change-transform"
          style={{ width: 'max-content' }}
        >
          {items.map((src, i) => (
            <div
              key={i}
              className="shrink-0 rounded-2xl overflow-hidden border border-white/10 bg-white shadow-xl"
            >
              <img
                src={src}
                alt={`Depoimento ${(i % TESTIMONIALS.length) + 1}`}
                draggable={false}
                className="block h-[540px] md:h-[420px] w-auto pointer-events-none"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TestimonialsCarousel;
