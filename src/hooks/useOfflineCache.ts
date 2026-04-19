import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useNetworkStatus } from './useNetworkStatus';
import {
  loadCache,
  saveCache,
  type CachedFlyer,
  type CachedReservation,
} from '@/lib/offlineCache';

const SYNC_INTERVAL_MS = 30000;

interface OfflineCacheState {
  syncedAt: string | null;
  reservationsCount: number;
  flyersCount: number;
  isReady: boolean;
}

export const useOfflineCache = () => {
  const { isStaff } = useAuth();
  const isOnline = useNetworkStatus();
  const [state, setState] = useState<OfflineCacheState>({
    syncedAt: null,
    reservationsCount: 0,
    flyersCount: 0,
    isReady: false,
  });
  const isMountedRef = useRef(true);

  const sync = useCallback(async () => {
    if (!isStaff || !navigator.onLine) return;
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
    if (isMountedRef.current) {
      setState({
        syncedAt: payload.syncedAt,
        reservationsCount: payload.reservations.length,
        flyersCount: payload.flyers.length,
        isReady: true,
      });
    }
  }, [isStaff]);

  // Bootstrap: load existing cache, then try sync
  useEffect(() => {
    isMountedRef.current = true;
    (async () => {
      const existing = await loadCache();
      if (existing && isMountedRef.current) {
        setState({
          syncedAt: existing.syncedAt,
          reservationsCount: existing.reservations.length,
          flyersCount: existing.flyers.length,
          isReady: true,
        });
      } else if (isMountedRef.current) {
        setState((s) => ({ ...s, isReady: true }));
      }
    })();
    return () => {
      isMountedRef.current = false;
    };
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
