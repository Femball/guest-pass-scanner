import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { CalendarIcon, Clock, User, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';

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
  const [filterDate, setFilterDate] = useState<Date | undefined>(undefined);

  const fetchNotifications = async () => {
    let query = supabase
      .from('scan_notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);

    if (filterDate) {
      const dateStr = format(filterDate, 'yyyy-MM-dd');
      query = query.eq('event_date', dateStr);
    }

    const { data } = await query;
    setNotifications(data || []);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchNotifications();
  }, [filterDate]);

  // Realtime subscription for live updates
  useEffect(() => {
    const channel = supabase
      .channel('arrival-history')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'scan_notifications' }, () => {
        fetchNotifications();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [filterDate]);

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
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="flex items-center gap-2 text-base md:text-2xl">
              <Clock className="w-4 h-4 md:w-5 md:h-5" />
              Historique des arrivées ({notifications.length})
            </CardTitle>
            <div className="flex items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      "gap-2 text-sm",
                      !filterDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="w-4 h-4" />
                    {filterDate ? format(filterDate, 'dd/MM/yyyy') : 'Filtrer par date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    mode="single"
                    selected={filterDate}
                    onSelect={setFilterDate}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
              {filterDate && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setFilterDate(undefined)}
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4 md:px-6 md:pb-6">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : notifications.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Aucune arrivée enregistrée
            </p>
          ) : (
            <div className="space-y-2">
              {notifications.map((n) => (
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
                      {format(new Date(n.created_at), "dd/MM/yyyy 'à' HH:mm:ss", { locale: fr })}
                      {' • '}
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted">
                        {getSourceLabel(n.source_kind)}
                      </span>
                    </p>
                  </div>
                  <div className="text-[10px] md:text-xs text-muted-foreground whitespace-nowrap hidden sm:block">
                    {format(new Date(n.event_date + 'T00:00:00'), 'dd/MM/yyyy')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default ArrivalHistory;
