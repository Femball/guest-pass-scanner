import { useEffect, useState } from 'react';
import { useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Star, MessageSquare, Check } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';

interface FeedbackRow {
  id: string;
  reservation_id: string;
  client_name: string;
  client_email: string | null;
  event_date: string;
  rating: number | null;
  comment: string | null;
  submitted_at: string | null;
  created_at: string;
  token: string;
}

const FeedbackList = () => {
  const [rows, setRows] = useState<FeedbackRow[]>([]);
  const [phones, setPhones] = useState<Record<string, string | null>>({});
  const [smsSent, setSmsSent] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const seenSubmittedRef = useRef<Set<string> | null>(null);

  const playFeedbackSound = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const notes = [
        { freq: 660, start: 0, end: 0.12 },
        { freq: 990, start: 0.12, end: 0.3 },
      ];
      notes.forEach(({ freq, start, end }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
        gain.gain.setValueAtTime(0, ctx.currentTime + start);
        gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + end);
        osc.start(ctx.currentTime + start);
        osc.stop(ctx.currentTime + end);
      });
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    const fetchRows = async () => {
      const { data, error } = await supabase
        .from('event_feedback')
        .select('id, reservation_id, client_name, client_email, event_date, rating, comment, submitted_at, created_at, token')
        .order('event_date', { ascending: false })
        .order('submitted_at', { ascending: false, nullsFirst: false });

      if (!error && data) {
        setRows(data as FeedbackRow[]);
        const submittedIds = new Set(
          (data as FeedbackRow[])
            .filter((r) => r.submitted_at !== null)
            .map((r) => r.id),
        );
        if (seenSubmittedRef.current === null) {
          seenSubmittedRef.current = submittedIds;
        } else {
          const newOnes = (data as FeedbackRow[]).filter(
            (r) => r.submitted_at !== null && !seenSubmittedRef.current!.has(r.id),
          );
          if (newOnes.length > 0) {
            playFeedbackSound();
            newOnes.forEach((r) => {
              toast({
                title: `⭐ Nouvel avis : ${r.client_name}`,
                description: `${r.rating ?? '?'} / 5${r.comment ? ` — « ${r.comment.slice(0, 80)}${r.comment.length > 80 ? '…' : ''} »` : ''}`,
              });
            });
          }
          seenSubmittedRef.current = submittedIds;
        }
        const ids = data.map((r: any) => r.reservation_id).filter(Boolean);
        if (ids.length) {
          const [{ data: resv }, { data: logs }] = await Promise.all([
            supabase.from('reservations').select('id, client_phone').in('id', ids),
            supabase
              .from('email_dispatch_log')
              .select('reservation_id')
              .in('reservation_id', ids)
              .eq('dispatch_type', 'feedback_d_plus_1_sms'),
          ]);
          const map: Record<string, string | null> = {};
          (resv ?? []).forEach((r: any) => (map[r.id] = r.client_phone));
          setPhones(map);
          setSmsSent(new Set((logs ?? []).map((l: any) => l.reservation_id)));
        }
      }
      setLoading(false);
    };
    fetchRows();
    const i = setInterval(fetchRows, 15000);
    return () => clearInterval(i);
  }, []);

  const sendSms = async (row: FeedbackRow) => {
    const phone = phones[row.reservation_id];
    if (!phone) {
      toast({ title: 'Pas de téléphone', description: 'Aucun numéro pour ce client.', variant: 'destructive' });
      return;
    }
    const url = `${window.location.origin}/feedback?token=${row.token}`;
    const body = `Bonjour ${row.client_name.split(' ')[0] || row.client_name}, merci d'être venu(e) à L'Access ! Votre avis nous aide : ${url}`;
    const sep = /iPhone|iPad|iPod|Mac/i.test(navigator.userAgent) ? '&' : '?';
    window.location.href = `sms:${phone}${sep}body=${encodeURIComponent(body)}`;
    const { error } = await supabase
      .from('email_dispatch_log')
      .insert({ reservation_id: row.reservation_id, dispatch_type: 'feedback_d_plus_1_sms' });
    if (!error) {
      setSmsSent((prev) => new Set(prev).add(row.reservation_id));
      toast({ title: 'SMS préparé', description: 'Envoi marqué pour éviter les doublons.' });
    }
  };

  const submitted = rows.filter((r) => r.submitted_at !== null);
  const pending = rows.filter((r) => r.submitted_at === null);
  const avg =
    submitted.length > 0
      ? (submitted.reduce((s, r) => s + (r.rating ?? 0), 0) / submitted.length).toFixed(2)
      : '—';

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Réponses</p>
          <p className="text-2xl font-bold text-foreground">{submitted.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">En attente</p>
          <p className="text-2xl font-bold text-foreground">{pending.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Note moyenne</p>
          <p className="text-2xl font-bold text-foreground">
            {avg}
            <span className="text-sm text-muted-foreground"> / 5</span>
          </p>
        </Card>
      </div>

      {submitted.length === 0 && pending.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          Aucun retour pour le moment. Les enquêtes sont envoyées automatiquement le lendemain de chaque soirée.
        </p>
      ) : (
        <div className="space-y-3">
          {submitted.map((r) => (
            <Card key={r.id} className="p-4 border-l-4 border-l-primary">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <p className="font-medium text-foreground">{r.client_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(r.event_date + 'T00:00:00').toLocaleDateString('fr-FR')} ·{' '}
                    {r.client_email}
                  </p>
                </div>
                <div className="flex items-center gap-0.5">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star
                      key={n}
                      className={`w-4 h-4 ${
                        n <= (r.rating ?? 0)
                          ? 'fill-primary text-primary'
                          : 'text-muted-foreground/30'
                      }`}
                    />
                  ))}
                </div>
              </div>
              {r.comment && (
                <p className="text-sm text-foreground bg-muted/50 rounded-md p-3 mt-2">
                  «&nbsp;{r.comment}&nbsp;»
                </p>
              )}
            </Card>
          ))}

          {pending.map((r) => (
            <Card key={r.id} className="p-3 opacity-60">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">{r.client_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(r.event_date + 'T00:00:00').toLocaleDateString('fr-FR')}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">En attente</Badge>
                  {phones[r.reservation_id] ? (
                    smsSent.has(r.reservation_id) ? (
                      <Badge variant="secondary" className="gap-1">
                        <Check className="w-3 h-3" /> SMS envoyé
                      </Badge>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => sendSms(r)} className="h-8">
                        <MessageSquare className="w-3.5 h-3.5" /> SMS
                      </Button>
                    )
                  ) : null}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default FeedbackList;
