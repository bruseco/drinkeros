import React, { useEffect, useRef, useState } from 'react';

interface Props {
  target: number;
  duration?: number;
  className?: string;
  pad?: number;
}

const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

interface RollingDigitProps {
  digit: string;
  active: boolean;
  delay: number;
  duration: number;
}

const RollingDigit: React.FC<RollingDigitProps> = ({ digit, active, delay, duration }) => {
  const target = parseInt(digit, 10);
  // Total spins before settling — gives the retro reel feel
  const spins = 4;
  const finalOffset = spins * 10 + target;

  return (
    <span
      style={{
        display: 'inline-block',
        height: '1em',
        lineHeight: 1,
        overflow: 'hidden',
        verticalAlign: 'baseline',
      }}
    >
      <span
        style={{
          display: 'inline-flex',
          flexDirection: 'column',
          transform: `translateY(-${(active ? finalOffset : 0) * 1}em)`,
          transition: active
            ? `transform ${duration}ms cubic-bezier(0.22, 1, 0.36, 1) ${delay}ms`
            : 'none',
        }}
      >
        {Array.from({ length: finalOffset + 1 }).map((_, i) => (
          <span key={i} style={{ height: '1em', lineHeight: 1 }}>
            {DIGITS[i % 10]}
          </span>
        ))}
      </span>
    </span>
  );
};

const AnimatedNumber: React.FC<Props> = ({ target, duration = 2000, className, pad = 4 }) => {
  const [active, setActive] = useState(false);
  const startedRef = useRef(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (startedRef.current) return;
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !startedRef.current) {
          startedRef.current = true;
          observer.disconnect();
          setActive(true);
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const text = String(target).padStart(pad, '0');

  return (
    <span
      ref={ref}
      className={className}
      style={{ fontVariantNumeric: 'tabular-nums', display: 'inline-flex' }}
    >
      {text.split('').map((d, i) => (
        <RollingDigit
          key={i}
          digit={d}
          active={active}
          delay={i * 180}
          duration={duration}
        />
      ))}
    </span>
  );
};

export default AnimatedNumber;
