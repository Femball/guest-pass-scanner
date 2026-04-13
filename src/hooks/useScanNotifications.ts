import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from './useAuth';
import type { RealtimeChannel } from '@supabase/supabase-js';

const playArrivalSound = () => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();

    // Two-tone doorbell chime
    const notes = [
      { freq: 880, start: 0, end: 0.15 },    // A5
      { freq: 1108.73, start: 0.15, end: 0.35 }, // C#6
      { freq: 1318.51, start: 0.3, end: 0.55 },  // E6
    ];

    notes.forEach(({ freq, start, end }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
      gain.gain.setValueAtTime(0, ctx.currentTime + start);
      gain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + start + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + end);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + end);
    });
  } catch {
    // Audio not available
  }
};

const sendPushToAll = async (clientName: string, eventDate: string) => {
  try {
    await supabase.functions.invoke('send-push-notification', {
      body: { client_name: clientName, event_date: eventDate },
    });
  } catch (err) {
    console.error('Failed to trigger push notifications:', err);
  }
};

export const useScanNotifications = () => {
  const { isStaff } = useAuth();
  const channelRef = useRef<RealtimeChannel | null>(null);

  const subscribe = useCallback(() => {
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
          const { client_name, event_date } = payload.new as { client_name: string; event_date: string };
          playArrivalSound();
          toast.info(`🚶 Arrivée : ${client_name}`, {
            description: "Vient de scanner son ticket à l'entrée",
            duration: 8000,
          });
          // Also send push notifications to all subscribed staff
          sendPushToAll(client_name, event_date);
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
