// Orquestrador único dos convites pós-login (instalação do app → notificações).
// Prioridade: bloqueios obrigatórios (UserLayout) > boas-vindas (WelcomeOverlay) > instalação > notificações.
// Regras:
//  - no máximo 1 convite por abertura (sessionStorage);
//  - instalação: fora do modo instalado, sem pwa_installed_at, e sem "Agora não" nos últimos 30 dias
//    (e no mínimo 3 dias desde a última exibição);
//  - notificações: só no app instalado, em uma abertura POSTERIOR à primeira abertura instalada,
//    com Web Push suportado + VAPID configurado, permissão não negada, sem assinatura e sem opt-out.
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Bell, Smartphone, Zap, Sparkles, Home } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { detectStandalone } from '@/hooks/usePwaStatus';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import {
  getDeferredInstallPrompt,
  clearDeferredInstallPrompt,
  onInstallPromptChange,
  isIOSDevice,
} from '@/lib/installPrompt';

const SESSION_SHOWN = 'engagement-prompt-session';
const WELCOME_FLAG = 'drinkeros:just_signed_up';
const LEGACY_DISMISS = 'pwa-install-banner-dismissed';
const DAY = 86400000;
const PWA_SNOOZE_DAYS = 30;
const PWA_MIN_GAP_DAYS = 3;
const SESSION_START = Date.now();

type Stage = 'none' | 'pwa' | 'push' | 'push_denied';

interface ProfilePrompts {
  pwa_installed_at: string | null;
  pwa_prompt_last_shown_at: string | null;
  pwa_prompt_dismissed_at: string | null;
  push_opted_out_at: string | null;
}

const record = (prompt: 'pwa' | 'push', action: 'shown' | 'accepted' | 'dismissed' | 'denied') => {
  (supabase.rpc as any)('record_engagement_prompt', { _prompt: prompt, _action: action }).then(
    ({ error }: any) => error && console.warn('engagement record failed', error.message),
  );
};

export const EngagementOrchestrator: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const push = usePushNotifications();
  const [stage, setStage] = useState<Stage>('none');
  const [profile, setProfile] = useState<ProfilePrompts | null>(null);
  // Boas-vindas tem prioridade: lido no render inicial, antes do WelcomeOverlay limpar a flag.
  const [welcomeActive, setWelcomeActive] = useState(() => {
    try { return sessionStorage.getItem(WELCOME_FLAG) === '1'; } catch { return false; }
  });
  const [hasNativePrompt, setHasNativePrompt] = useState(() => !!getDeferredInstallPrompt());
  const [busy, setBusy] = useState(false);
  const decided = useRef(false);
  const standalone = detectStandalone();

  useEffect(() => onInstallPromptChange(() => setHasNativePrompt(!!getDeferredInstallPrompt())), []);

  useEffect(() => {
    if (!welcomeActive) return;
    const done = () => setWelcomeActive(false);
    window.addEventListener('welcome-overlay-closed', done);
    const safety = window.setTimeout(done, 5 * 60 * 1000);
    return () => { window.removeEventListener('welcome-overlay-closed', done); clearTimeout(safety); };
  }, [welcomeActive]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('pwa_installed_at, pwa_prompt_last_shown_at, pwa_prompt_dismissed_at, push_opted_out_at' as any)
        .eq('user_id', user.id)
        .maybeSingle();
      if (!cancelled) setProfile(((data as unknown) as ProfilePrompts) ?? {
        pwa_installed_at: null, pwa_prompt_last_shown_at: null, pwa_prompt_dismissed_at: null, push_opted_out_at: null,
      });
    })();
    return () => { cancelled = true; };
  }, [user]);

  // Decisão (uma vez por abertura)
  useEffect(() => {
    if (decided.current || !user || !profile || welcomeActive) return;
    if (standalone && push.isLoading) return;
    try { if (sessionStorage.getItem(SESSION_SHOWN)) { decided.current = true; return; } } catch { /* ignore */ }

    const now = Date.now();
    const ts = (v: string | null) => (v ? new Date(v).getTime() : 0);

    if (!standalone) {
      decided.current = true;
      if (profile.pwa_installed_at) return;
      // Escolha anterior do banner antigo (localStorage): migra 1x para o perfil como "Agora não".
      let dismissedAt = ts(profile.pwa_prompt_dismissed_at);
      try {
        if (!dismissedAt && localStorage.getItem(LEGACY_DISMISS) === '1') {
          localStorage.removeItem(LEGACY_DISMISS);
          record('pwa', 'dismissed');
          return;
        }
      } catch { /* ignore */ }
      if (dismissedAt && now - dismissedAt < PWA_SNOOZE_DAYS * DAY) return;
      if (now - ts(profile.pwa_prompt_last_shown_at) < PWA_MIN_GAP_DAYS * DAY) return;
      show('pwa');
      return;
    }

    decided.current = true;
    // Só numa abertura posterior à primeira abertura instalada.
    const installedAt = ts(profile.pwa_installed_at);
    if (!installedAt || installedAt > SESSION_START - 60_000) return;
    if (profile.push_opted_out_at) return;
    if (!push.isSupported || !push.isConfigured || push.isSubscribed) return;
    if (typeof Notification === 'undefined' || Notification.permission === 'denied') return;
    show('push');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, profile, welcomeActive, push.isLoading, push.isConfigured, push.isSubscribed]);

  const show = (s: 'pwa' | 'push') => {
    try { sessionStorage.setItem(SESSION_SHOWN, s); } catch { /* ignore */ }
    record(s, 'shown');
    setStage(s);
  };

  const close = () => setStage('none');

  // ---------- Ações: instalação ----------
  const handleInstall = async () => {
    const evt = getDeferredInstallPrompt();
    if (evt && !isIOSDevice()) {
      setBusy(true);
      try {
        await evt.prompt();
        const { outcome } = await evt.userChoice;
        clearDeferredInstallPrompt();
        if (outcome === 'accepted') {
          record('pwa', 'accepted');
          toast.success('App instalado! Abra pelo ícone na tela inicial.');
          close();
        }
      } finally {
        setBusy(false);
      }
      return;
    }
    // iOS / sem prompt nativo: guia visual existente
    close();
    navigate('/install');
  };

  const handlePwaLater = () => {
    record('pwa', 'dismissed');
    close();
  };

  // ---------- Ações: notificações ----------
  const handleEnablePush = async () => {
    setBusy(true);
    // subscribe() chama Notification.requestPermission() como 1º passo, direto do clique.
    const ok = await push.subscribe();
    setBusy(false);
    if (ok) {
      record('push', 'accepted');
      toast.success('Notificações ativadas! 🍹');
      close();
      return;
    }
    if (typeof Notification !== 'undefined' && Notification.permission === 'denied') {
      record('push', 'denied');
      setStage('push_denied');
      return;
    }
    toast.error('Não foi possível ativar agora. Tente de novo mais tarde pelo seu perfil.');
    close();
  };

  const handlePushNo = () => {
    record('push', 'dismissed');
    close();
  };

  const open = stage !== 'none';
  const onOpenChange = (v: boolean) => {
    if (v || busy) return;
    // Escape/voltar/fora: "Agora não" na instalação; nas notificações só fecha nesta abertura.
    if (stage === 'pwa') handlePwaLater();
    else close();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="z-[200] max-w-md w-[calc(100%-1.5rem)] rounded-3xl border-border p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] [&>button]:hidden"
      >
        {stage === 'pwa' && (
          <div className="flex flex-col items-center text-center gap-5">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/15">
              <Smartphone className="h-8 w-8 text-primary" aria-hidden />
            </div>
            <div className="space-y-2">
              <DialogTitle className="text-2xl font-bold leading-tight">
                Tenha o Clube dos Drinkeros sempre à mão
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Instale o app no seu celular e abra suas receitas com um toque.
              </DialogDescription>
            </div>
            <ul className="w-full space-y-2.5 text-left text-sm">
              <li className="flex items-center gap-3"><Home className="h-4 w-4 text-primary shrink-0" aria-hidden />Acesso rápido direto da tela inicial</li>
              <li className="flex items-center gap-3"><Zap className="h-4 w-4 text-primary shrink-0" aria-hidden />Navegação mais fluida, como um aplicativo</li>
              <li className="flex items-center gap-3"><Sparkles className="h-4 w-4 text-primary shrink-0" aria-hidden />Receba novidades e receitas da época</li>
            </ul>
            <Button size="lg" className="w-full h-12 text-base" onClick={handleInstall} disabled={busy}>
              {hasNativePrompt && !isIOSDevice() ? 'Instalar aplicativo' : 'Ver como instalar'}
            </Button>
            <button
              type="button"
              onClick={handlePwaLater}
              className="text-xs text-muted-foreground underline-offset-4 hover:underline"
            >
              Agora não, continuar no navegador
            </button>
          </div>
        )}

        {stage === 'push' && (
          <div className="flex flex-col items-center text-center gap-5">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/15">
              <Bell className="h-8 w-8 text-primary" aria-hidden />
            </div>
            <div className="space-y-2">
              <DialogTitle className="text-2xl font-bold leading-tight">Fique por dentro dos melhores drinks 🍹</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Ative as notificações para receber novas receitas, novidades e sugestões sazonais na hora certa.
              </DialogDescription>
            </div>
            <Button size="lg" className="w-full h-12 text-base" onClick={handleEnablePush} disabled={busy}>
              Ativar notificações
            </Button>
            <button
              type="button"
              onClick={handlePushNo}
              disabled={busy}
              className="text-xs text-muted-foreground underline-offset-4 hover:underline"
            >
              Não quero receber notificações
            </button>
          </div>
        )}

        {stage === 'push_denied' && (
          <div className="flex flex-col items-center text-center gap-4">
            <DialogTitle className="text-xl font-bold">Tudo bem, respeitamos sua escolha</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Se mudar de ideia, ative as notificações do Drinkeros nos Ajustes do celular
              (no iPhone: Ajustes › Notificações › Drinkeros).
            </DialogDescription>
            <Button size="lg" variant="secondary" className="w-full" onClick={close}>
              Continuar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default EngagementOrchestrator;
