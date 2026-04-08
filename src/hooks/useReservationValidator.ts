import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useScanSounds } from './useScanSounds';
import { z } from 'zod';

const qrCodeSchema = z.string()
  .min(1, 'QR code is required')
  .max(100, 'QR code too long')
  .regex(/^(TICKET|FLYER)-[A-Z0-9-]+$/i, 'Invalid QR code format');

interface ValidationState {
  isValid: boolean | null;
  clientName?: string;
  numberOfPersons?: number;
  message?: string;
  isLoading: boolean;
}

export const useReservationValidator = () => {
  const [state, setState] = useState<ValidationState>({
    isValid: null,
    clientName: undefined,
    numberOfPersons: undefined,
    message: undefined,
    isLoading: false,
  });
  
  const { playSuccessSound, playErrorSound } = useScanSounds();

  const notifyScan = useCallback(async (clientName: string, eventDate: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('scan_notifications').insert({
        client_name: clientName,
        event_date: eventDate,
        scanned_by: user?.id || null,
      });
    } catch (err) {
      console.error('Failed to create scan notification:', err);
    }
  }, []);

  const validateQRCode = useCallback(async (qrCode: string) => {
    setState(prev => ({ ...prev, isLoading: true }));

    const validationResult = qrCodeSchema.safeParse(qrCode);
    if (!validationResult.success) {
      playErrorSound();
      setState({ isValid: false, message: 'Format de QR code invalide.', isLoading: false });
      return;
    }

    const validatedQrCode = validationResult.data;

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

        const { error: scanError } = await supabase
          .from('flyer_scans')
          .insert({ flyer_invitation_id: flyer.id });

        if (scanError) {
          playErrorSound();
          setState({ isValid: false, message: 'Erreur lors de l\'enregistrement. Réessayez.', isLoading: false });
          return;
        }

        await supabase
          .from('flyer_invitations')
          .update({ scan_count: (flyer.scan_count || 0) + 1 })
          .eq('id', flyer.id);

        // Send arrival notification
        await notifyScan(`Invité Flyer - ${flyer.label}`, flyer.event_date);

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

      const { error: updateError } = await supabase
        .from('reservations')
        .update({ is_validated: true, validated_at: new Date().toISOString() })
        .eq('id', reservation.id);

      if (updateError) {
        playErrorSound();
        setState({ isValid: false, message: 'Erreur lors de la validation. Réessayez.', isLoading: false });
        return;
      }

      // Send arrival notification
      await notifyScan(reservation.client_name, reservation.event_date);

      playSuccessSound();
      setState({
        isValid: true,
        clientName: reservation.client_name,
        numberOfPersons: reservation.number_of_persons,
        message: 'Bienvenue à la soirée !',
        isLoading: false,
      });
    } catch (err) {
      playErrorSound();
      setState({ isValid: false, message: 'Erreur de connexion. Vérifiez votre réseau.', isLoading: false });
    }
  }, [notifyScan]);

  const reset = useCallback(() => {
    setState({ isValid: null, clientName: undefined, numberOfPersons: undefined, message: undefined, isLoading: false });
  }, []);

  return { ...state, validateQRCode, reset };
};
