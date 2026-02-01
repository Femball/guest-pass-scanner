import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, User, Clock } from 'lucide-react';

interface ValidationResultProps {
  isValid: boolean | null;
  clientName?: string;
  message?: string;
  onReset: () => void;
}

const ValidationResult = ({ isValid, clientName, message, onReset }: ValidationResultProps) => {
  if (isValid === null) return null;

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
        onClick={onReset}
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

        <motion.p
          className="text-xl opacity-90 text-center mb-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.9 }}
          transition={{ delay: 0.4 }}
        >
          {message}
        </motion.p>

        <motion.div
          className="flex items-center gap-2 text-lg opacity-70"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.7 }}
          transition={{ delay: 0.5 }}
        >
          <Clock className="w-5 h-5" />
          <span>Appuyez pour scanner un autre code</span>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ValidationResult;
