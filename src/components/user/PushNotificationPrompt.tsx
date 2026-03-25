import React, { useState } from 'react';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { Bell, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export const PushNotificationPrompt: React.FC = () => {
  const { isSupported, isSubscribed, permission, isLoading, isConfigured, subscribe } =
    usePushNotifications();
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem('push-prompt-dismissed') === 'true'
  );

  // Don't render if not supported, already subscribed, loading, dismissed,
  // denied, or VAPID not configured
  if (
    !isSupported ||
    isSubscribed ||
    isLoading ||
    dismissed ||
    permission === 'denied' ||
    !isConfigured
  ) {
    return null;
  }

  const handleSubscribe = async () => {
    const success = await subscribe();
    if (success) {
      toast.success('Notificações ativadas!');
    } else {
      toast.error('Não foi possível ativar as notificações');
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem('push-prompt-dismissed', 'true');
  };

  return (
    <div className="mx-4 mt-4 flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
        <Bell className="h-5 w-5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">Ative as notificações</p>
        <p className="text-xs text-muted-foreground">
          Receba avisos de novas aulas e lembretes de estudo
        </p>
      </div>
      <Button size="sm" onClick={handleSubscribe}>
        Ativar
      </Button>
      <button
        onClick={handleDismiss}
        className="p-1 text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Fechar"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};
