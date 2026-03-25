import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

export function usePushNotifications() {
  const { user } = useAuth();
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isConfigured, setIsConfigured] = useState(false);

  const isSupported =
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window;

  useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }
    checkStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const checkStatus = async () => {
    if (!user || !isSupported) {
      setIsLoading(false);
      return;
    }

    try {
      // Check if VAPID keys are configured
      const { data } = await supabase.functions.invoke('get-vapid-key');
      if (data?.publicKey) {
        setIsConfigured(true);
      }

      // Check current subscription
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setIsSubscribed(!!subscription);
    } catch (e) {
      console.error('Error checking push status:', e);
    }

    setIsLoading(false);
  };

  const subscribe = useCallback(async () => {
    if (!user) return false;

    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== 'granted') return false;

      // Get VAPID public key
      const { data: vapidData } = await supabase.functions.invoke('get-vapid-key');
      if (!vapidData?.publicKey) throw new Error('VAPID key not configured');

      const registration = await navigator.serviceWorker.ready;

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidData.publicKey),
      });

      const subJson = subscription.toJSON();

      // Store subscription in database
      const { error } = await (supabase.from as any)('push_subscriptions').upsert(
        {
          user_id: user.id,
          endpoint: subJson.endpoint!,
          p256dh: subJson.keys!.p256dh!,
          auth: subJson.keys!.auth!,
        },
        { onConflict: 'user_id,endpoint' }
      );

      if (error) throw error;
      setIsSubscribed(true);
      return true;
    } catch (e) {
      console.error('Error subscribing to push:', e);
      return false;
    }
  }, [user]);

  const unsubscribe = useCallback(async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
        await (supabase.from as any)('push_subscriptions')
          .delete()
          .eq('endpoint', subscription.endpoint);
      }
      setIsSubscribed(false);
    } catch (e) {
      console.error('Error unsubscribing from push:', e);
    }
  }, []);

  return {
    permission,
    isSubscribed,
    isLoading,
    isConfigured,
    isSupported,
    subscribe,
    unsubscribe,
  };
}
