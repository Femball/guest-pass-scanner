import { useState } from 'react';
import { motion } from 'framer-motion';
import { QrCode, Users, LogOut, UserCheck } from 'lucide-react';
import QRScanner from '@/components/QRScanner';
import ValidationResult from '@/components/ValidationResult';
import OccupancyGauge from '@/components/OccupancyGauge';
import ManualEntryDialog from '@/components/ManualEntryDialog';
import OfflineBanner from '@/components/OfflineBanner';
import { useReservationValidator } from '@/hooks/useReservationValidator';
import { useAuth } from '@/hooks/useAuth';
import { useOccupancy } from '@/hooks/useOccupancy';
import { useOfflineCache } from '@/hooks/useOfflineCache';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
const Index = () => {
  const [isScanning, setIsScanning] = useState(true);
  const [manualOpen, setManualOpen] = useState(false);
  const { hasAdminPrivileges, signOut } = useAuth();
  const { validated, expected, refresh: refreshOccupancy } = useOccupancy();
  const { isOnline, syncedAt, reservationsCount } = useOfflineCache();
  const {
    isValid,
    clientName,
    message,
    amount,
    paymentMethod,
    paymentStatus,
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
    refreshOccupancy();
  };
  return <div className="min-h-screen bg-background flex flex-col">
      <OfflineBanner isOnline={isOnline} syncedAt={syncedAt} reservationsCount={reservationsCount} />
      {/* Header */}
      <motion.header className="px-4 py-3 md:px-6 md:py-4 flex items-center justify-between border-b border-border" initial={{
      opacity: 0,
      y: -20
    }} animate={{
      opacity: 1,
      y: 0
    }}>
        <div className="items-center gap-2 md:gap-3 flex flex-row">
          <div className="p-1.5 md:p-2 rounded-xl bg-primary/10">
            <QrCode className="w-5 h-5 md:w-6 md:h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-base md:text-lg font-bold text-foreground">L'Access</h1>
            <p className="text-[10px] md:text-xs text-muted-foreground">Contrôle d'accès</p>
          </div>
        </div>
        <div className="flex items-center gap-1 md:gap-2">
          {hasAdminPrivileges &&
        <Link to="/admin">
              <Button variant="outline" size="sm" className="gap-1.5 md:gap-2 h-9 md:h-9 text-xs md:text-sm px-2.5 md:px-3">
                <Users className="w-3.5 h-3.5 md:w-4 md:h-4" />
                Admin
              </Button>
            </Link>
        }
          <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 md:h-10 md:w-10"
          onClick={async () => {
            await signOut();
            toast.success('Déconnexion réussie');
          }}
          title="Se déconnecter">
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </motion.header>

      {/* Main content */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 md:p-6 bg-black">
        {isLoading ? <motion.div className="flex flex-col items-center gap-4" initial={{
        opacity: 0
      }} animate={{
        opacity: 1
      }}>
            <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-muted-foreground">Vérification en cours...</p>
          </motion.div> : isValid === null ? <>
            <motion.div className="text-center mb-4 md:mb-8" initial={{
          opacity: 0,
          y: 20
        }} animate={{
          opacity: 1,
          y: 0
        }}>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 rounded-full bg-primary/10 text-primary mb-3 md:mb-4">
                <QrCode className="w-3.5 h-3.5 md:w-4 md:h-4" />
                <span className="text-xs md:text-sm font-medium">Scanner actif</span>
              </div>
              <h2 className="text-xl md:text-2xl font-bold text-foreground mb-1 md:mb-2">
                Scannez le QR Code
              </h2>
              <p className="text-sm md:text-base text-muted-foreground">
                Positionnez le code dans le cadre
              </p>
            </motion.div>

            <QRScanner onScan={handleScan} isScanning={isScanning} />

            {/* Jauge d'occupation */}
            <motion.div
              className="w-full max-w-sm mt-4"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <OccupancyGauge validated={validated} expected={expected} />
            </motion.div>

            {/* Bouton de validation manuelle */}
            <motion.div
              className="w-full max-w-sm mt-3"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <Button
                variant="outline"
                className="w-full gap-2 bg-background/80 backdrop-blur-sm"
                onClick={() => setManualOpen(true)}
                disabled={!isOnline}
                title={!isOnline ? 'Indisponible hors-ligne' : undefined}
              >
                <UserCheck className="w-4 h-4" />
                {isOnline ? 'Valider sans QR (téléphone cassé, etc.)' : 'Validation manuelle indisponible hors-ligne'}
              </Button>
            </motion.div>

            <motion.p className="mt-4 md:mt-6 text-xs md:text-sm text-muted-foreground text-center" initial={{
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

      {/* Modale de validation manuelle */}
      <ManualEntryDialog
        open={manualOpen}
        onOpenChange={setManualOpen}
        onValidated={refreshOccupancy}
      />

      {/* Validation overlay */}
      <ValidationResult isValid={isValid} clientName={clientName} message={message} amount={amount} paymentMethod={paymentMethod} paymentStatus={paymentStatus} onReset={handleReset} />
    </div>;
};
export default Index;