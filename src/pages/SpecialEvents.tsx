import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Sparkles, Download, Share2, Image as ImageIcon, Loader2, QrCode, Pencil, MessageSquare, Copy } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import Seo from '@/components/Seo';
import { renderSpecialTicket, downloadBlob, shareTicketBlob } from '@/lib/specialTicket';
import { buildSmsPayload } from '@/lib/sms';
import type { PendingSms } from '@/types/admin';

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
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [persons, setPersons] = useState('1');
  const [seatRows, setSeatRows] = useState('');
  const [seatNumbers, setSeatNumbers] = useState('');
  const [price, setPrice] = useState('');
  const [adding, setAdding] = useState(false);

  // Event edit
  const [editOpen, setEditOpen] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editPoster, setEditPoster] = useState<File | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const [posterSignedUrl, setPosterSignedUrl] = useState<string | null>(null);
  const [busyTicket, setBusyTicket] = useState<string | null>(null);
  const [pendingSms, setPendingSms] = useState<{ payload: PendingSms; booking: SpecialBooking } | null>(null);
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
    if (!firstName.trim() || !lastName.trim()) return toast.error('Prénom et nom obligatoires');
    setAdding(true);
    const fullName = `${firstName.trim()} ${lastName.trim()}`;
    const { error } = await supabase.from('special_bookings').insert({
      event_id: selectedEvent.id,
      guest_names: fullName,
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      phone: phone.trim() || null,
      number_of_persons: Math.max(1, Number(persons) || 1),
      seat_rows: seatRows.trim().toUpperCase() || null,
      seat_numbers: seatNumbers.trim() || null,
      price: price ? Number(price) : null,
      qr_code: `SOIREE-${crypto.randomUUID()}`,
    });
    setAdding(false);
    if (error) return toast.error('Ajout impossible');
    setFirstName('');
    setLastName('');
    setPhone('');
    setPersons('1');
    setSeatRows('');
    setSeatNumbers('');
    setPrice('');
    toast.success('Invitation créée');
    loadBookings(selectedEvent.id);
  };

  const openEdit = () => {
    if (!selectedEvent) return;
    setEditTitle(selectedEvent.title);
    setEditDate(selectedEvent.event_date);
    setEditTime(selectedEvent.event_time);
    setEditPoster(null);
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!selectedEvent) return;
    if (!editTitle.trim() || !editDate || !editTime) return toast.error('Titre, date et heure obligatoires');
    setSavingEdit(true);
    try {
      let posterPath = selectedEvent.poster_url;
      if (editPoster) {
        const ext = editPoster.name.split('.').pop()?.toLowerCase() || 'jpg';
        posterPath = `${editDate}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from('event-posters')
          .upload(posterPath, editPoster, { contentType: editPoster.type, upsert: false });
        if (upErr) throw upErr;
      }
      const { error } = await supabase
        .from('special_events')
        .update({ title: editTitle.trim(), event_date: editDate, event_time: editTime, poster_url: posterPath })
        .eq('id', selectedEvent.id);
      if (error) throw error;
      toast.success('Soirée modifiée');
      setEditOpen(false);
      await loadEvents();
    } catch (err) {
      console.error(err);
      toast.error('Modification impossible');
    } finally {
      setSavingEdit(false);
    }
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
        seats: seatsLabel(booking) || null,
        code: booking.qr_code,
        posterUrl: posterSignedUrl,
        address: VENUE_ADDRESS,
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
      const text = `${selectedEvent?.title} — ${formatDateLabel(selectedEvent?.event_date ?? '')} à ${selectedEvent?.event_time}. Votre ticket : ${ticketUrl(booking)}`;
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

  const ticketUrl = (booking: SpecialBooking) => {
    if (!selectedEvent) return '';
    return shortTicketUrl(booking.qr_code);
  };

  const smsBody = (booking: SpecialBooking) =>
    [
      `Bonjour ${booking.first_name ?? booking.guest_names},`,
      '',
      `Votre invitation L'Access : ${selectedEvent?.title ?? ''}`,
      `${formatDateLabel(selectedEvent?.event_date ?? '')} — à partir de ${selectedEvent?.event_time ?? ''}`,
      seatsLabel(booking) ? `Placement : ${seatsLabel(booking)}` : '',
      VENUE_ADDRESS,
      '',
      'Votre ticket avec QR code :',
      ticketUrl(booking),
      '',
      'Présentez le QR code à votre arrivée.',
    ]
      .filter(Boolean)
      .join('\n');

  const handleSms = (booking: SpecialBooking) => {
    if (!booking.phone) return toast.error('Aucun numéro de téléphone pour cette invitation');
    const payload = buildSmsPayload(booking.phone, smsBody(booking));
    if (!payload) return toast.error('Numéro invalide');
    // Must stay synchronous inside the user gesture for iOS
    window.location.href = payload.url;
    setPendingSms({ payload, booking });
  };

  const handleShareFromSms = async (booking: SpecialBooking) => {
    setBusyTicket(booking.id);
    try {
      const blob = await buildTicket(booking);
      const shared = await shareTicketBlob(blob, 'invitation.png', smsBody(booking));
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
                    <>
                      <Button variant="outline" size="icon" onClick={openEdit} title="Modifier la soirée">
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="outline" size="icon" onClick={() => deleteEvent(selectedEvent.id)} title="Supprimer la soirée">
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </>
                  )}
                </div>

                {selectedEvent && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <ImageIcon className="w-3.5 h-3.5" />
                    {selectedEvent.poster_url ? 'Affiche associée à cette date' : 'Aucune affiche : fond noir élégant'}
                  </div>
                )}

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="firstName">Prénom</Label>
                    <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Marie" maxLength={60} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="lastName">Nom</Label>
                    <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Dupont" maxLength={60} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="phone">Téléphone</Label>
                    <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="06 12 34 56 78" maxLength={30} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="persons">Nombre de personnes</Label>
                    <Input id="persons" type="number" min="1" step="1" value={persons} onChange={(e) => setPersons(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="rows">Rangée(s)</Label>
                    <Input id="rows" value={seatRows} onChange={(e) => setSeatRows(e.target.value)} placeholder="A, B" maxLength={40} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="seats">Numéro(s) de siège(s)</Label>
                    <Input id="seats" value={seatNumbers} onChange={(e) => setSeatNumbers(e.target.value)} placeholder="12, 13" maxLength={60} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="price">Prix réglé (€)</Label>
                    <Input id="price" type="number" min="0" step="1" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="50" />
                  </div>
                  <div className="flex items-end">
                    <Button onClick={addBooking} disabled={adding} className="gap-2 w-full">
                      {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                      Ajouter
                    </Button>
                  </div>
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
                            {b.number_of_persons} pers.{seatsLabel(b) ? ` · ${seatsLabel(b)}` : ''} · {b.price != null ? `${b.price} €` : 'Prix non renseigné'}
                            {b.phone ? ` · ${b.phone}` : ''}
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
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5"
                          disabled={busyTicket === b.id || !b.phone}
                          onClick={() => handleSms(b)}
                        >
                          <MessageSquare className="w-4 h-4" /> SMS
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

        <Dialog open={!!pendingSms} onOpenChange={(open) => { if (!open) setPendingSms(null); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5" /> SMS prêt
              </DialogTitle>
              <DialogDescription>
                Envoyez d'abord l'image de l'invitation, puis le texte si nécessaire.
              </DialogDescription>
            </DialogHeader>
            {pendingSms && (
              <div className="space-y-3">
                <Button
                  className="w-full"
                  disabled={busyTicket === pendingSms.booking.id}
                  onClick={() => handleShareFromSms(pendingSms.booking)}
                >
                  {busyTicket === pendingSms.booking.id ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Share2 className="w-4 h-4 mr-2" />
                  )}
                  Partager l'invitation (image) via Messages
                </Button>
                <Button asChild variant="outline" className="w-full">
                  <a href={pendingSms.payload.url}>Ouvrir SMS (texte uniquement)</a>
                </Button>
                {pendingSms.payload.isIOS && (
                  <Button asChild variant="outline" className="w-full">
                    <a href={pendingSms.payload.fallbackUrl}>Essayer le format iOS alternatif</a>
                  </Button>
                )}
                <Button asChild variant="outline" className="w-full">
                  <a href={pendingSms.payload.recipientOnlyUrl}>Ouvrir SMS avec le numéro seul</a>
                </Button>
                <Button
                  variant="ghost"
                  className="w-full"
                  onClick={() => {
                    navigator.clipboard
                      ?.writeText(pendingSms.payload.body)
                      .then(() => toast.success('Message copié'))
                      .catch(() => toast.error('Copie impossible sur cet appareil'));
                  }}
                >
                  <Copy className="w-4 h-4 mr-2" /> Copier le message
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Modifier la soirée</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Titre</Label>
                <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} maxLength={80} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Date</Label>
                  <Input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Heure</Label>
                  <Input type="time" value={editTime} onChange={(e) => setEditTime(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Remplacer l'affiche (optionnel)</Label>
                <Input type="file" accept="image/*" onChange={(e) => setEditPoster(e.target.files?.[0] ?? null)} />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <Button variant="outline" onClick={() => setEditOpen(false)}>Annuler</Button>
                <Button onClick={saveEdit} disabled={savingEdit} className="gap-2">
                  {savingEdit && <Loader2 className="w-4 h-4 animate-spin" />}Enregistrer
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};

export default SpecialEvents;