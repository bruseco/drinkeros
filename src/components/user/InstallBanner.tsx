import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Download, Smartphone, X } from 'lucide-react';
import { usePwaStatus } from '@/hooks/usePwaStatus';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'installBannerDismissed';

/** Helper compartilhado: o banner do PWA está visível para este usuário? */
export function shouldShowInstallBanner(opts: {
  isStandalone: boolean;
  hasInstalledBefore: boolean | null;
  loading: boolean;
}): boolean {
  if (opts.loading) return false;
  if (opts.isStandalone) return false;
  if (opts.hasInstalledBefore) return false;
  if (typeof window !== 'undefined' && localStorage.getItem(DISMISS_KEY) === '1') return false;
  return true;
}

export const InstallBanner: React.FC = () => {
  const { isStandalone, hasInstalledBefore, loading } = usePwaStatus();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(DISMISS_KEY) === '1';
  });

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  // Não mostra se já está no PWA, se já instalou alguma vez, ou se o usuário fechou
  if (loading || isStandalone || hasInstalledBefore || dismissed) return null;

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1');
    setDismissed(true);
    // Notifica outros componentes (mesma aba) que o banner foi fechado
    window.dispatchEvent(new Event('install-banner-dismissed'));
  };

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary to-primary/80 p-4 text-primary-foreground shadow-lg shadow-primary/20 animate-fade-in">
      <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-white/10 blur-2xl" />
      <div className="absolute -bottom-4 -left-4 h-20 w-20 rounded-full bg-white/10 blur-xl" />

      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Fechar banner de instalação"
        className="absolute top-2 right-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/20 hover:bg-black/40 text-white transition-colors z-10"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="relative flex items-center gap-4 pr-8">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/20 backdrop-blur">
          <Smartphone className="h-6 w-6" />
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm">Instale o App!</h3>
          <p className="text-xs text-primary-foreground/80 mt-0.5">
            Acesse offline e tenha uma experiência melhor
          </p>
        </div>

        {deferredPrompt ? (
          <Button
            onClick={handleInstallClick}
            size="sm"
            className="shrink-0 bg-white text-primary hover:bg-white/90 shadow-md"
          >
            <Download className="h-4 w-4 mr-1" />
            Instalar
          </Button>
        ) : (
          <Link to="/install">
            <Button
              size="sm"
              className="shrink-0 bg-white text-primary hover:bg-white/90 shadow-md"
            >
              Ver como
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
};
