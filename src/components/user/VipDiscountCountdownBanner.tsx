import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { X, Sparkles, Gem } from 'lucide-react';
import { useVipDiscount } from '@/hooks/useVipDiscount';
import { cn } from '@/lib/utils';

const SESSION_DISMISS_KEY = 'vip:intro80:dismissed';
const PERSIST_DISMISS_KEY = 'vip:base50:dismissed';

interface Props {
  /** Em páginas de produto, o aviso de 50% reaparece mesmo se o usuário já fechou */
  forceShowOnProduct?: boolean;
}

const formatRemaining = (days: number, hours: number) => {
  if (hours <= 0) return 'expira em instantes';
  if (hours <= 24) return `${hours}h`;
  return `${days} ${days === 1 ? 'dia' : 'dias'}`;
};

export const VipDiscountCountdownBanner: React.FC<Props> = ({ forceShowOnProduct = false }) => {
  const vip = useVipDiscount();
  const [dismissedIntro, setDismissedIntro] = useState(false);
  const [dismissedBase, setDismissedBase] = useState(false);

  // Intro: dismiss apenas em sessão (sessionStorage). Reabre em refresh/nova aba.
  useEffect(() => {
    try {
      setDismissedIntro(sessionStorage.getItem(SESSION_DISMISS_KEY) === '1');
      setDismissedBase(localStorage.getItem(PERSIST_DISMISS_KEY) === '1');
    } catch { /* ignore */ }
  }, []);

  if (!vip.ready || !vip.isVip || vip.isLifetime) return null;

  if (vip.isIntroActive) {
    if (dismissedIntro) return null;
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
          <span className="font-bold">80% OFF</span> em todos Cursos e E-books — Você tem <span className="font-bold">7 dias</span> para aproveitar essa promoção.
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
          Como Sócio do Clube, você tem <span className="font-bold">50% OFF</span> em todos os cursos e ebooks.
        </Link>
        {!forceShowOnProduct && (
          <button
            type="button"
            aria-label="Fechar aviso"
            onClick={() => {
              setDismissedBase(true);
              try { localStorage.setItem(PERSIST_DISMISS_KEY, '1'); } catch { /* ignore */ }
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
