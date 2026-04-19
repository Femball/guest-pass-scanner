import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface OccupancyState {
  validated: number;     // personnes effectivement entrées
  expected: number;      // total attendu (somme number_of_persons)
  reservations: number;  // nb de réservations
  validatedReservations: number;
  isLoading: boolean;
}

const POLL_INTERVAL_MS = 10000;

const setBadge = (count: number) => {
  try {
    const nav = navigator as Navigator & {
      setAppBadge?: (n?: number) => Promise<void>;
      clearAppBadge?: () => Promise<void>;
    };
    if (count > 0 && typeof nav.setAppBadge === 'function') {
      nav.setAppBadge(count).catch(() => {});
    } else if (typeof nav.clearAppBadge === 'function') {
      nav.clearAppBadge().catch(() => {});
    }
  } catch {
    // Badge API non supportée — silencieux
  }
};

export const useOccupancy = () => {
  const { isStaff } = useAuth();
  const [state, setState] = useState<OccupancyState>({
    validated: 0,
    expected: 0,
    reservations: 0,
    validatedReservations: 0,
    isLoading: true,
  });
  const isMountedRef = useRef(true);

  const fetchOccupancy = useCallback(async () => {
    const today = new Date().toISOString().slice(0, 10);

    const { data, error } = await supabase
      .from('reservations')
      .select('number_of_persons, is_validated, payment_method, payment_status')
      .eq('event_date', today);

    if (error || !data) {
      if (isMountedRef.current) {
        setState((prev) => ({ ...prev, isLoading: false }));
      }
      return;
    }

    let expected = 0;
    let validated = 0;
    let validatedReservations = 0;

    for (const r of data) {
      const persons = r.number_of_persons ?? 1;
      // On compte comme attendu uniquement les réservations qui peuvent réellement entrer
      // (carte non payée = bloquée à l'entrée)
      const isBlocked = r.payment_method === 'card' && r.payment_status !== 'paid';
      if (!isBlocked) {
        expected += persons;
      }
      if (r.is_validated) {
        validated += persons;
        validatedReservations += 1;
      }
    }

    if (isMountedRef.current) {
      setState({
        validated,
        expected,
        reservations: data.length,
        validatedReservations,
        isLoading: false,
      });
      setBadge(validated);
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    if (!isStaff) {
      setState((prev) => ({ ...prev, isLoading: false }));
      return;
    }

    fetchOccupancy();
    const interval = setInterval(fetchOccupancy, POLL_INTERVAL_MS);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') fetchOccupancy();
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      isMountedRef.current = false;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [isStaff, fetchOccupancy]);

  return { ...state, refresh: fetchOccupancy };
};
