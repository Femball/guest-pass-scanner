import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Sparkles, Download, Share2, Image as ImageIcon, Loader2, QrCode, Pencil } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import Seo from '@/components/Seo';
import { renderSpecialTicket, downloadBlob, shareTicketBlob } from '@/lib/specialTicket';

interface SpecialEvent {
  id: string;
  title: string;
  event_date: string;
  event_time: string;
  poster_url: string | null;
}

interface SpecialBooking {
  id: string;
  event_id: string;
  guest_names: string;
  price: number | null;
  qr_code: string;
  created_at: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  number_of_persons: number;
  seat_rows: string | null;
  seat_numbers: string | null;
}

const VENUE_ADDRESS = 'Café Le Français, Place Napoléon, 31800 Saint-Gaudens';

const seatsLabel = (b: Pick<SpecialBooking, 'seat_rows' | 'seat_numbers'>) => {
  const parts: string[] = [];
  if (b.seat_rows) parts.push(`Rangée ${b.seat_rows}`);
  if (b.seat_numbers) parts.push(`Siège ${b.seat_numbers}`);
  return parts.join(' · ');
};

const formatDateLabel = (date: string) => {
  try {
    return format(parseISO(date), 'EEEE d MMMM yyyy', { locale: fr });
  } catch {
    return date;
  }
};

const SpecialEvents = () => {
  const [events, setEvents] = useState<SpecialEvent[]>([]);
  const [bookings, setBookings] = useState<SpecialBooking[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [loading, setLoading] = useState(true);

  // Event form
  const [title, setTitle] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventTime, setEventTime] = useState('22:00');
  const [poster, setPoster] = useState<File | null>(null);
  const [posterPreview, setPosterPreview] = useState<string>('');
  const [creating, setCreating] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Booking form
  const [guestNames, setGuestNames] = useState('');
  const [price, setPrice] = useState('');
  const [adding, setAdding] = useState(false);

  const [posterSignedUrl, setPosterSignedUrl] = useState<string | null>(null);
  const [busyTicket, setBusyTicket] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');

  const selectedEvent = useMemo(
    () => events.find((e) => e.id === selectedId) ?? null,
    [events, selectedId],
  );

  const loadEvents = useCallback(async () => {
    const { data, error } = await supabase
      .from('special_events')
      .select('id, title, event_date, event_time, poster_url')
      .order('event_date', { ascending: false });
    if (error) {
      toast.error('Impossible de charger les soirées');
    } else {
      setEvents(data ?? []);
      setSelectedId((prev) => prev || data?.[0]?.id || '');
    }
    setLoading(false);
  }, []);

  const loadBookings = useCallback(async (eventId: string) => {
    if (!eventId) return setBookings([]);
    const { data, error } = await supabase
      .from('special_bookings')
      .select('*')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false });
    if (error) toast.error('Impossible de charger les réservations');
    else setBookings(data ?? []);
  }, []);

  useEffect(() => { loadEvents(); }, [loadEvents]);
  useEffect(() => { loadBookings(selectedId); }, [selectedId, loadBookings]);

  // Signed URL for the private poster
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!selectedEvent?.poster_url) return setPosterSignedUrl(null);
      const { data } = await supabase.storage
        .from('event-posters')
        .createSignedUrl(selectedEvent.poster_url, 3600);
      if (!cancelled) setPosterSignedUrl(data?.signedUrl ?? null);
    };
    run();
    return () => { cancelled = true; };
  }, [selectedEvent]);

  const onPosterChange = (file: File | null) => {
    setPoster(file);
    setPosterPreview(file ? URL.createObjectURL(file) : '');
  };

  const createEvent = async () => {
    if (!title.trim() || !eventDate || !eventTime) {
      toast.error('Titre, date et heure sont obligatoires');
      return;
    }
    setCreating(true);
    try {
      let posterPath: string | null = null;
      if (poster) {
        const ext = poster.name.split('.').pop()?.toLowerCase() || 'jpg';
        posterPath = `${eventDate}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from('event-posters')
          .upload(posterPath, poster, { contentType: poster.type, upsert: false });
        if (upErr) throw upErr;
      }
      const { data, error } = await supabase
        .from('special_events')
        .insert({ title: title.trim(), event_date: eventDate, event_time: eventTime, poster_url: posterPath })
        .select('id, title, event_date, event_time, poster_url')
        .single();
      if (error) throw error;
      toast.success('Soirée créée');
      setTitle('');
      setPoster(null);
      setPosterPreview('');
      if (fileRef.current) fileRef.current.value = '';
      await loadEvents();
      if (data) setSelectedId(data.id);
    } catch (err) {
      console.error(err);
      toast.error("Création impossible");
    } finally {
      setCreating(false);
    }
  };

  const deleteEvent = async (id: string) => {
    if (!confirm('Supprimer cette soirée et toutes ses invitations ?')) return;
    const { error } = await supabase.from('special_events').delete().eq('id', id);
    if (error) return toast.error('Suppression impossible');
    toast.success('Soirée supprimée');
    setSelectedId('');
    await loadEvents();
  };

  const addBooking = async () => {
    if (!selectedEvent) return toast.error('Sélectionnez une soirée');
    if (!guestNames.trim()) return toast.error('Indiquez le ou les noms');
    setAdding(true);
    const { error } = await supabase.from('special_bookings').insert({
      event_id: selectedEvent.id,
      guest_names: guestNames.trim(),
      price: price ? Number(price) : null,
      qr_code: `SOIREE-${crypto.randomUUID()}`,
    });
    setAdding(false);
    if (error) return toast.error('Ajout impossible');
    setGuestNames('');
    setPrice('');
    toast.success('Invitation créée');
    loadBookings(selectedEvent.id);
  };

  const deleteBooking = async (id: string) => {
    const { error } = await supabase.from('special_bookings').delete().eq('id', id);
    if (error) return toast.error('Suppression impossible');
    setBookings((prev) => prev.filter((b) => b.id !== id));
  };

  const buildTicket = useCallback(
    async (booking: SpecialBooking) => {
      if (!selectedEvent) throw new Error('no event');
      return renderSpecialTicket({
        title: selectedEvent.title,
        dateLabel: formatDateLabel(selectedEvent.event_date),
        timeLabel: `À partir de ${selectedEvent.event_time}`,
        guests: booking.guest_names,
        price: booking.price != null ? `${booking.price} €` : null,
        code: booking.qr_code,
        posterUrl: posterSignedUrl,
      });
    },
    [selectedEvent, posterSignedUrl],
  );

  const handleDownload = async (booking: SpecialBooking) => {
    setBusyTicket(booking.id);
    try {
      const blob = await buildTicket(booking);
      downloadBlob(blob, `invitation-${booking.guest_names.replace(/[^a-zA-Z0-9]/g, '_')}.png`);
    } catch {
      toast.error('Génération impossible');
    } finally {
      setBusyTicket(null);
    }
  };

  const handleShare = async (booking: SpecialBooking) => {
    setBusyTicket(booking.id);
    try {
      const blob = await buildTicket(booking);
      const text = `${selectedEvent?.title} — ${formatDateLabel(selectedEvent?.event_date ?? '')} à ${selectedEvent?.event_time}. Votre invitation L'Access.`;
      const shared = await shareTicketBlob(blob, 'invitation.png', text);
      if (!shared) {
        downloadBlob(blob, 'invitation.png');
        toast.info('Partage non supporté : image téléchargée');
      }
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') toast.error('Partage impossible');
    } finally {
      setBusyTicket(null);
    }
  };

  const handlePreview = async (booking: SpecialBooking) => {
    setBusyTicket(booking.id);
    try {
      const blob = await buildTicket(booking);
      setPreviewUrl(URL.createObjectURL(blob));
    } catch {
      toast.error('Aperçu impossible');
    } finally {
      setBusyTicket(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Seo
        title="Soirées spéciales — L'Access"
        description="Créez des invitations QR code raffinées pour les soirées spéciales L'Access."
        noindex
      />
      <header className="px-4 py-3 md:px-6 md:py-4 border-b border-border flex items-center gap-3">
        <Link to="/admin">
          <Button variant="ghost" size="icon" className="h-10 w-10">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-base md:text-lg font-bold text-foreground">Soirées spéciales</h1>
          <p className="text-[10px] md:text-xs text-muted-foreground">Invitations QR code personnalisées</p>
        </div>
      </header>

      <main className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="w-4 h-4 text-primary" /> Nouvelle soirée
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="sm:col-span-3 space-y-1.5">
                <Label htmlFor="title">Titre de la soirée</Label>
                <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nuit Dorée" maxLength={80} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="date">Date</Label>
                <Input id="date" type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="time">Heure</Label>
                <Input id="time" type="time" value={eventTime} onChange={(e) => setEventTime(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="poster">Affiche (fond)</Label>
                <Input
                  id="poster"
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => onPosterChange(e.target.files?.[0] ?? null)}
                />
              </div>
            </div>
            {posterPreview && (
              <img src={posterPreview} alt="Aperçu de l'affiche de la soirée" className="h-32 rounded-md object-cover border border-border" />
            )}
            <Button onClick={createEvent} disabled={creating} className="gap-2">
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Créer la soirée
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Invitations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
            ) : events.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune soirée pour le moment.</p>
            ) : (
              <>
                <div className="flex items-end gap-2">
                  <div className="flex-1 space-y-1.5">
                    <Label>Soirée</Label>
                    <Select value={selectedId} onValueChange={setSelectedId}>
                      <SelectTrigger><SelectValue placeholder="Choisir une soirée" /></SelectTrigger>
                      <SelectContent>
                        {events.map((e) => (
                          <SelectItem key={e.id} value={e.id}>
                            {e.title} — {formatDateLabel(e.event_date)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {selectedEvent && (
                    <Button variant="outline" size="icon" onClick={() => deleteEvent(selectedEvent.id)} title="Supprimer la soirée">
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  )}
                </div>

                {selectedEvent && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <ImageIcon className="w-3.5 h-3.5" />
                    {selectedEvent.poster_url ? 'Affiche associée à cette date' : 'Aucune affiche : fond noir élégant'}
                  </div>
                )}

                <div className="grid gap-3 sm:grid-cols-[1fr_140px_auto] sm:items-end">
                  <div className="space-y-1.5">
                    <Label htmlFor="guests">Nom(s) de la réservation</Label>
                    <Textarea
                      id="guests"
                      value={guestNames}
                      onChange={(e) => setGuestNames(e.target.value)}
                      placeholder="Marie Dupont & Paul Martin"
                      rows={2}
                      maxLength={200}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="price">Prix réglé (€)</Label>
                    <Input id="price" type="number" min="0" step="1" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="50" />
                  </div>
                  <Button onClick={addBooking} disabled={adding} className="gap-2">
                    {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    Ajouter
                  </Button>
                </div>

                <div className="space-y-2">
                  {bookings.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Aucune invitation pour cette soirée.</p>
                  ) : (
                    bookings.map((b) => (
                      <div key={b.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-3">
                        <div className="flex-1 min-w-[160px]">
                          <p className="font-medium text-sm text-foreground">{b.guest_names}</p>
                          <p className="text-xs text-muted-foreground">
                            {b.price != null ? `${b.price} €` : 'Prix non renseigné'} · {b.qr_code.slice(0, 14)}…
                          </p>
                        </div>
                        <Button variant="outline" size="sm" className="gap-1.5" disabled={busyTicket === b.id} onClick={() => handlePreview(b)}>
                          <QrCode className="w-4 h-4" /> Aperçu
                        </Button>
                        <Button variant="outline" size="sm" className="gap-1.5" disabled={busyTicket === b.id} onClick={() => handleDownload(b)}>
                          <Download className="w-4 h-4" />
                        </Button>
                        <Button size="sm" className="gap-1.5" disabled={busyTicket === b.id} onClick={() => handleShare(b)}>
                          <Share2 className="w-4 h-4" /> Envoyer
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteBooking(b.id)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {previewUrl && (
          <div
            className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
            onClick={() => { URL.revokeObjectURL(previewUrl); setPreviewUrl(''); }}
          >
            <img src={previewUrl} alt="Aperçu de l'invitation QR code" className="max-h-full max-w-full rounded-lg shadow-2xl" />
          </div>
        )}
      </main>
    </div>
  );
};

export default SpecialEvents;