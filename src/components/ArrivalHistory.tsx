import { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Clock, User } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

interface ScanNotification {
  id: string;
  client_name: string;
  event_date: string;
  created_at: string;
  scanned_by: string | null;
  source_kind: string | null;
}

const ArrivalHistory = () => {
  const [notifications, setNotifications] = useState<ScanNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('');

  const fetchNotifications = async () => {
    const { data } = await supabase
      .from('scan_notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);
    setNotifications(data || []);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  // Realtime subscription for live updates
  useEffect(() => {
    const channel = supabase
      .channel('arrival-history')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'scan_notifications' }, () => {
        fetchNotifications();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // Group notifications by event_date (sorted desc)
  const grouped = useMemo(() => {
    const map = new Map<string, ScanNotification[]>();
    notifications.forEach((n) => {
      if (!map.has(n.event_date)) map.set(n.event_date, []);
      map.get(n.event_date)!.push(n);
    });
    return Array.from(map.entries()).sort(([a], [b]) => b.localeCompare(a));
  }, [notifications]);

  // Set active tab to most recent date when data loads
  useEffect(() => {
    if (grouped.length > 0 && !grouped.some(([d]) => d === activeTab)) {
      setActiveTab(grouped[0][0]);
    }
  }, [grouped, activeTab]);

  const getSourceLabel = (kind: string | null) => {
    if (kind === 'reservation') return 'Réservation';
    if (kind === 'flyer_scan') return 'Flyer';
    return 'Manuel';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25 }}
    >
      <Card>
        <CardHeader className="px-4 py-3 md:p-6">
          <CardTitle className="flex items-center gap-2 text-base md:text-2xl">
            <Clock className="w-4 h-4 md:w-5 md:h-5" />
            Historique des scans par soirée ({notifications.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 md:px-6 md:pb-6">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : grouped.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Aucune arrivée enregistrée
            </p>
          ) : (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="w-full justify-start overflow-x-auto flex-nowrap h-auto p-1">
                {grouped.map(([date, items]) => (
                  <TabsTrigger key={date} value={date} className="text-xs md:text-sm whitespace-nowrap">
                    {format(new Date(date + 'T00:00:00'), 'dd MMM yyyy', { locale: fr })}
                    <span className="ml-1.5 inline-flex items-center justify-center px-1.5 py-0.5 rounded-full bg-primary/20 text-[10px] font-bold">
                      {items.length}
                    </span>
                  </TabsTrigger>
                ))}
              </TabsList>
              {grouped.map(([date, items]) => (
                <TabsContent key={date} value={date} className="mt-3">
                  <div className="space-y-2">
                    {items.map((n) => (
                      <div
                        key={n.id}
                        className="flex items-center gap-2 md:gap-3 p-2.5 md:p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors"
                      >
                        <div className="p-1.5 md:p-2 rounded-full bg-primary/10 shrink-0">
                          <User className="w-3.5 h-3.5 md:w-4 md:h-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground text-sm truncate">
                            {n.client_name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted">
                              {getSourceLabel(n.source_kind)}
                            </span>
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 text-primary font-mono font-semibold text-sm md:text-base whitespace-nowrap">
                          <Clock className="w-3.5 h-3.5 md:w-4 md:h-4" />
                          {format(new Date(n.created_at), "HH:mm:ss", { locale: fr })}
                        </div>
                      </div>
                    ))}
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default ArrivalHistory;
