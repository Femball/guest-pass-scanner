import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useScanSounds } from './useScanSounds';
import { z } from 'zod';
import { findFlyerByQr, findReservationByQr, loadCache } from '@/lib/offlineCache';

const qrCodeSchema = z.string()
  .min(1, 'QR code is required')
  .max(100, 'QR code too long')
  .regex(/^(TICKET|FLYER)-[A-Z0-9-]+$/i, 'Invalid QR code format');

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 800;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function withRetry<T extends { error: any }>(
  fn: () => Promise<T>,
  onAttempt?: (attempt: number) => void,
): Promise<{ result: T; attempts: number }> {
  let lastResult: T | undefined;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    onAttempt?.(attempt);
    try {
      const result = await fn();
      if (!result.error) return { result, attempts: attempt };
      lastResult = result;
    } catch (e) {
      lastResult = { error: e } as T;
    }
    if (attempt < MAX_RETRIES) await sleep(RETRY_DELAY_MS * attempt);
  }
  return { result: lastResult as T, attempts: MAX_RETRIES };
}

interface ValidationState {
  isValid: boolean | null;
  clientName?: string;
  numberOfPersons?: number;
  message?: string;
  amount?: number | null;
  paymentMethod?: string | null;
  paymentStatus?: string | null;
  isLoading: boolean;
  retryAttempt?: number;
}

export const useReservationValidator = () => {
  const [state, setState] = useState<ValidationState>({
    isValid: null,
    clientName: undefined,
    numberOfPersons: undefined,
    message: undefined,
    amount: undefined,
    paymentMethod: undefined,
    paymentStatus: undefined,
    isLoading: false,
    retryAttempt: 0,
  });
  
  const { playSuccessSound, playErrorSound } = useScanSounds();


  const validateQRCode = useCallback(async (qrCode: string) => {
    setState(prev => ({ ...prev, isLoading: true }));

    const validationResult = qrCodeSchema.safeParse(qrCode);
    if (!validationResult.success) {
      playErrorSound();
      setState({ isValid: false, message: 'Format de QR code invalide.', isLoading: false });
      return;
    }

    const validatedQrCode = validationResult.data;

    // Offline mode: read from cache only, block validation
    if (!navigator.onLine) {
      const cache = await loadCache();
      const today = new Date().toISOString().slice(0, 10);

      if (validatedQrCode.startsWith('FLYER-')) {
        const flyer = findFlyerByQr(cache, validatedQrCode);
        if (!flyer) {
          playErrorSound();
          setState({ isValid: false, message: '📵 Hors-ligne — flyer introuvable dans le cache.', isLoading: false });
          return;
        }
        if (flyer.event_date !== today) {
          playErrorSound();
          setState({ isValid: false, message: '📵 Hors-ligne — flyer non valable aujourd\'hui.', isLoading: false });
          return;
        }
        playErrorSound();
        setState({
          isValid: false,
          clientName: `Invité Flyer - ${flyer.label}`,
          message: '📵 Mode hors-ligne — validation impossible. Reconnectez-vous au réseau.',
          isLoading: false,
        });
        return;
      }

      const reservation = findReservationByQr(cache, validatedQrCode);
      if (!reservation) {
        playErrorSound();
        setState({ isValid: false, message: '📵 Hors-ligne — ticket introuvable dans le cache.', isLoading: false });
        return;
      }
      if (reservation.event_date !== today) {
        playErrorSound();
        setState({
          isValid: false,
          clientName: reservation.client_name,
          numberOfPersons: reservation.number_of_persons,
          message: '📵 Hors-ligne — ce ticket n\'est pas pour aujourd\'hui.',
          isLoading: false,
        });
        return;
      }
      playErrorSound();
      setState({
        isValid: false,
        clientName: reservation.client_name,
        numberOfPersons: reservation.number_of_persons,
        amount: reservation.amount,
        paymentMethod: reservation.payment_method,
        paymentStatus: reservation.payment_status,
        message: reservation.is_validated
          ? '📵 Hors-ligne — ticket déjà validé précédemment.'
          : '📵 Mode hors-ligne — validation impossible. Reconnectez-vous au réseau.',
        isLoading: false,
      });
      return;
    }

    try {
      // Flyer QR codes
      if (validatedQrCode.startsWith('FLYER-')) {
        const { data: flyer, error } = await supabase
          .from('flyer_invitations')
          .select('*')
          .eq('qr_code', validatedQrCode)
          .single();

        if (error || !flyer) {
          playErrorSound();
          setState({ isValid: false, message: 'QR Code flyer non reconnu.', isLoading: false });
          return;
        }

        const today = new Date().toISOString().slice(0, 10);
        if (flyer.event_date !== today) {
          const eventDateFormatted = new Date(flyer.event_date + 'T00:00:00').toLocaleDateString('fr-FR');
          playErrorSound();
          setState({ isValid: false, message: `Ce flyer est valable uniquement le ${eventDateFormatted}`, isLoading: false });
          return;
        }

        const { result: scanRes, attempts: scanAttempts } = await withRetry(
          () => supabase.from('flyer_scans').insert({ flyer_invitation_id: flyer.id }),
          (attempt) => setState((prev) => ({ ...prev, retryAttempt: attempt })),
        );
        const scanError = scanRes.error;

        if (scanError) {
          playErrorSound();
          setState({
            isValid: false,
            message: `Erreur après ${scanAttempts} tentative${scanAttempts > 1 ? 's' : ''}. Réessayez.`,
            isLoading: false,
          });
          return;
        }

        await supabase
          .from('flyer_invitations')
          .update({ scan_count: (flyer.scan_count || 0) + 1 })
          .eq('id', flyer.id);

        playSuccessSound();
        setState({
          isValid: true,
          clientName: `Invité Flyer - ${flyer.label}`,
          numberOfPersons: 1,
          message: 'Bienvenue à la soirée !',
          isLoading: false,
        });
        return;
      }

      // Ticket QR codes
      const { data: reservation, error } = await supabase
        .from('reservations')
        .select('*')
        .eq('qr_code', validatedQrCode)
        .single();

      if (error || !reservation) {
        playErrorSound();
        setState({ isValid: false, message: 'QR Code non reconnu. Ce ticket n\'existe pas.', isLoading: false });
        return;
      }

      if (reservation.event_date) {
        const today = new Date().toISOString().slice(0, 10);
        if (reservation.event_date !== today) {
          const eventDateFormatted = new Date(reservation.event_date + 'T00:00:00').toLocaleDateString('fr-FR');
          playErrorSound();
          setState({
            isValid: false,
            clientName: reservation.client_name,
            numberOfPersons: reservation.number_of_persons,
            message: `Ce ticket est valable uniquement le ${eventDateFormatted}`,
            isLoading: false,
          });
          return;
        }
      }

      if (reservation.is_validated) {
        playErrorSound();
        setState({
          isValid: false,
          clientName: reservation.client_name,
          numberOfPersons: reservation.number_of_persons,
          message: `Ticket déjà utilisé le ${new Date(reservation.validated_at!).toLocaleString('fr-FR')}`,
          isLoading: false,
        });
        return;
      }

      // Block validation if card payment is not yet paid
      if (reservation.payment_method === 'card' && reservation.payment_status !== 'paid') {
        playErrorSound();
        setState({
          isValid: false,
          clientName: reservation.client_name,
          numberOfPersons: reservation.number_of_persons,
          amount: reservation.amount,
          paymentMethod: reservation.payment_method,
          paymentStatus: reservation.payment_status,
          message: '💳 Paiement CB non effectué. La validation est impossible tant que le paiement n\'est pas confirmé.',
          isLoading: false,
        });
        return;
      }

      const { result: updateRes, attempts: updateAttempts } = await withRetry(
        () =>
          supabase
            .from('reservations')
            .update({ is_validated: true, validated_at: new Date().toISOString() })
            .eq('id', reservation.id),
        (attempt) => setState((prev) => ({ ...prev, retryAttempt: attempt, isLoading: true })),
      );
      const updateError = updateRes.error;

      if (updateError) {
        playErrorSound();
        setState({
          isValid: false,
          message: `Échec de validation après ${updateAttempts} tentative${updateAttempts > 1 ? 's' : ''}. Réessayez.`,
          isLoading: false,
        });
        return;
      }

      playSuccessSound();
      setState({
        isValid: true,
        clientName: reservation.client_name,
        numberOfPersons: reservation.number_of_persons,
        amount: reservation.amount,
        paymentMethod: reservation.payment_method,
        paymentStatus: reservation.payment_status,
        message: 'Bienvenue à la soirée !',
        isLoading: false,
      });
    } catch (err) {
      playErrorSound();
      setState({ isValid: false, message: 'Erreur de connexion. Vérifiez votre réseau.', isLoading: false });
    }
  }, [playSuccessSound, playErrorSound]);

  const reset = useCallback(() => {
    setState({ isValid: null, clientName: undefined, numberOfPersons: undefined, message: undefined, amount: undefined, paymentMethod: undefined, paymentStatus: undefined, isLoading: false, retryAttempt: 0 });
  }, []);

  return { ...state, validateQRCode, reset };
};
