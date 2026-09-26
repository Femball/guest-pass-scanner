import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, User, CreditCard, Banknote, RotateCcw, Armchair } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { SeatInfo } from '@/hooks/useReservationValidator';

interface ValidationResultProps {
  isValid: boolean | null;
  clientName?: string;
  message?: string;
  amount?: number | null;
  paymentMethod?: string | null;
  paymentStatus?: string | null;
  seat?: SeatInfo;
  onConfirmSeat?: () => Promise<unknown>;
  onReset: () => void;
}

const ValidationResult = ({ isValid, clientName, message, amount, paymentMethod, paymentStatus, seat, onConfirmSeat, onReset }: ValidationResultProps) => {
  const [confirmed, setConfirmed] = useState(false);
  const [seating, setSeating] = useState(false);

  if (isValid === null) return null;

  const handleConfirm = () => {
    setConfirmed(true);
    setTimeout(() => {
      setConfirmed(false);
      onReset();
    }, 300);
  };

  const hasPaid = amount != null && amount > 0 && paymentStatus === 'paid';
  const hasPending = amount != null && amount > 0 && paymentStatus === 'pending';

  return (
    <AnimatePresence>
      <motion.div
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        className={`fixed inset-0 z-50 flex flex-col items-center justify-center p-4 md:p-8 ${
          isValid ? 'validation-valid' : 'validation-invalid'
        }`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
      >
        <span className="sr-only">
          {isValid ? 'Accès autorisé' : 'Accès refusé'}
          {clientName && isValid ? `, ${clientName}` : ''}
          {message ? `. ${message}` : ''}
        </span>
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ 
            type: 'spring',
            stiffness: 200,
            damping: 15,
            delay: 0.1
          }}
        >
          {isValid ? (
            <CheckCircle className="w-24 h-24 md:w-32 md:h-32 mb-4 md:mb-8" strokeWidth={1.5} />
          ) : (
            <XCircle className="w-24 h-24 md:w-32 md:h-32 mb-4 md:mb-8" strokeWidth={1.5} />
          )}
        </motion.div>

        <motion.h1
          className="text-2xl md:text-4xl font-bold mb-3 md:mb-4 text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          {isValid ? 'ACCÈS AUTORISÉ' : 'ACCÈS REFUSÉ'}
        </motion.h1>

        {clientName && isValid && (
          <motion.div
            className="flex items-center gap-2 md:gap-3 text-lg md:text-2xl mb-3 md:mb-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <User className="w-6 h-6 md:w-8 md:h-8" />
            <span className="font-semibold">{clientName}</span>
          </motion.div>
        )}

        {/* Payment info */}
        {isValid && amount != null && amount > 0 && (
          <motion.div
            className="flex items-center gap-2 md:gap-3 text-base md:text-xl mb-3 md:mb-4 px-4 md:px-6 py-2 md:py-3 rounded-xl bg-white/20 backdrop-blur-sm"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
          >
            {paymentMethod === 'card' ? (
              <CreditCard className="w-6 h-6" />
            ) : (
              <Banknote className="w-6 h-6" />
            )}
            <span className="font-bold">{amount.toFixed(2)}€</span>
            <span className="text-sm md:text-lg opacity-80">
              {hasPaid ? '✅ Payé' : hasPending ? '⏳ En attente' : '❌ Échoué'}
            </span>
          </motion.div>
        )}

        {seat && (seat.rows || seat.numbers) && (
          <div className="mb-4 md:mb-6 w-full max-w-sm rounded-2xl bg-white/20 backdrop-blur-sm px-5 py-4 text-center">
            <div className="flex items-center justify-center gap-2 text-sm uppercase tracking-wider opacity-80 mb-2">
              <Armchair className="w-5 h-5" aria-hidden="true" /> Placement
            </div>
            <div className="flex justify-center gap-6">
              {seat.rows && (
                <div>
                  <div className="text-xs opacity-80">Rangée</div>
                  <div className="text-3xl md:text-4xl font-extrabold">{seat.rows}</div>
                </div>
              )}
              {seat.numbers && (
                <div>
                  <div className="text-xs opacity-80">Chaise(s)</div>
                  <div className="text-3xl md:text-4xl font-extrabold">{seat.numbers}</div>
                </div>
              )}
            </div>
            {onConfirmSeat && (
              seat.seatedAt ? (
                <p className="mt-3 font-semibold">✅ Placé à {new Date(seat.seatedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</p>
              ) : (
                <Button
                  type="button"
                  size="lg"
                  disabled={seating}
                  onClick={async () => { setSeating(true); await onConfirmSeat(); setSeating(false); }}
                  className="mt-3 min-h-12 w-full gap-2 bg-white/30 hover:bg-white/40 text-current border border-white/50 font-semibold"
                >
                  <Armchair className="w-5 h-5" aria-hidden="true" />
                  {seating ? 'Enregistrement…' : 'Valider le placement'}
                </Button>
              )
            )}
          </div>
        )}


        <motion.p
          className="text-base md:text-xl opacity-90 text-center mb-4 md:mb-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.9 }}
          transition={{ delay: 0.4 }}
        >
          {message}
        </motion.p>

        <motion.div
          className="flex flex-col sm:flex-row items-center gap-3"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Button
            size="lg"
            variant="outline"
            type="button"
            onClick={handleConfirm}
            disabled={confirmed}
            aria-label="Confirmer ce résultat et revenir au scanner"
            className="min-h-12 text-base md:text-lg px-6 md:px-8 py-4 md:py-6 bg-white/20 border-white/40 hover:bg-white/30 text-current font-semibold focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2"
          >
            {confirmed ? 'OK ✓' : '✋ Confirmer et scanner suivant'}
          </Button>
          <Button
            size="lg"
            variant="ghost"
            type="button"
            onClick={onReset}
            disabled={confirmed}
            aria-label="Rescanner immédiatement un autre QR code"
            className="min-h-12 gap-2 text-base px-5 py-4 border border-white/40 text-current hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2"
          >
            <RotateCcw className="w-5 h-5" aria-hidden="true" />
            Rescanner
          </Button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ValidationResult;
