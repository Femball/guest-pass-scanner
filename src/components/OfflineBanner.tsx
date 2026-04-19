import { WifiOff, Wifi } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface OfflineBannerProps {
  isOnline: boolean;
  syncedAt: string | null;
  reservationsCount: number;
}

const formatTime = (iso: string | null) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
};

const OfflineBanner = ({ isOnline, syncedAt, reservationsCount }: OfflineBannerProps) => {
  return (
    <AnimatePresence>
      {!isOnline && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="bg-destructive/15 border-b border-destructive/30 text-destructive-foreground"
        >
          <div className="px-4 py-2 flex items-center justify-between gap-3 text-xs md:text-sm">
            <div className="flex items-center gap-2 text-destructive">
              <WifiOff className="w-4 h-4" />
              <span className="font-medium">Mode hors-ligne — lecture seule</span>
            </div>
            <div className="text-muted-foreground hidden sm:flex items-center gap-1">
              <Wifi className="w-3 h-3" />
              <span>
                {reservationsCount} ticket{reservationsCount > 1 ? 's' : ''} en cache · sync{' '}
                {formatTime(syncedAt)}
              </span>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default OfflineBanner;
