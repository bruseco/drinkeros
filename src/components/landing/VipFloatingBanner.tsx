import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Crown, X } from 'lucide-react';
import { VIP_DISCOUNT_PERCENT, applyVipDiscount, formatBRL } from '@/lib/vipDiscount';

interface VipFloatingBannerProps {
  /** ID do elemento "Matricule-se" que dispara a contagem */
  watchTargetId: string;
  basePrice: number;
  /** Delay em ms após visualização do CTA. Default 5000. */
  delayMs?: number;
}

const STORAGE_KEY_PREFIX = 'vipFloatingDismissed:';

const VipFloatingBanner: React.FC<VipFloatingBannerProps> = ({
  watchTargetId,
  basePrice,
  delayMs = 5000,
}) => {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const timerRef = useRef<number | null>(null);

  // Sessão: se fechou, não reabre nessa sessão
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (sessionStorage.getItem(STORAGE_KEY_PREFIX + watchTargetId) === '1') {
      setDismissed(true);
    }
  }, [watchTargetId]);

  useEffect(() => {
    if (dismissed || visible) return;
    const target = document.getElementById(watchTargetId);
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting && timerRef.current === null) {
          timerRef.current = window.setTimeout(() => {
            setVisible(true);
          }, delayMs);
        }
      },
      { threshold: 0.4 },
    );

    observer.observe(target);
    return () => {
      observer.disconnect();
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [watchTargetId, delayMs, dismissed, visible]);

  const handleClose = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setVisible(false);
    setDismissed(true);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(STORAGE_KEY_PREFIX + watchTargetId, '1');
    }
  };

  if (!visible || dismissed) return null;

  const vipPrice = applyVipDiscount(basePrice);

  return (
    <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[60] w-[calc(100%-1.5rem)] max-w-md animate-bounce-in pointer-events-auto">
      <Link
        to="/vip"
        className="relative block rounded-2xl p-4 pr-10 text-left shadow-2xl"
        style={{
          background: 'linear-gradient(135deg, #4c1d95 0%, #7e22ce 50%, #a21caf 100%)',
          border: '1px solid rgba(232, 121, 249, 0.55)',
          boxShadow:
            '0 10px 40px rgba(126, 34, 206, 0.55), inset 0 1px 0 rgba(255,255,255,0.12)',
        }}
      >
        <button
          type="button"
          onClick={handleClose}
          aria-label="Fechar oferta VIP"
          className="absolute top-2 right-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/30 hover:bg-black/50 text-white transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-2 mb-1">
          <Crown className="h-4 w-4 text-yellow-300" />
          <span className="text-[11px] font-extrabold tracking-[0.18em] uppercase text-yellow-300">
            Oferta VIP · {VIP_DISCOUNT_PERCENT}% OFF
          </span>
        </div>
        <p className="text-white text-sm leading-snug">
          Como <strong>Assinante VIP</strong> por apenas{' '}
          <strong className="text-yellow-300 text-base">{formatBRL(vipPrice)}</strong>{' '}
          <span className="text-white/80 text-xs">
            (de <span className="line-through">{formatBRL(basePrice)}</span>)
          </span>
        </p>
        <p className="mt-1 text-xs text-white/85">Toque e veja a oferta do plano VIP →</p>
      </Link>
    </div>
  );
};

export default VipFloatingBanner;
