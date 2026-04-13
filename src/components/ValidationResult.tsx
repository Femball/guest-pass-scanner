import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, User, CreditCard, Banknote } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ValidationResultProps {
  isValid: boolean | null;
  clientName?: string;
  message?: string;
  amount?: number | null;
  paymentMethod?: string | null;
  paymentStatus?: string | null;
  onReset: () => void;
}

const ValidationResult = ({ isValid, clientName, message, amount, paymentMethod, paymentStatus, onReset }: ValidationResultProps) => {
  const [confirmed, setConfirmed] = useState(false);

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
        className={`fixed inset-0 z-50 flex flex-col items-center justify-center p-8 ${
          isValid ? 'validation-valid' : 'validation-invalid'
        }`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
      >
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
            <CheckCircle className="w-32 h-32 mb-8" strokeWidth={1.5} />
          ) : (
            <XCircle className="w-32 h-32 mb-8" strokeWidth={1.5} />
          )}
        </motion.div>

        <motion.h1
          className="text-4xl font-bold mb-4 text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          {isValid ? 'ACCÈS AUTORISÉ' : 'ACCÈS REFUSÉ'}
        </motion.h1>

        {clientName && isValid && (
          <motion.div
            className="flex items-center gap-3 text-2xl mb-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <User className="w-8 h-8" />
            <span className="font-semibold">{clientName}</span>
          </motion.div>
        )}

        {/* Payment info */}
        {isValid && amount != null && amount > 0 && (
          <motion.div
            className="flex items-center gap-3 text-xl mb-4 px-6 py-3 rounded-xl bg-white/20 backdrop-blur-sm"
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
            <span className="text-lg opacity-80">
              {hasPaid ? '✅ Payé' : hasPending ? '⏳ En attente' : '❌ Échoué'}
            </span>
          </motion.div>
        )}

        <motion.p
          className="text-xl opacity-90 text-center mb-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.9 }}
          transition={{ delay: 0.4 }}
        >
          {message}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Button
            size="lg"
            variant="outline"
            onClick={handleConfirm}
            disabled={confirmed}
            className="text-lg px-8 py-6 bg-white/20 border-white/40 hover:bg-white/30 text-current font-semibold"
          >
            {confirmed ? 'OK ✓' : '✋ Confirmer et scanner suivant'}
          </Button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ValidationResult;
