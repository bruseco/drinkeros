import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Download, Smartphone } from 'lucide-react';
import { usePwaStatus } from '@/hooks/usePwaStatus';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/** Banner persistente (não-dismissável) exibido em todas as páginas internas
 *  até que o usuário instale o PWA. Some automaticamente quando detecta
 *  que o usuário já abriu via PWA pelo menos uma vez. */
export const PwaInstallGate: React.FC = () => {
  const { isStandalone, hasInstalledBefore, loading } = usePwaStatus();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

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

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setDeferredPrompt(null);
  };

  return (
    <div className="sticky top-0 z-40 w-full bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-lg">
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
      </div>
    </div>
  );
};
