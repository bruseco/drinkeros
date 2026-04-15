import React, { useEffect, useState, useCallback } from 'react';
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
}

const GOLD_COLORS = [
  '#FFD700', '#FFC107', '#FFAB00', '#FFE082', '#FFF176',
  '#FFFFFF', '#F9A825', '#FF8F00', '#FFD54F', '#FFE57F',
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

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`}
      onClick={handleClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

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
      <div
        className={`relative z-10 flex flex-col items-center gap-6 px-8 text-center max-w-sm transition-all duration-500 ${visible ? 'scale-100 opacity-100' : 'scale-75 opacity-0'}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute -top-2 -right-2 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
        >
          <X className="h-5 w-5 text-white/70" />
        </button>

        {/* Star emoji */}
        <div className="text-6xl animate-bounce">⭐</div>

        {/* Text */}
        <div className="space-y-3">
          <h2 className="text-3xl font-bold text-white">Parabéns!</h2>
          <p className="text-lg text-white/90">
            Você concluiu seu curso e agora você pode baixar seu certificado.
          </p>
        </div>

        {/* Download button */}
        <CertificateDownloadButton
          referenceId={courseId}
          referenceName={courseName}
          certificateBgUrl={certificateBgUrl}
        />
      </div>
    </div>
  );
};

export default CourseCompletionCelebration;
