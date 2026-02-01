import { Scanner } from '@yudiel/react-qr-scanner';
import { motion } from 'framer-motion';

interface QRScannerProps {
  onScan: (result: string) => void;
  isScanning: boolean;
}

const QRScanner = ({ onScan, isScanning }: QRScannerProps) => {
  const handleScan = (result: { rawValue: string }[]) => {
    if (result && result.length > 0 && result[0].rawValue) {
      onScan(result[0].rawValue);
    }
  };

  return (
    <motion.div 
      className="relative w-full max-w-sm mx-auto aspect-square rounded-2xl overflow-hidden"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
    >
      {isScanning && (
        <>
          <Scanner
            onScan={handleScan}
            formats={['qr_code']}
            styles={{
              container: {
                width: '100%',
                height: '100%',
              },
              video: {
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              },
            }}
          />
          
          {/* Scanner frame overlay */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute inset-8 scanner-frame rounded-2xl" />
            
            {/* Scanning line animation */}
            <motion.div 
              className="absolute left-8 right-8 h-0.5 bg-primary rounded-full pulse-scan"
              initial={{ top: '15%' }}
              animate={{ top: ['15%', '85%', '15%'] }}
              transition={{ 
                duration: 2,
                repeat: Infinity,
                ease: 'easeInOut'
              }}
            />
            
            {/* Corner accents */}
            <div className="absolute top-8 left-8 w-8 h-8 border-l-4 border-t-4 border-primary rounded-tl-lg" />
            <div className="absolute top-8 right-8 w-8 h-8 border-r-4 border-t-4 border-primary rounded-tr-lg" />
            <div className="absolute bottom-8 left-8 w-8 h-8 border-l-4 border-b-4 border-primary rounded-bl-lg" />
            <div className="absolute bottom-8 right-8 w-8 h-8 border-r-4 border-b-4 border-primary rounded-br-lg" />
          </div>
        </>
      )}
    </motion.div>
  );
};

export default QRScanner;
