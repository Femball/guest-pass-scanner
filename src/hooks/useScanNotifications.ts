import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from './useAuth';

export const useScanNotifications = () => {
  const { isStaff } = useAuth();

  useEffect(() => {
    if (!isStaff) return;

    const channel = supabase
      .channel('scan-notifications')
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
            description: 'Vient de scanner son ticket à l\'entrée',
            duration: 8000,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isStaff]);
};
