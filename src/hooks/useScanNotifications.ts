import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from './useAuth';
import type { RealtimeChannel } from '@supabase/supabase-js';

export const useScanNotifications = () => {
  const { isStaff } = useAuth();
  const channelRef = useRef<RealtimeChannel | null>(null);

  const subscribe = useCallback(() => {
    // Clean up existing channel first
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = supabase
      .channel('scan-notifications-' + Date.now())
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'scan_notifications',
        },
        (payload) => {
          const { client_name } = payload.new as { client_name: string };
          toast.info(`🚶 Arrivée : ${client_name}`, {
            description: "Vient de scanner son ticket à l'entrée",
            duration: 8000,
          });
        }
      )
      .subscribe();

    channelRef.current = channel;
  }, []);

  useEffect(() => {
    if (!isStaff) return;

    subscribe();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        subscribe();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [isStaff, subscribe]);
};
