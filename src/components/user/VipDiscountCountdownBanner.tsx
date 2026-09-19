import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { X, Sparkles, Gem } from 'lucide-react';
import { useVipDiscount } from '@/hooks/useVipDiscount';
import { cn } from '@/lib/utils';

const SESSION_DISMISS_KEY = 'vip:intro80:dismissed';
// Aviso de 50%: dispensa apenas na sessão — volta a aparecer em novos acessos
const SESSION_DISMISS_BASE_KEY = 'vip:base50:dismissed';

interface Props {
  /** Em páginas de produto, o aviso de 50% reaparece mesmo se o usuário já fechou */
  forceShowOnProduct?: boolean;
}

const formatRemaining = (days: number, hours: number) => {
  if (hours <= 0) return 'expira em instantes';
  if (hours <= 24) return `${hours}h`;
  return `${days} ${days === 1 ? 'dia' : 'dias'}`;
};

const pad = (n: number) => String(n).padStart(2, '0');

export const VipDiscountCountdownBanner: React.FC<Props> = ({ forceShowOnProduct = false }) => {
  const vip = useVipDiscount();
  const [dismissedIntro, setDismissedIntro] = useState(false);
  const [dismissedBase, setDismissedBase] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  // Intro: dismiss apenas em sessão (sessionStorage). Reabre em refresh/nova aba.
  useEffect(() => {
    try {
      setDismissedIntro(sessionStorage.getItem(SESSION_DISMISS_KEY) === '1');
      setDismissedBase(sessionStorage.getItem(SESSION_DISMISS_BASE_KEY) === '1');
    } catch { /* ignore */ }
  }, []);

  // Tick a cada 1s quando entra na reta final (≤ 24h) para o timer correr ao vivo
  const msLeft = vip.introExpiresAt ? vip.introExpiresAt.getTime() - now : 0;
  const inFinalDay = vip.isIntroActive && msLeft > 0 && msLeft <= 24 * 60 * 60 * 1000;
  useEffect(() => {
    if (!inFinalDay) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [inFinalDay]);

  if (!vip.ready || !vip.isVip || vip.isLifetime) return null;

  if (vip.isIntroActive) {
    if (dismissedIntro) return null;

    // Timer ao vivo no último dia
    let liveTimer: string | null = null;
    if (inFinalDay) {
      const totalSec = Math.max(0, Math.floor(msLeft / 1000));
      const h = Math.floor(totalSec / 3600);
      const m = Math.floor((totalSec % 3600) / 60);
      const s = totalSec % 60;
      // ≤ 59 min → MM:SS (segundos esgotando). Caso contrário HH:MM:SS.
      liveTimer = h === 0 ? `${pad(m)}:${pad(s)}` : `${pad(h)}:${pad(m)}:${pad(s)}`;
    }

    return (
      <div
        role="status"
        className="relative w-full bg-yellow-400 text-black shadow-md animate-in fade-in slide-in-from-top-2 duration-300"
      >
        <Link
          to="/app/cursos"
          className="block px-4 py-2.5 pr-10 text-center text-sm sm:text-base font-medium hover:bg-yellow-300 transition-colors"
        >
          <Sparkles className="inline-block h-4 w-4 mr-1.5 -mt-0.5" />
          <span className="font-bold">80% OFF</span> em Cursos e E-books —{' '}
          {liveTimer ? (
            <>Sua oferta expira em <span className="font-bold tabular-nums">{liveTimer}</span></>
          ) : vip.hoursRemaining > 0 && vip.hoursRemaining <= 24 ? (
            <>Sua oferta <span className="font-bold">expira HOJE!</span></>
          ) : (
            <>Você tem <span className="font-bold">{vip.daysRemaining} {vip.daysRemaining === 1 ? 'dia' : 'dias'}</span> para aproveitar essa promoção.</>
          )}
        </Link>
        <button
          type="button"
          aria-label="Fechar aviso"
          onClick={() => {
            setDismissedIntro(true);
            try { sessionStorage.setItem(SESSION_DISMISS_KEY, '1'); } catch { /* ignore */ }
          }}
          className="absolute top-1/2 right-2 -translate-y-1/2 inline-flex h-7 w-7 items-center justify-center rounded-full hover:bg-black/10 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  if (vip.isBaseActive) {
    if (dismissedBase && !forceShowOnProduct) return null;
    return (
      <div
        role="status"
        className={cn(
          'relative w-full text-black shadow-md animate-in fade-in slide-in-from-top-2 duration-300',
          'bg-yellow-200',
        )}
      >
        <Link
          to="/app/cursos"
          className="block px-4 py-2 pr-10 text-center text-sm font-medium hover:bg-yellow-100 transition-colors"
        >
          <Gem className="inline-block h-4 w-4 mr-1.5 -mt-0.5" />
          Como Sócio do Clube, você tem <span className="font-bold">50% OFF</span> em cursos e e-books. Alguns cursos têm condição especial de sócio.
        </Link>
        {!forceShowOnProduct && (
          <button
            type="button"
            aria-label="Fechar aviso"
            onClick={() => {
              setDismissedBase(true);
              try { sessionStorage.setItem(SESSION_DISMISS_BASE_KEY, '1'); } catch { /* ignore */ }
            }}
            className="absolute top-1/2 right-2 -translate-y-1/2 inline-flex h-7 w-7 items-center justify-center rounded-full hover:bg-black/10 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    );
  }

  return null;
};

export default VipDiscountCountdownBanner;
