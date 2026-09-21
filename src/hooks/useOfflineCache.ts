import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useNetworkStatus } from './useNetworkStatus';
import {
  loadCache,
  loadQueue,
  saveCache,
  saveQueue,
  type CachedFlyer,
  type CachedReservation,
} from '@/lib/offlineCache';

const SYNC_INTERVAL_MS = 30000;

interface OfflineCacheState {
  syncedAt: string | null;
  reservationsCount: number;
  flyersCount: number;
  pendingCount: number;
  isReady: boolean;
}

export const useOfflineCache = () => {
  const { isStaff } = useAuth();
  const isOnline = useNetworkStatus();
  const [state, setState] = useState<OfflineCacheState>({
    syncedAt: null,
    reservationsCount: 0,
    flyersCount: 0,
    pendingCount: 0,
    isReady: false,
  });
  const isMountedRef = useRef(true);
  const flushingRef = useRef(false);

  /** Rejoue les scans effectués hors-ligne dès que le réseau revient. */
  const flushQueue = useCallback(async () => {
    if (flushingRef.current || !navigator.onLine) return;
    flushingRef.current = true;
    try {
      const queue = await loadQueue();
      if (queue.length === 0) return;
      const remaining: typeof queue = [];

      for (const item of queue) {
        try {
          if (item.type === 'ticket') {
            const { error } = await supabase
              .from('reservations')
              .update({ is_validated: true, validated_at: item.scannedAt })
              .eq('id', item.targetId)
              .eq('is_validated', false)
              .select('id');
            if (error) remaining.push(item);
          } else {
            const { error } = await supabase
              .from('flyer_scans')
              .insert({ flyer_invitation_id: item.targetId, scanned_at: item.scannedAt });
            if (error) remaining.push(item);
          }
        } catch {
          remaining.push(item);
        }
      }

      await saveQueue(remaining);
      if (isMountedRef.current) {
        setState((s) => ({ ...s, pendingCount: remaining.length }));
      }
    } finally {
      flushingRef.current = false;
    }
  }, []);

  const sync = useCallback(async () => {
    if (!isStaff || !navigator.onLine) return;
    await flushQueue();
    const today = new Date().toISOString().slice(0, 10);

    const [reservationsRes, flyersRes] = await Promise.all([
      supabase
        .from('reservations')
        .select(
          'id, qr_code, client_name, client_email, number_of_persons, event_date, is_validated, validated_at, payment_method, payment_status, amount',
        )
        .eq('event_date', today),
      supabase
        .from('flyer_invitations')
        .select('id, qr_code, label, event_date, scan_count')
        .eq('event_date', today),
    ]);

    if (reservationsRes.error || flyersRes.error) return;

    const payload = {
      reservations: (reservationsRes.data ?? []) as CachedReservation[],
      flyers: (flyersRes.data ?? []) as CachedFlyer[],
      syncedAt: new Date().toISOString(),
      eventDate: today,
    };

    await saveCache(payload);
    const pending = await loadQueue();
    if (isMountedRef.current) {
      setState({
        syncedAt: payload.syncedAt,
        reservationsCount: payload.reservations.length,
        flyersCount: payload.flyers.length,
        pendingCount: pending.length,
        isReady: true,
      });
    }
  }, [isStaff, flushQueue]);

  // Bootstrap: load existing cache, then try sync
  useEffect(() => {
    isMountedRef.current = true;
    (async () => {
      const [existing, pending] = await Promise.all([loadCache(), loadQueue()]);
      if (!isMountedRef.current) return;
      if (existing) {
        setState({
          syncedAt: existing.syncedAt,
          reservationsCount: existing.reservations.length,
          flyersCount: existing.flyers.length,
          pendingCount: pending.length,
          isReady: true,
        });
      } else {
        setState((s) => ({ ...s, pendingCount: pending.length, isReady: true }));
      }
    })();
    return () => {
      isMountedRef.current = false;
    };
  }, []);


  // Rafraîchit le compteur de scans en attente (utile hors-ligne)
  useEffect(() => {
    const id = setInterval(async () => {
      const pending = await loadQueue();
      if (isMountedRef.current) setState((s) => (s.pendingCount === pending.length ? s : { ...s, pendingCount: pending.length }));
    }, 5000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!isStaff) return;
    sync();
    const id = setInterval(sync, SYNC_INTERVAL_MS);
    const onOnline = () => sync();
    window.addEventListener('online', onOnline);
    const onVis = () => {
      if (document.visibilityState === 'visible') sync();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(id);
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [isStaff, sync]);

  return { ...state, isOnline, sync };
};
