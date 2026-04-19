import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface Anomaly {
  id: string;
  client_name: string;
  event_date: string;
  source_kind: string | null;
  first_scan_at: string;
  duplicate_scan_at: string;
  delta_seconds: number;
}

const ScanAnomalies = () => {
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('scan_anomalies')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      setAnomalies((data ?? []) as Anomaly[]);
      setLoading(false);
    };
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Card className="border-destructive/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="w-5 h-5 text-destructive" />
          Anomalies de scan
          {anomalies.length > 0 && (
            <Badge variant="destructive" className="ml-2">{anomalies.length}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Chargement…</p>
        ) : anomalies.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucune anomalie détectée. Les double-scans (&lt; 30s sur le même QR) apparaîtront ici.
          </p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {anomalies.map((a) => (
              <div key={a.id} className="border border-destructive/20 bg-destructive/5 rounded-md p-3 text-sm">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="font-medium">{a.client_name}</span>
                  <Badge variant="outline" className="text-xs">
                    +{Math.round(Number(a.delta_seconds))}s
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Re-scan détecté le{' '}
                  {format(new Date(a.duplicate_scan_at), 'dd/MM/yyyy à HH:mm:ss', { locale: fr })}
                  {a.source_kind && ` · ${a.source_kind}`}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ScanAnomalies;
