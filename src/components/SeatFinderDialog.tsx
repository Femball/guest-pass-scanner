import { useState } from 'react';
import { Armchair, Loader2, Search, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { loadCache, searchSpecials } from '@/lib/offlineCache';
import { queueOfflineSeat } from '@/hooks/useReservationValidator';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';

interface SeatResult {
  id: string;
  guest_names: string;
  number_of_persons: number;
  seat_rows: string | null;
  seat_numbers: string | null;
  seated_at: string | null;
  validated_at: string | null;
  event_title: string;
}

const SeatFinderDialog = ({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SeatResult[] | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [seating, setSeating] = useState<string | null>(null);
  const isOnline = useNetworkStatus();

  const search = async () => {
    if (query.trim().length < 2) return;
    setLoading(true);
    setResults(null);
    setInfo(null);
    if (!navigator.onLine) {
      const found = searchSpecials(await loadCache(), query);
      setLoading(false);
      if (!found.length) { setInfo('📵 Hors-ligne — aucune réservation correspondante dans le cache.'); return; }
      setResults(found.map((b) => ({ ...b })));
      setInfo('📵 Hors-ligne — recherche locale. Vérifiez l’identité du client.');
      return;
    }
    const { data, error } = await supabase.functions.invoke('find-seat', { body: { query } });
    setLoading(false);
    if (error || data?.error) {
      let msg = data?.error;
      try { msg = msg || (await (error as any)?.context?.json())?.error; } catch { /* ignore */ }
      setInfo(msg || 'Recherche impossible.');
      return;
    }
    if (!data?.found) { setInfo(data?.message || 'Aucune réservation trouvée.'); return; }
    setResults(data.results);
    if (!data.confident) setInfo('Correspondance incertaine — vérifiez l’identité du client.');
  };

  const seat = async (id: string) => {
    setSeating(id);
    if (!navigator.onLine) {
      const r = results?.find((x) => x.id === id);
      const now = await queueOfflineSeat(id, r?.guest_names ?? '');
      setSeating(null);
      toast.success('Placement enregistré hors-ligne — synchronisé au retour du réseau');
      setResults((prev) => prev?.map((x) => (x.id === id ? { ...x, seated_at: now } : x)) ?? null);
      return;
    }
    const { data, error } = await supabase.rpc('seat_special_booking', { p_id: id });
    setSeating(null);
    if (error) return toast.error('Placement non enregistré');
    toast.success('Placement validé');
    setResults((prev) => prev?.map((r) => (r.id === id ? { ...r, seated_at: data as string } : r)) ?? null);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) { setResults(null); setInfo(null); setQuery(''); } }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Armchair className="w-5 h-5" /> Retrouver une place</DialogTitle>
          <DialogDescription>
            Saisissez ce que vous savez (nom, prénom, téléphone, code…). {isOnline ? 'L’IA retrouve la réservation de ce soir.' : 'Hors-ligne : recherche dans les réservations mises en cache.'}
          </DialogDescription>
        </DialogHeader>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); search(); }}>
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ex : Mme Dupont, 06 12…" maxLength={500} autoFocus />
          <Button type="submit" disabled={loading || query.trim().length < 2} className="gap-1.5 min-h-10">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Chercher
          </Button>
        </form>
        {info && <p className="text-sm text-muted-foreground">{info}</p>}
        <div className="space-y-3">
          {results?.map((r) => (
            <div key={r.id} className="rounded-xl border border-border p-4">
              <p className="font-semibold text-foreground">{r.guest_names}</p>
              <p className="text-xs text-muted-foreground mb-3">{r.event_title} · {r.number_of_persons} pers.{r.validated_at ? ' · entré' : ''}</p>
              {r.seat_rows || r.seat_numbers ? (
                <div className="flex justify-center gap-8 mb-3">
                  <div className="text-center"><div className="text-xs text-muted-foreground">Rangée</div><div className="text-3xl font-extrabold text-primary">{r.seat_rows || '—'}</div></div>
                  <div className="text-center"><div className="text-xs text-muted-foreground">Table(s)</div><div className="text-3xl font-extrabold text-primary">{r.seat_numbers || '—'}</div></div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground mb-3">Aucune place attribuée.</p>
              )}
              {r.seated_at ? (
                <p className="text-sm font-medium flex items-center gap-1.5 text-primary"><CheckCircle2 className="w-4 h-4" /> Placé à {new Date(r.seated_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</p>
              ) : (r.seat_rows || r.seat_numbers) ? (
                <Button className="w-full gap-2 min-h-11" disabled={seating === r.id} onClick={() => seat(r.id)}>
                  {seating === r.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Armchair className="w-4 h-4" />} Valider le placement
                </Button>
              ) : null}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SeatFinderDialog;
