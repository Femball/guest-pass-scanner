import { CheckCircle2, History, Trash2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ScanHistoryEntry } from '@/hooks/useScanHistory';

interface ScanHistoryProps {
  history: ScanHistoryEntry[];
  onClear: () => void;
}

const formatTime = (iso: string) => {
  try {
    return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return '--:--';
  }
};

const ScanHistory = ({ history, onClear }: ScanHistoryProps) => {
  return (
    <section
      aria-labelledby="scan-history-title"
      className="w-full max-w-sm rounded-xl border border-border bg-background/80 backdrop-blur-sm p-3"
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <h2 id="scan-history-title" className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <History className="w-4 h-4" aria-hidden="true" />
          Scans récents
        </h2>
        {history.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-9 gap-1.5 text-xs text-muted-foreground"
            onClick={onClear}
            aria-label="Effacer l'historique des scans récents"
          >
            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
            Effacer
          </Button>
        )}
      </div>

      {history.length === 0 ? (
        <p className="text-xs text-muted-foreground">Aucun scan enregistré pour le moment.</p>
      ) : (
        <ul className="flex flex-col gap-1.5 max-h-56 overflow-y-auto" aria-live="polite">
          {history.map((entry) => (
            <li
              key={entry.id}
              className="flex items-start gap-2 rounded-lg border border-border/60 px-2.5 py-2"
            >
              {entry.isValid ? (
                <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-primary" aria-hidden="true" />
              ) : (
                <XCircle className="w-4 h-4 mt-0.5 shrink-0 text-destructive" aria-hidden="true" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-foreground truncate">
                  {entry.clientName || 'Client inconnu'}
                </p>
                {entry.message && (
                  <p className="text-[11px] text-muted-foreground line-clamp-2">{entry.message}</p>
                )}
              </div>
              <div className="text-right shrink-0">
                <p className="text-[11px] font-mono text-muted-foreground">
                  <time dateTime={entry.at}>{formatTime(entry.at)}</time>
                </p>
                <p className={`text-[11px] font-semibold ${entry.isValid ? 'text-primary' : 'text-destructive'}`}>
                  {entry.isValid ? 'Validé' : 'Refusé'}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

export default ScanHistory;
