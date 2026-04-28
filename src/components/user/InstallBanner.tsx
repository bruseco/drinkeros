import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Download, Smartphone } from 'lucide-react';
import { usePwaStatus } from '@/hooks/usePwaStatus';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const InstallBanner: React.FC = () => {
  const { isStandalone, hasInstalledBefore, loading } = usePwaStatus();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  // Não mostra se já está no PWA ou se já instalou alguma vez
  if (loading || isStandalone || hasInstalledBefore) return null;

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  };

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary to-primary/80 p-4 text-primary-foreground shadow-lg shadow-primary/20 animate-fade-in">
      <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-white/10 blur-2xl" />
      <div className="absolute -bottom-4 -left-4 h-20 w-20 rounded-full bg-white/10 blur-xl" />

      <div className="relative flex items-center gap-4">
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
