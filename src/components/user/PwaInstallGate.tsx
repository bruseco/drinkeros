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

/** Helper compartilhado: o gate do PWA está visível para este usuário?
 *  Outros componentes (ex: banner do Clube) usam isso pra evitar empilhar CTAs. */
export function shouldShowPwaGate(opts: {
  isStandalone: boolean;
  hasInstalledBefore: boolean | null;
  loading: boolean;
}): boolean {
  if (opts.loading) return true; // enquanto carrega, assume que pode aparecer (evita flash do banner do Clube)
  if (opts.isStandalone) return false;
  if (opts.hasInstalledBefore) return false;
  if (typeof window !== 'undefined' && localStorage.getItem(DISMISS_KEY) === '1') return false;
  return true;
}

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
    window.dispatchEvent(new Event('install-banner-dismissed'));
  };

  return (
    <div
      className={
        // Mobile: flutua acima do menu inferior, com respiro lateral e cantos arredondados.
        // Desktop (lg): volta para o topo do conteúdo, sem fixar.
        'fixed bottom-[calc(88px+env(safe-area-inset-bottom))] left-3 right-3 z-40 rounded-2xl overflow-hidden lg:static lg:left-auto lg:right-auto lg:bottom-auto lg:rounded-none bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-lg lg:shadow-none'
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
