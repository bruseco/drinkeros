import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Download, Smartphone, X } from 'lucide-react';
import { usePwaStatus } from '@/hooks/usePwaStatus';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'pwa-install-banner-dismissed';

/** Banner exibido acima do menu inferior (mobile) e no topo (desktop) até
 *  o usuário instalar o PWA ou fechar manualmente no X. */
export const PwaInstallGate: React.FC = () => {
  const { isStandalone, hasInstalledBefore, loading } = usePwaStatus();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(DISMISS_KEY) === '1';
  });

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (loading) return null;
  if (isStandalone) return null;
  if (hasInstalledBefore) return null;
  if (dismissed) return null;

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1');
    setDismissed(true);
  };

  return (
    <div
      className={
        // Mobile: fica acima do menu inferior (que é fixed bottom-0 com pb-[7px] + ~64px de altura + safe-area).
        // Desktop (lg): volta para o topo do conteúdo.
        'fixed bottom-[calc(72px+env(safe-area-inset-bottom))] left-0 right-0 z-40 lg:static lg:bottom-auto bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-lg lg:shadow-none'
      }
    >
      <div className="mx-auto flex max-w-5xl items-center gap-3 px-3 py-2.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/20 backdrop-blur">
          <Smartphone className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-tight">Instale o app Drinkeros</p>
          <p className="text-[11px] text-primary-foreground/80 leading-tight">
            Mais rápido, com notificações e atalho na tela inicial
          </p>
        </div>
        {deferredPrompt ? (
          <Button
            onClick={handleInstall}
            size="sm"
            className="shrink-0 bg-white text-primary hover:bg-white/90"
          >
            <Download className="h-4 w-4 mr-1" />
            Instalar
          </Button>
        ) : (
          <Link to="/install">
            <Button size="sm" className="shrink-0 bg-white text-primary hover:bg-white/90">
              Ver como
            </Button>
          </Link>
        )}
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Fechar"
          className="shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-white/15 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};
