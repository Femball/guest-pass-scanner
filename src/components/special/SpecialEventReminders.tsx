import { useCallback, useEffect, useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { BellRing, Clock, Loader2, MessageSquare, Phone, Send, Trash2, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { buildSmsPayload } from '@/lib/sms';

export interface ReminderEvent {
  id: string;
  title: string;
  event_date: string;
  event_time: string;
}

export interface ReminderBooking {
  id: string;
  guest_names: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  number_of_persons: number;
}

interface Reminder {
  id: string;
  event_id: string;
  label: string;
  message: string;
  scheduled_for: string;
  booking_ids: string[];
  status: string;
  sent_count: number;
  sent_at: string | null;
}

const dateLabel = (iso: string) => {
  try {
    return format(parseISO(iso), 'EEEE d MMMM yyyy', { locale: fr });
  } catch {
    return iso;
  }
};

/** Converts a datetime-local value into an ISO timestamp (local time). */
const localToIso = (value: string) => new Date(value).toISOString();

/** Default datetime-local value: tomorrow 10:00. */
const defaultSchedule = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(10, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const personalize = (
  template: string,
  event: ReminderEvent,
  booking: ReminderBooking,
  venue: string,
  ticketUrl: string,
) =>
  template
    .replaceAll('{prenom}', booking.first_name ?? booking.guest_names)
    .replaceAll('{nom}', booking.last_name ?? '')
    .replaceAll('{titre}', event.title)
    .replaceAll('{date}', dateLabel(event.event_date))
    .replaceAll('{heure}', event.event_time)
    .replaceAll('{personnes}', String(booking.number_of_persons))
    .replaceAll('{lieu}', venue)
    .replaceAll('{lien}', ticketUrl)
    .trim();

interface Props {
  event: ReminderEvent;
  bookings: ReminderBooking[];
  venue: string;
  ticketUrl: (booking: ReminderBooking) => string;
}

const SpecialEventReminders = ({ event, bookings, venue, ticketUrl }: Props) => {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [scheduledFor, setScheduledFor] = useState(defaultSchedule());
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [queue, setQueue] = useState<{ reminder: Reminder; list: ReminderBooking[] } | null>(null);
  const [queueIndex, setQueueIndex] = useState(0);

  const eligible = useMemo(() => bookings.filter((b) => !!b.phone), [bookings]);

  const defaultMessage = useMemo(
    () =>
      [
        'Bonjour {prenom},',
        '',
        `Petit rappel : ${event.title}`,
        '{date} — à partir de {heure}',
        '{lieu}',
        'Réservation pour {personnes} personne(s).',
        '',
        'Votre ticket : {lien}',
      ].join('\n'),
    [event.title],
  );

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('special_event_reminders')
      .select('*')
      .eq('event_id', event.id)
      .order('scheduled_for', { ascending: true });
    if (!error) setReminders((data ?? []) as Reminder[]);
  }, [event.id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);

  const openDialog = () => {
    setMessage(defaultMessage);
    setScheduledFor(defaultSchedule());
    setSelected(new Set(eligible.map((b) => b.id)));
    setOpen(true);
  };

  const saveReminder = async () => {
    if (!message.trim()) return toast.error('Saisissez le message du rappel');
    if (!scheduledFor) return toast.error("Choisissez la date d'envoi");
    if (selected.size === 0) return toast.error('Sélectionnez au moins un invité');
    setSaving(true);
    const { error } = await supabase.from('special_event_reminders').insert({
      event_id: event.id,
      message: message.trim(),
      scheduled_for: localToIso(scheduledFor),
      booking_ids: [...selected],
      created_by: (await supabase.auth.getUser()).data.user?.id ?? null,
    });
    setSaving(false);
    if (error) return toast.error("Impossible d'enregistrer le rappel");
    toast.success('Rappel programmé');
    setOpen(false);
    load();
  };

  const cancelReminder = async (id: string) => {
    const { error } = await supabase.from('special_event_reminders').delete().eq('id', id);
    if (error) return toast.error('Suppression impossible');
    toast.success('Rappel supprimé');
    load();
  };

  const startQueue = (reminder: Reminder) => {
    const list = reminder.booking_ids
      .map((id) => bookings.find((b) => b.id === id))
      .filter((b): b is ReminderBooking => !!b && !!b.phone);
    if (list.length === 0) return toast.error('Aucun destinataire avec un numéro valide');
    setQueue({ reminder, list });
    setQueueIndex(0);
  };

  const currentBooking = queue?.list[queueIndex];

  const bodyFor = (booking: ReminderBooking, reminder: Reminder) =>
    personalize(reminder.message, event, booking, venue, ticketUrl(booking));

  const sendCurrent = () => {
    if (!queue || !currentBooking?.phone) return;
    const payload = buildSmsPayload(currentBooking.phone, bodyFor(currentBooking, queue.reminder));
    if (!payload) return toast.error('Numéro invalide');
    // Must stay synchronous inside the user gesture for iOS
    window.location.href = payload.url;
  };

  const finishQueue = async (sentCount: number) => {
    if (!queue) return;
    await supabase
      .from('special_event_reminders')
      .update({ status: 'sent', sent_at: new Date().toISOString(), sent_count: sentCount })
      .eq('id', queue.reminder.id);
    setQueue(null);
    setQueueIndex(0);
    toast.success('Rappel marqué comme envoyé');
    load();
  };

  const nextRecipient = () => {
    if (!queue) return;
    if (queueIndex + 1 >= queue.list.length) finishQueue(queue.list.length);
    else setQueueIndex((i) => i + 1);
  };

  const now = Date.now();
  const due = reminders.filter((r) => r.status === 'pending' && new Date(r.scheduled_for).getTime() <= now);
  const upcoming = reminders.filter((r) => r.status === 'pending' && new Date(r.scheduled_for).getTime() > now);
  const done = reminders.filter((r) => r.status !== 'pending');

  const allChecked = eligible.length > 0 && eligible.every((b) => selected.has(b.id));

  return (
    <Card>
      <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <BellRing className="w-4 h-4 text-primary" /> Rappels programmés
        </CardTitle>
        <Button size="sm" className="gap-1.5" onClick={openDialog} disabled={eligible.length === 0}>
          <Clock className="w-4 h-4" /> Programmer
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {reminders.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Aucun rappel pour cette soirée. Programmez un message et la date d'envoi : le jour venu, la liste
            des invités s'affiche ici pour envoyer les SMS en quelques appuis.
          </p>
        )}

        {due.map((r) => (
          <div key={r.id} className="rounded-lg border-2 border-primary bg-primary/5 p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-primary">À envoyer maintenant</p>
              <span className="text-xs text-muted-foreground">
                prévu le {format(new Date(r.scheduled_for), 'dd/MM/yyyy à HH:mm')}
              </span>
            </div>
            <p className="text-xs text-muted-foreground whitespace-pre-line line-clamp-3">{r.message}</p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" className="gap-1.5" onClick={() => startQueue(r)}>
                <Send className="w-4 h-4" /> Envoyer ({r.booking_ids.length})
              </Button>
              <Button variant="ghost" size="sm" onClick={() => cancelReminder(r.id)}>
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </div>
          </div>
        ))}

        {upcoming.map((r) => (
          <div key={r.id} className="rounded-lg border border-border p-3 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                {format(new Date(r.scheduled_for), 'dd/MM/yyyy à HH:mm')}
              </p>
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">{r.booking_ids.length} invité(s)</span>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => cancelReminder(r.id)}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground whitespace-pre-line line-clamp-2">{r.message}</p>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => startQueue(r)}>
              <Send className="w-3.5 h-3.5" /> Envoyer maintenant
            </Button>
          </div>
        ))}

        {done.map((r) => (
          <div key={r.id} className="rounded-lg border border-border/60 p-3 opacity-70">
            <p className="text-xs text-muted-foreground">
              Envoyé {r.sent_at ? `le ${format(new Date(r.sent_at), 'dd/MM/yyyy à HH:mm')}` : ''} —{' '}
              {r.sent_count} invité(s)
            </p>
            <p className="text-xs text-muted-foreground whitespace-pre-line line-clamp-2">{r.message}</p>
          </div>
        ))}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BellRing className="w-5 h-5" /> Programmer un rappel
            </DialogTitle>
            <DialogDescription>
              {event.title} — {dateLabel(event.event_date)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Date et heure d'envoi</Label>
              <Input
                type="datetime-local"
                value={scheduledFor}
                onChange={(e) => setScheduledFor(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Message</Label>
              <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={8} maxLength={1000} />
              <p className="text-[11px] text-muted-foreground">
                Personnalisation : {'{prenom} {nom} {titre} {date} {heure} {personnes} {lieu} {lien}'}
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Destinataires</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setSelected(allChecked ? new Set() : new Set(eligible.map((b) => b.id)))}
                >
                  {allChecked ? 'Tout désélectionner' : 'Tout sélectionner'}
                </Button>
              </div>
              <div className="border rounded-md divide-y max-h-[35vh] overflow-y-auto">
                {eligible.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-6">Aucun invité avec téléphone</p>
                )}
                {eligible.map((b) => (
                  <label key={b.id} className="flex items-center gap-3 p-3 cursor-pointer hover:bg-secondary/40">
                    <Checkbox
                      checked={selected.has(b.id)}
                      onCheckedChange={(c) => {
                        const next = new Set(selected);
                        if (c) next.add(b.id);
                        else next.delete(b.id);
                        setSelected(next);
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{b.guest_names}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Phone className="w-3 h-3" /> {b.phone}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
              <Button onClick={saveReminder} disabled={saving} className="gap-2">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}Programmer ({selected.size})
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!queue} onOpenChange={(o) => { if (!o) { setQueue(null); setQueueIndex(0); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="w-5 h-5" /> Envoi des rappels
            </DialogTitle>
            <DialogDescription>Envoyez chaque SMS depuis votre téléphone, puis passez au suivant.</DialogDescription>
          </DialogHeader>
          {queue && currentBooking && (
            <div className="space-y-4">
              <div className="text-xs text-muted-foreground text-center">
                Invité {queueIndex + 1} sur {queue.list.length}
              </div>
              <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                <div
                  className="bg-primary h-2 transition-all"
                  style={{ width: `${((queueIndex + 1) / queue.list.length) * 100}%` }}
                />
              </div>
              <div className="p-4 rounded-lg border bg-secondary/40 text-center">
                <p className="font-semibold text-base">{currentBooking.guest_names}</p>
                <p className="text-sm text-muted-foreground flex items-center justify-center gap-1 mt-1">
                  <Phone className="w-3.5 h-3.5" /> {currentBooking.phone}
                </p>
              </div>
              <p className="text-xs text-muted-foreground whitespace-pre-line rounded-md border p-3 max-h-32 overflow-y-auto">
                {bodyFor(currentBooking, queue.reminder)}
              </p>
              <Button className="w-full" onClick={sendCurrent}>
                <MessageSquare className="w-4 h-4 mr-2" /> Ouvrir le SMS
              </Button>
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => {
                  navigator.clipboard
                    ?.writeText(bodyFor(currentBooking, queue.reminder))
                    .then(() => toast.success('Message copié'))
                    .catch(() => toast.error('Copie impossible sur cet appareil'));
                }}
              >
                <Copy className="w-4 h-4 mr-2" /> Copier le message
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={nextRecipient}>
                  {queueIndex + 1 >= queue.list.length ? 'Terminer' : 'Suivant'}
                </Button>
                <Button variant="ghost" onClick={() => { setQueue(null); setQueueIndex(0); }}>
                  Arrêter
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default SpecialEventReminders;
