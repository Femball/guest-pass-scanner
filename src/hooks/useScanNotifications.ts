import { useEffect, useRef, useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import { createElement } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import ArrivalAlert from '@/components/ArrivalAlert';
import type { RealtimeChannel } from '@supabase/supabase-js';

const playArrivalSound = () => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const notes = [
      { freq: 880, start: 0, end: 0.15 },
      { freq: 1108.73, start: 0.15, end: 0.35 },
      { freq: 1318.51, start: 0.3, end: 0.55 },
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

// Push notifications are now triggered server-side by a DB trigger on
// scan_notifications inserts (see migration 'notify_push_on_scan').
// This guarantees pushes are sent even if no client device has the app open.

export const useScanNotifications = () => {
  const { isStaff } = useAuth();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const [activeAlert, setActiveAlert] = useState<{ id: string; clientName: string } | null>(null);

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
          const { id, client_name } = payload.new as { id: string; client_name: string };
          playArrivalSound();
          setActiveAlert({ id, clientName: client_name });
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

  const alertElement = activeAlert
    ? createPortal(
        createElement(ArrivalAlert, {
          clientName: activeAlert.clientName,
          onDismiss: () => setActiveAlert(null),
        }),
        document.body
      )
    : null;

  return { alertElement };
};
