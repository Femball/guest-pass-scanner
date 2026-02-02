import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useScanSounds } from './useScanSounds';
import { z } from 'zod';

// Schema de validation pour les QR codes
// Format attendu: TICKET-[UUID] (ex: TICKET-A1B2C3D4-E5F6-7890-ABCD-EF1234567890)
const qrCodeSchema = z.string()
  .min(1, 'QR code is required')
  .max(100, 'QR code too long')
  .regex(/^TICKET-[A-Z0-9-]+$/i, 'Invalid QR code format');

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

  const validateQRCode = useCallback(async (qrCode: string) => {
    setState(prev => ({ ...prev, isLoading: true }));

    // Validation de l'entrée avant toute requête
    const validationResult = qrCodeSchema.safeParse(qrCode);
    if (!validationResult.success) {
      playErrorSound();
      setState({
        isValid: false,
        message: 'Format de QR code invalide.',
        isLoading: false,
      });
      return;
    }

    const validatedQrCode = validationResult.data;

    try {
      // Rechercher la réservation par QR code validé
      const { data: reservation, error } = await supabase
        .from('reservations')
        .select('*')
        .eq('qr_code', validatedQrCode)
        .single();

      if (error || !reservation) {
        playErrorSound();
        setState({
          isValid: false,
          message: 'QR Code non reconnu. Ce ticket n\'existe pas.',
          isLoading: false,
        });
        return;
      }

      // Vérifier si déjà validé
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

      // Valider le ticket
      const { error: updateError } = await supabase
        .from('reservations')
        .update({
          is_validated: true,
          validated_at: new Date().toISOString(),
        })
        .eq('id', reservation.id);

      if (updateError) {
        playErrorSound();
        setState({
          isValid: false,
          message: 'Erreur lors de la validation. Réessayez.',
          isLoading: false,
        });
        return;
      }

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
      setState({
        isValid: false,
        message: 'Erreur de connexion. Vérifiez votre réseau.',
        isLoading: false,
      });
    }
  }, []);

  const reset = useCallback(() => {
    setState({
      isValid: null,
      clientName: undefined,
      numberOfPersons: undefined,
      message: undefined,
      isLoading: false,
    });
  }, []);

  return {
    ...state,
    validateQRCode,
    reset,
  };
};
