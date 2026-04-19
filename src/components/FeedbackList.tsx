import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Star } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface FeedbackRow {
  id: string;
  client_name: string;
  client_email: string;
  event_date: string;
  rating: number | null;
  comment: string | null;
  submitted_at: string | null;
  created_at: string;
}

const FeedbackList = () => {
  const [rows, setRows] = useState<FeedbackRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRows = async () => {
      const { data, error } = await supabase
        .from('event_feedback')
        .select('id, client_name, client_email, event_date, rating, comment, submitted_at, created_at')
        .order('event_date', { ascending: false })
        .order('submitted_at', { ascending: false, nullsFirst: false });

      if (!error && data) setRows(data as FeedbackRow[]);
      setLoading(false);
    };
    fetchRows();
    const i = setInterval(fetchRows, 15000);
    return () => clearInterval(i);
  }, []);

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
                <Badge variant="outline">En attente</Badge>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default FeedbackList;
