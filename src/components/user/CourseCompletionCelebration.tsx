import React, { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import CertificateDownloadButton from './CertificateDownloadButton';

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  color: string;
  delay: number;
  duration: number;
  angle: number;
  distance: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  courseId: string;
  courseName: string;
  certificateBgUrl: string;
  hasCertificate: boolean;
}

const GOLD_COLORS = [
  'hsl(48 100% 50%)',
  'hsl(45 100% 52%)',
  'hsl(40 100% 50%)',
  'hsl(46 100% 75%)',
  'hsl(54 100% 72%)',
  'hsl(0 0% 100%)',
  'hsl(42 90% 40%)',
  'hsl(35 100% 50%)',
  'hsl(45 100% 66%)',
  'hsl(48 100% 75%)',
];

function generateParticles(count: number): Particle[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: 50 + (Math.random() - 0.5) * 10,
    y: 50 + (Math.random() - 0.5) * 10,
    size: Math.random() * 8 + 3,
    color: GOLD_COLORS[Math.floor(Math.random() * GOLD_COLORS.length)],
    delay: Math.random() * 0.5,
    duration: 0.8 + Math.random() * 1.2,
    angle: (360 / count) * i + (Math.random() - 0.5) * 30,
    distance: 30 + Math.random() * 50,
  }));
}

const CourseCompletionCelebration: React.FC<Props> = ({
  open,
  onClose,
  courseId,
  courseName,
  certificateBgUrl,
  hasCertificate,
}) => {
  const [particles, setParticles] = useState<Particle[]>([]);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (open) {
      setParticles(generateParticles(60));
      requestAnimationFrame(() => setVisible(true));
    } else {
      setVisible(false);
    }
  }, [open]);

  const handleClose = useCallback(() => {
    setVisible(false);
    setTimeout(onClose, 300);
  }, [onClose]);

  if (!open) return null;

  const content = (
    <div
      className={`fixed inset-0 z-[100] transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`}
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-background/85 backdrop-blur-sm" />

      {/* Particles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {particles.map((p) => {
          const rad = (p.angle * Math.PI) / 180;
          const tx = Math.cos(rad) * p.distance;
          const ty = Math.sin(rad) * p.distance;
          return (
            <div
              key={p.id}
              className="absolute rounded-full"
              style={{
                left: `${p.x}%`,
                top: `${p.y}%`,
                width: p.size,
                height: p.size,
                backgroundColor: p.color,
                boxShadow: `0 0 ${p.size * 2}px ${p.color}`,
                animation: `star-burst ${p.duration}s ease-out ${p.delay}s both`,
                '--tx': `${tx}vw`,
                '--ty': `${ty}vh`,
              } as React.CSSProperties}
            />
          );
        })}
      </div>

      {/* Content */}
      <div className="relative grid h-full w-full place-items-center overflow-hidden px-6 py-8" style={{ minHeight: '100dvh' }}>
        <div
          className={`relative z-10 flex w-full max-w-sm flex-col items-center gap-5 text-center transition-all duration-500 ${visible ? 'scale-100 opacity-100' : 'scale-75 opacity-0'}`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close button */}
          <button
            onClick={handleClose}
            className="absolute right-0 top-0 rounded-full border border-border bg-card/70 p-2 text-muted-foreground transition-colors hover:bg-card"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Star emoji */}
          <div className="text-6xl animate-bounce">⭐</div>

          {/* Text */}
          <div className="space-y-3">
            <h2 className="text-4xl font-bold text-foreground">Parabéns!</h2>
            <p className="text-lg leading-relaxed text-foreground">
              {hasCertificate
                ? 'Você concluiu seu curso e agora você pode baixar seu certificado.'
                : 'Você concluiu seu curso com sucesso.'}
            </p>
          </div>

          {/* Download button */}
          {hasCertificate && (
            <CertificateDownloadButton
              referenceId={courseId}
              referenceName={courseName}
              certificateBgUrl={certificateBgUrl}
            />
          )}
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return null;

  return createPortal(content, document.body);
};

export default CourseCompletionCelebration;
