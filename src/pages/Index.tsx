import { useState } from 'react';
import { motion } from 'framer-motion';
import { Shield, QrCode, Users } from 'lucide-react';
import QRScanner from '@/components/QRScanner';
import ValidationResult from '@/components/ValidationResult';
import { useReservationValidator } from '@/hooks/useReservationValidator';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
const Index = () => {
  const [isScanning, setIsScanning] = useState(true);
  const {
    isValid,
    clientName,
    message,
    isLoading,
    validateQRCode,
    reset
  } = useReservationValidator();
  const handleScan = async (qrCode: string) => {
    setIsScanning(false);
    await validateQRCode(qrCode);
  };
  const handleReset = () => {
    reset();
    setIsScanning(true);
  };
  return <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <motion.header className="px-6 py-4 flex items-center justify-between border-b border-border" initial={{
      opacity: 0,
      y: -20
    }} animate={{
      opacity: 1,
      y: 0
    }}>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/10">
            <Shield className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">SecuriScan</h1>
            <p className="text-xs text-muted-foreground">Contrôle d'accès</p>
          </div>
        </div>
        <Link to="/admin">
          <Button variant="outline" size="sm" className="gap-2">
            <Users className="w-4 h-4" />
            Admin
          </Button>
        </Link>
      </motion.header>

      {/* Main content */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 bg-black">
        {isLoading ? <motion.div className="flex flex-col items-center gap-4" initial={{
        opacity: 0
      }} animate={{
        opacity: 1
      }}>
            <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-muted-foreground">Vérification en cours...</p>
          </motion.div> : isValid === null ? <>
            <motion.div className="text-center mb-8" initial={{
          opacity: 0,
          y: 20
        }} animate={{
          opacity: 1,
          y: 0
        }}>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary mb-4">
                <QrCode className="w-4 h-4" />
                <span className="text-sm font-medium">Scanner actif</span>
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-2">
                Scannez le QR Code
              </h2>
              <p className="text-muted-foreground">
                Positionnez le code dans le cadre
              </p>
            </motion.div>

            <QRScanner onScan={handleScan} isScanning={isScanning} />

            <motion.p className="mt-8 text-sm text-muted-foreground text-center" initial={{
          opacity: 0
        }} animate={{
          opacity: 1
        }} transition={{
          delay: 0.5
        }}>
              Le résultat s'affichera automatiquement
            </motion.p>
          </> : null}
      </main>

      {/* Validation overlay */}
      <ValidationResult isValid={isValid} clientName={clientName} message={message} onReset={handleReset} />
    </div>;
};
export default Index;