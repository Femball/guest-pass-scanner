import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useScanSounds } from './useScanSounds';

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

    try {
      // Rechercher la réservation par QR code
      const { data: reservation, error } = await supabase
        .from('reservations')
        .select('*')
        .eq('qr_code', qrCode)
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
