import React, { useEffect, useRef, useState } from 'react';

interface Props {
  target: number;
  duration?: number; // ms
  className?: string;
}

const formatBR = (n: number) => n.toLocaleString('pt-BR');

const AnimatedStudentCount: React.FC<Props> = ({ target, duration = 2500, className }) => {
  const [value, setValue] = useState(0);
  const [started, setStarted] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  // Inicia animação quando entra na viewport
  useEffect(() => {
    if (!ref.current || started) return;
    const el = ref.current;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setStarted(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [started]);

  // Animação 0 -> target
  useEffect(() => {
    if (!started) return;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(eased * target));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [started, target, duration]);

  // Após chegar no target, incrementa 1-5 a cada 3-10s passando por cada número
  useEffect(() => {
    if (!started) return;
    let scheduleTimer: ReturnType<typeof setTimeout>;
    let stepTimer: ReturnType<typeof setTimeout>;

    const scheduleNext = () => {
      const delay = 3000 + Math.random() * 7000; // 3s a 10s
      scheduleTimer = setTimeout(() => {
        const burst = 1 + Math.floor(Math.random() * 5); // 1 a 5
        let count = 0;
        const stepDelay = 90; // ms entre cada incremento (rápido)
        const tickStep = () => {
          setValue((v) => v + 1);
          count += 1;
          if (count < burst) {
            stepTimer = setTimeout(tickStep, stepDelay);
          } else {
            scheduleNext();
          }
        };
        tickStep();
      }, delay);
    };

    scheduleNext();
    return () => {
      clearTimeout(scheduleTimer);
      clearTimeout(stepTimer);
    };
  }, [started]);

  return (
    <span ref={ref} className={className}>
      {formatBR(value)}
    </span>
  );
};

export default AnimatedStudentCount;
