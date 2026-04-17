import { useState } from 'react';
import { CheckCircle2, User } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface ArrivalAlertProps {
  clientName: string;
  onDismiss: () => void;
}

const ArrivalAlert = ({ clientName, onDismiss }: ArrivalAlertProps) => {
  const [now] = useState(() => new Date());

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center p-6 bg-emerald-600 text-white animate-in fade-in zoom-in-95 duration-300 cursor-pointer"
      onClick={onDismiss}
      role="alertdialog"
      aria-label={`Arrivée de ${clientName}`}
    >
      <CheckCircle2 className="w-32 h-32 md:w-48 md:h-48 mb-6 animate-in zoom-in duration-500" strokeWidth={1.5} />
      <p className="text-xl md:text-3xl font-medium opacity-90 mb-2">🚶 Nouvelle arrivée</p>
      <div className="flex items-center gap-3 mb-4">
        <User className="w-8 h-8 md:w-10 md:h-10" />
        <h1 className="text-3xl md:text-6xl font-bold text-center break-words">{clientName}</h1>
      </div>
      <p className="text-lg md:text-2xl opacity-90 mb-8">Vient de scanner son ticket à l'entrée</p>
      <p className="text-base md:text-xl font-mono opacity-80">
        {format(now, "HH:mm:ss", { locale: fr })}
      </p>
      <p className="mt-10 text-base md:text-xl opacity-80 font-medium">👆 Touchez l'écran pour fermer</p>
    </div>
  );
};

export default ArrivalAlert;
