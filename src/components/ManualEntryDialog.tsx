import { useEffect, useMemo, useState } from 'react';
import { Search, UserCheck, Loader2, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Reservation {
  id: string;
  client_name: string;
  client_email: string | null;
  number_of_persons: number;
  is_validated: boolean;
  validated_at: string | null;
  payment_method: string | null;
  payment_status: string | null;
  amount: number | null;
}

interface ManualEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onValidated?: () => void;
}

const ManualEntryDialog = ({ open, onOpenChange, onValidated }: ManualEntryDialogProps) => {
  const [query, setQuery] = useState('');
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(false);
  const [validatingId, setValidatingId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setReservations([]);
      return;
    }

    const fetchToday = async () => {
      setLoading(true);
      const today = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from('reservations')
        .select(
          'id, client_name, client_email, number_of_persons, is_validated, validated_at, payment_method, payment_status, amount'
        )
        .eq('event_date', today)
        .order('client_name', { ascending: true });

      if (error) {
        toast.error('Impossible de charger les réservations du jour');
      } else {
        setReservations(data ?? []);
      }
      setLoading(false);
    };

    fetchToday();
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return reservations;
    return reservations.filter(
      (r) =>
        r.client_name.toLowerCase().includes(q) ||
        (r.client_email ?? '').toLowerCase().includes(q)
    );
  }, [query, reservations]);

  const handleValidate = async (reservation: Reservation) => {
    // Vérifications côté client (la RLS protège côté serveur)
    if (reservation.is_validated) {
      toast.error('Ce ticket a déjà été utilisé');
      return;
    }
    if (reservation.payment_method === 'card' && reservation.payment_status !== 'paid') {
      toast.error('Paiement CB non confirmé — validation impossible');
      return;
    }

    setValidatingId(reservation.id);
    const { error } = await supabase
      .from('reservations')
      .update({ is_validated: true, validated_at: new Date().toISOString() })
      .eq('id', reservation.id);

    if (error) {
      toast.error('Erreur lors de la validation');
      setValidatingId(null);
      return;
    }

    // Notifier les autres staff (déclenche aussi le push)
    await supabase.from('scan_notifications').insert({
      client_name: reservation.client_name,
      source_kind: 'manual',
      source_record_id: reservation.id,
    });

    toast.success(`✅ ${reservation.client_name} validé manuellement`);
    setValidatingId(null);
    onValidated?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-primary" />
            Valider sans QR
          </DialogTitle>
          <DialogDescription>
            Recherchez l'invité par son nom ou son email pour valider son entrée manuellement.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Nom ou email…"
            className="pl-9"
            maxLength={100}
          />
        </div>

        <div className="flex-1 overflow-y-auto -mx-1 px-1">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Chargement…
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              {reservations.length === 0
                ? 'Aucune réservation pour ce soir.'
                : 'Aucun invité ne correspond à votre recherche.'}
            </div>
          ) : (
            <ul className="space-y-2">
              {filtered.map((r) => {
                const blocked =
                  r.payment_method === 'card' && r.payment_status !== 'paid';
                const isValidating = validatingId === r.id;
                return (
                  <li
                    key={r.id}
                    className={cn(
                      'flex items-center gap-3 p-3 rounded-lg border transition-colors',
                      r.is_validated
                        ? 'border-primary/30 bg-primary/5'
                        : blocked
                        ? 'border-destructive/30 bg-destructive/5'
                        : 'border-border hover:border-primary/40'
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground truncate">
                          {r.client_name}
                        </span>
                        <span className="text-xs text-muted-foreground shrink-0">
                          ×{r.number_of_persons}
                        </span>
                      </div>
                      {r.client_email && (
                        <p className="text-xs text-muted-foreground truncate">
                          {r.client_email}
                        </p>
                      )}
                      {r.is_validated && (
                        <p className="text-xs text-primary mt-0.5 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Déjà entré
                          {r.validated_at &&
                            ` · ${new Date(r.validated_at).toLocaleTimeString('fr-FR', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}`}
                        </p>
                      )}
                      {blocked && !r.is_validated && (
                        <p className="text-xs text-destructive mt-0.5 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          Paiement CB non confirmé
                        </p>
                      )}
                    </div>

                    {r.is_validated ? (
                      <span className="text-xs font-medium text-primary shrink-0">
                        ✓ Validé
                      </span>
                    ) : blocked ? (
                      <XCircle className="w-5 h-5 text-destructive shrink-0" />
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => handleValidate(r)}
                        disabled={isValidating}
                        className="shrink-0"
                      >
                        {isValidating ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          'Valider'
                        )}
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ManualEntryDialog;
