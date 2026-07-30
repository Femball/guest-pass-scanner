import { format } from 'date-fns';
import { MessageSquare, Phone, Send, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import type { PendingSms, Reservation } from '@/types/admin';

interface BulkSmsSelectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventDate: string | null;
  eligible: Reservation[];
  selected: Set<string>;
  onSelectedChange: (next: Set<string>) => void;
  onStart: () => void;
}

export const BulkSmsSelectDialog = ({
  open,
  onOpenChange,
  eventDate,
  eligible,
  selected,
  onSelectedChange,
  onStart,
}: BulkSmsSelectDialogProps) => {
  const allChecked = eligible.length > 0 && eligible.every((r) => selected.has(r.id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" /> Envoi SMS multiple
          </DialogTitle>
          <DialogDescription>
            {eventDate && `Soirée du ${format(new Date(eventDate + 'T00:00:00'), 'dd/MM/yyyy')}. `}
            Sélectionnez les clients à qui renvoyer le ticket par SMS.
          </DialogDescription>
        </DialogHeader>
        {eventDate && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                {selected.size} / {eligible.length} sélectionné(s)
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() =>
                  onSelectedChange(allChecked ? new Set() : new Set(eligible.map((r) => r.id)))
                }
              >
                {allChecked ? 'Tout désélectionner' : 'Tout sélectionner'}
              </Button>
            </div>
            <div className="border rounded-md divide-y max-h-[50vh] overflow-y-auto">
              {eligible.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">Aucun client avec téléphone</p>
              )}
              {eligible.map((r) => (
                <label key={r.id} className="flex items-center gap-3 p-3 cursor-pointer hover:bg-secondary/40">
                  <Checkbox
                    checked={selected.has(r.id)}
                    onCheckedChange={(c) => {
                      const next = new Set(selected);
                      if (c) next.add(r.id);
                      else next.delete(r.id);
                      onSelectedChange(next);
                    }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{r.client_name}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Phone className="w-3 h-3" /> {r.client_phone}
                    </p>
                  </div>
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Annuler
              </Button>
              <Button onClick={onStart} disabled={selected.size === 0}>
                Lancer ({selected.size})
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

interface BulkSmsQueueDialogProps {
  queue: Reservation[] | null;
  index: number;
  onStop: () => void;
  onSend: () => void;
  onNext: () => void;
}

export const BulkSmsQueueDialog = ({ queue, index, onStop, onSend, onNext }: BulkSmsQueueDialogProps) => {
  const current = queue?.[index];

  return (
    <Dialog open={!!queue} onOpenChange={(open) => { if (!open) onStop(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="w-5 h-5" /> Envoi en cours
          </DialogTitle>
          <DialogDescription>Envoyez chaque SMS depuis votre app, puis passez au suivant.</DialogDescription>
        </DialogHeader>
        {queue && current && (
          <div className="space-y-4">
            <div className="text-xs text-muted-foreground text-center">
              Client {index + 1} sur {queue.length}
            </div>
            <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
              <div
                className="bg-primary h-2 transition-all"
                style={{ width: `${((index + 1) / queue.length) * 100}%` }}
              />
            </div>
            <div className="p-4 rounded-lg border bg-secondary/40 text-center">
              <p className="font-semibold text-base">{current.client_name}</p>
              <p className="text-sm text-muted-foreground flex items-center justify-center gap-1 mt-1">
                <Phone className="w-3.5 h-3.5" /> {current.client_phone}
              </p>
            </div>
            <Button className="w-full" onClick={onSend}>
              <MessageSquare className="w-4 h-4 mr-2" /> Ouvrir le SMS
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={onNext}>
                {index + 1 >= queue.length ? 'Terminer' : 'Suivant'}
              </Button>
              <Button variant="ghost" onClick={onStop}>
                Arrêter
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

interface PendingSmsDialogProps {
  pendingSms: PendingSms | null;
  onClose: () => void;
  onShareQr: (payload: PendingSms) => void;
}

export const PendingSmsDialog = ({ pendingSms, onClose, onShareQr }: PendingSmsDialogProps) => (
  <Dialog open={!!pendingSms} onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5" />
          SMS prêt
        </DialogTitle>
        <DialogDescription>
          Si l'application SMS ne s'est pas ouverte automatiquement, appuyez sur le bouton ci-dessous.
        </DialogDescription>
      </DialogHeader>
      {pendingSms && (
        <div className="space-y-3">
          {pendingSms.qrCodes.length > 0 && (
            <Button type="button" className="w-full" onClick={() => onShareQr(pendingSms)}>
              Partager le QR (image) via Messages
            </Button>
          )}
          <Button asChild className="w-full">
            <a href={pendingSms.url}>Ouvrir SMS (texte uniquement)</a>
          </Button>
          {pendingSms.isIOS && (
            <Button asChild variant="outline" className="w-full">
              <a href={pendingSms.fallbackUrl}>Essayer le format iOS alternatif</a>
            </Button>
          )}
          <Button asChild variant="outline" className="w-full">
            <a href={pendingSms.recipientOnlyUrl}>Ouvrir SMS avec le numéro seul</a>
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => {
              navigator.clipboard
                ?.writeText(pendingSms.body)
                .then(() => toast.success('Message copié'))
                .catch(() => toast.error('Copie impossible sur cet appareil'));
            }}
          >
            <Copy className="w-4 h-4 mr-2" />
            Copier le message
          </Button>
        </div>
      )}
    </DialogContent>
  </Dialog>
);
