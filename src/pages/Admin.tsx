import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Plus, Users, CheckCircle, Clock, Trash2, Send, QrCode, Mail, Eye, LogOut, UserPlus, Download, CalendarIcon, Wine, X, Printer, Copy, Ticket, Search, Filter, CreditCard, Banknote, Bell, BellOff } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useScanSounds } from '@/hooks/useScanSounds';
import ArrivalHistory from '@/components/ArrivalHistory';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import QRCode from 'qrcode';
interface Reservation {
  id: string;
  client_name: string;
  client_email: string | null;
  qr_code: string;
  is_validated: boolean;
  validated_at: string | null;
  created_at: string;
  number_of_persons: number;
  event_date: string;
  amount: number | null;
  payment_method: string | null;
  payment_status: string | null;
  sumup_checkout_id: string | null;
}

interface BottleWithReservation {
  bottle_type: string;
  quantity: number;
  reservation_id: string;
  reservations: { client_name: string; event_date: string } | null;
}

const AdminContent = () => {
  const { signOut, isAdmin } = useAuth();
  const { playPaymentSound } = useScanSounds();
  const { isSupported: pushSupported, isSubscribed: pushSubscribed, isLoading: pushLoading, subscribe: pushSubscribe, unsubscribe: pushUnsubscribe, permission: pushPermission } = usePushNotifications();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPersons, setNewPersons] = useState(1);
  const [personNames, setPersonNames] = useState<string[]>([]);
  const [hasBottle, setHasBottle] = useState(false);
  const [bottles, setBottles] = useState<{ type: string; quantity: number }[]>([{ type: '', quantity: 1 }]);
  const [isAdding, setIsAdding] = useState(false);
  const [eventDate, setEventDate] = useState<Date>(new Date());
  const [eventTime, setEventTime] = useState('');
  const [eventAddress, setEventAddress] = useState('Café Le Français, Place Napoléon, 31800 Saint-Gaudens');
  const [eventAddressType, setEventAddressType] = useState<'default' | 'other'>('default');
  const [hasPayment, setHasPayment] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | ''>('');
  const [sendingEmail, setSendingEmail] = useState<string | null>(null);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [sumupCheckoutId, setSumupCheckoutId] = useState<string | null>(null);
  const [sumupDialogOpen, setSumupDialogOpen] = useState(false);
  const [pendingCardReservations, setPendingCardReservations] = useState<Reservation[] | null>(null);

  // Search/filter state
  const [searchName, setSearchName] = useState('');
  const [searchEmail, setSearchEmail] = useState('');
  
  // User management
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState<'admin' | 'agent'>('agent');
  const [isAddingUser, setIsAddingUser] = useState(false);

  const [bottleData, setBottleData] = useState<BottleWithReservation[]>([]);
  const prevPaymentStatusesRef = useRef<Map<string, string | null>>(new Map());

  // Flyer invitations
  interface FlyerInvitation {
    id: string;
    label: string;
    event_date: string;
    qr_code: string;
    scan_count: number;
    created_at: string;
  }
  const [flyers, setFlyers] = useState<FlyerInvitation[]>([]);
  const [newFlyerLabel, setNewFlyerLabel] = useState('');
  const [flyerDate, setFlyerDate] = useState<Date>(new Date());
  const [isAddingFlyer, setIsAddingFlyer] = useState(false);
  const [flyerQrDialogOpen, setFlyerQrDialogOpen] = useState(false);
  const [selectedFlyer, setSelectedFlyer] = useState<FlyerInvitation | null>(null);
  const [flyerQrDataUrl, setFlyerQrDataUrl] = useState('');

  const fetchReservations = async () => {
    const { data, error } = await supabase
      .from('reservations')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Erreur lors du chargement des réservations');
      return;
    }

    const newData = data || [];

    // Detect payment status changes (pending → paid)
    const prevStatuses = prevPaymentStatusesRef.current;
    newData.forEach((r) => {
      const prev = prevStatuses.get(r.id);
      if (prev === 'pending' && r.payment_status === 'paid') {
        toast.success(`💳 Paiement confirmé pour ${r.client_name} (${r.amount?.toFixed(2)}€)`, {
          duration: 6000,
        });
        playPaymentSound();
      }
    });

    // Update tracking map
    const newMap = new Map<string, string | null>();
    newData.forEach((r) => newMap.set(r.id, r.payment_status));
    prevPaymentStatusesRef.current = newMap;

    setReservations(newData);
    setIsLoading(false);

    // Fetch bottles with reservation info
    const { data: bottles } = await supabase
      .from('reservation_bottles')
      .select('bottle_type, quantity, reservation_id, reservations(client_name, event_date)');
    
    setBottleData((bottles as any) || []);

    // Fetch flyer invitations
    const { data: flyerData } = await supabase
      .from('flyer_invitations')
      .select('*')
      .order('created_at', { ascending: false });
    
    setFlyers((flyerData as any) || []);
  };

  useEffect(() => {
    fetchReservations();

    // Poll for updates every 10 seconds
    const interval = setInterval(() => {
      fetchReservations();
    }, 10000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  const generateQRCode = () => {
    return `TICKET-${crypto.randomUUID().toUpperCase()}`;
  };

  // Generate a deterministic color from event_date
  const getEventColor = (eventDate: string): string => {
    let hash = 0;
    for (let i = 0; i < eventDate.length; i++) {
      hash = eventDate.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 70%, 35%)`;
  };

  const getEventColorHex = (eventDate: string): string => {
    let hash = 0;
    for (let i = 0; i < eventDate.length; i++) {
      hash = eventDate.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash) % 360;
    // Convert HSL to hex (s=70%, l=35%)
    const s = 0.7, l = 0.35;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs((hue / 60) % 2 - 1));
    const m = l - c / 2;
    let r = 0, g = 0, b = 0;
    if (hue < 60) { r = c; g = x; }
    else if (hue < 120) { r = x; g = c; }
    else if (hue < 180) { g = c; b = x; }
    else if (hue < 240) { g = x; b = c; }
    else if (hue < 300) { r = x; b = c; }
    else { r = c; b = x; }
    const toHex = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
    return `${toHex(r)}${toHex(g)}${toHex(b)}`;
  };

  const sendTicketEmail = async (reservationOrList: Reservation | Reservation[]) => {
    const list = Array.isArray(reservationOrList) ? reservationOrList : [reservationOrList];
    if (list.length === 0) return;

    const email = list[0].client_email;
    if (!email) {
      toast.error('Pas d\'adresse email pour ce client');
      return;
    }

    setSendingEmail(list[0].id);

    try {
      const colorHex = getEventColorHex(list[0].event_date);
      const tickets = list.map(r => ({
        clientName: r.client_name,
        qrCode: r.qr_code,
      }));

      const idempotencyKey = `tickets-${list.map(r => r.id).join('-')}`;

      const { data, error } = await supabase.functions.invoke('send-transactional-email', {
        body: {
          templateName: 'ticket-confirmation',
          recipientEmail: email,
          idempotencyKey,
          templateData: {
            mainName: list[0].client_name,
            eventName: 'Soirée',
            eventDate: list[0].event_date,
            eventTime: eventTime ? eventTime.replace(':', 'h') : undefined,
            eventAddress: eventAddress.trim() || undefined,
            qrColor: colorHex,
            tickets,
            amount: list[0].amount,
            paymentMethod: list[0].payment_method,
            paymentStatus: list[0].payment_status,
          },
        },
      });

      if (error) throw error;
      if (data?.success || data?.queued) {
        toast.success(`${tickets.length} ticket(s) envoyé(s) à ${email}`);
      } else if (data?.reason === 'email_suppressed') {
        toast.error('Cette adresse email est bloquée (désabonnement ou bounce)');
      } else {
        throw new Error(data?.error || 'Erreur lors de l\'envoi');
      }
    } catch (error: any) {
      console.error('Error sending email:', error);
      toast.error(`Erreur: ${error.message}`);
    } finally {
      setSendingEmail(null);
    }
  };

  const addReservation = async () => {
    if (!newEmail.trim()) {
      toast.error('L\'email est requis pour envoyer le ticket');
      return;
    }

    // Build list of names to create
    const names: string[] = [];
    if (newPersons <= 1) {
      if (!newName.trim()) {
        toast.error('Le nom est requis');
        return;
      }
      names.push(newName.trim());
    } else {
      for (let i = 0; i < newPersons; i++) {
        const name = personNames[i]?.trim();
        if (!name) {
          toast.error(`Le nom de la personne ${i + 1} est requis`);
          return;
        }
        names.push(name);
      }
    }

    setIsAdding(true);

    const eventDateStr = format(eventDate, 'yyyy-MM-dd');

    const parsedAmount = hasPayment && paymentAmount ? parseFloat(paymentAmount) : null;

    const reservationsToInsert = names.map(name => ({
      client_name: name,
      client_email: newEmail.trim(),
      qr_code: generateQRCode(),
      number_of_persons: 1,
      event_date: eventDateStr,
      ...(hasPayment && parsedAmount ? {
        amount: parsedAmount,
        payment_method: paymentMethod || null,
        payment_status: paymentMethod === 'cash' ? 'paid' : 'pending',
      } : {}),
    }));

    const { data, error } = await supabase.from('reservations').insert(reservationsToInsert).select();

    if (error) {
      toast.error('Erreur lors de la création des réservations');
      setIsAdding(false);
      return;
    }

    // Save bottles if any
    if (hasBottle && data) {
      const validBottles = bottles.filter(b => b.type.trim());
      if (validBottles.length > 0) {
        // Only link bottles to the first reservation (not duplicated per person)
        const bottleRows = validBottles.map(b => ({
          reservation_id: data[0].id,
          bottle_type: b.type.trim(),
          quantity: b.quantity,
        }));
        const { error: bottleError } = await supabase.from('reservation_bottles').insert(bottleRows);
        if (bottleError) {
          console.error('Error saving bottles:', bottleError);
          toast.error('Réservations créées mais erreur lors de l\'enregistrement des bouteilles');
        }
      }
    }

    toast.success(`${names.length} réservation(s) créée(s) avec succès`);

    // If card payment, create SumUp checkout for the first reservation
    if (paymentMethod === 'card' && parsedAmount && data && data.length > 0) {
      try {
        const { data: checkoutData, error: checkoutError } = await supabase.functions.invoke('create-sumup-checkout', {
          body: {
            amount: parsedAmount,
            description: `Réservation ${names[0]}`,
            reservation_id: data[0].id,
            redirect_url: window.location.origin + '/admin',
          },
        });
        if (checkoutError) throw checkoutError;
        if (checkoutData?.checkout_id) {
          toast.success('Paiement CB en attente - ouvrez le lien SumUp pour payer');
          setSumupCheckoutId(checkoutData.checkout_id);
          setSumupDialogOpen(true);
        }
      } catch (err: any) {
        console.error('SumUp checkout error:', err);
        toast.error('Réservation créée mais erreur lors de la création du paiement CB');
      }
    }
    
    // For card payments, delay email until payment is confirmed
    if (paymentMethod === 'card' && parsedAmount && data && data.length > 0) {
      setPendingCardReservations(data as Reservation[]);
      // Don't send email yet - will be sent after payment confirmation
    } else if (data && data.length > 0 && data[0].client_email) {
      // For cash or no payment, send email immediately
      await sendTicketEmail(data as Reservation[]);
    }

    setNewName('');
    setNewEmail('');
    setNewPersons(1);
    setPersonNames([]);
    setEventTime('');
    setEventAddress('Café Le Français, Place Napoléon, 31800 Saint-Gaudens');
    setEventAddressType('default');
    setHasBottle(false);
    setBottles([{ type: '', quantity: 1 }]);
    setEventDate(new Date());
    setHasPayment(false);
    setPaymentAmount('');
    setPaymentMethod('');
    setIsAdding(false);
    fetchReservations();
  };

  const markAsPaid = async (id: string) => {
    const { error } = await supabase
      .from('reservations')
      .update({ payment_status: 'paid' })
      .eq('id', id);

    if (error) {
      toast.error('Erreur lors de la mise à jour du paiement');
      return;
    }

    toast.success('Paiement marqué comme payé');
    fetchReservations();
  };

  const deleteReservation = async (id: string) => {
    const { error } = await supabase.from('reservations').delete().eq('id', id);

    if (error) {
      toast.error('Erreur lors de la suppression');
      return;
    }

    toast.success('Réservation supprimée');
    fetchReservations();
  };

  const showQRCode = async (reservation: Reservation) => {
    setSelectedReservation(reservation);
    try {
      const colorHex = '#' + getEventColorHex(reservation.event_date);
      const dataUrl = await QRCode.toDataURL(reservation.qr_code, {
        width: 300,
        margin: 2,
        color: {
          dark: colorHex,
          light: '#ffffff',
        },
      });
      setQrCodeDataUrl(dataUrl);
      setQrDialogOpen(true);
    } catch (error) {
      toast.error('Erreur lors de la génération du QR code');
    }
  };

  // Apply search filters
  const searchFilteredReservations = reservations.filter(r => {
    const matchName = !searchName || r.client_name.toLowerCase().includes(searchName.toLowerCase());
    const matchEmail = !searchEmail || (r.client_email || '').toLowerCase().includes(searchEmail.toLowerCase());
    return matchName && matchEmail;
  });

  // Compute sorted dates for tabs from filtered results
  const dateGroups = searchFilteredReservations.reduce<Record<string, Reservation[]>>((acc, r) => {
    const date = r.event_date;
    if (!acc[date]) acc[date] = [];
    acc[date].push(r);
    return acc;
  }, {});
  const sortedDates = Object.keys(dateGroups).sort((a, b) => b.localeCompare(a));

  const activeDate = selectedDate && dateGroups[selectedDate] ? selectedDate : sortedDates[0] || null;
  const filteredReservations = activeDate ? dateGroups[activeDate] : [];

  const validatedCount = filteredReservations.filter(r => r.is_validated).length;
  const pendingCount = filteredReservations.filter(r => !r.is_validated).length;

  // Payment stats
  const reservationsWithPayment = filteredReservations.filter(r => r.amount && r.amount > 0);
  const totalCash = reservationsWithPayment
    .filter(r => r.payment_method === 'cash' && r.payment_status === 'paid')
    .reduce((sum, r) => sum + (r.amount || 0), 0);
  const totalCard = reservationsWithPayment
    .filter(r => r.payment_method === 'card' && r.payment_status === 'paid')
    .reduce((sum, r) => sum + (r.amount || 0), 0);
  const totalPending = reservationsWithPayment
    .filter(r => r.payment_status === 'pending')
    .reduce((sum, r) => sum + (r.amount || 0), 0);

  const exportGuestList = () => {
    const dataToExport = searchFilteredReservations;
    const header = ['Nom', 'Email', 'Nombre de personnes', 'Date événement', 'Statut'];
    const rows = dataToExport.map(r => [
      r.client_name,
      r.client_email || '',
      r.number_of_persons.toString(),
      r.event_date,
      r.is_validated ? 'Validé' : 'En attente',
    ]);
    const csvContent = [header, ...rows]
      .map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const suffix = searchName || searchEmail ? '-filtre' : '';
    link.download = `liste-invites${suffix}-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(`Liste exportée (${dataToExport.length} invités)`);
  };

  const printBottles = () => {
    if (!activeDate) return;
    // Gather bottles for the active date
    const dateBottles = bottleData
      .filter(b => {
        const res = b.reservations as any;
        return res?.event_date === activeDate;
      })
      .map(b => ({
        bottle_type: b.bottle_type,
        quantity: b.quantity,
        client_name: (b.reservations as any)?.client_name || '',
        price: b.quantity * 60,
      }));

    if (dateBottles.length === 0) {
      toast.error('Aucune bouteille pour cette date');
      return;
    }

    const total = dateBottles.reduce((s, b) => s + b.price, 0);
    const formattedDate = format(new Date(activeDate + 'T00:00:00'), 'dd/MM/yyyy');

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Bouteilles - ${formattedDate}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; color: #111; }
          h1 { font-size: 22px; margin-bottom: 4px; }
          h2 { font-size: 14px; color: #666; margin-bottom: 24px; font-weight: normal; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th, td { padding: 10px 12px; text-align: left; border-bottom: 1px solid #ddd; }
          th { background: #f5f5f5; font-size: 13px; text-transform: uppercase; color: #555; }
          td { font-size: 14px; }
          .total-row { font-weight: bold; font-size: 16px; border-top: 2px solid #111; }
          .price { text-align: right; }
          @media print { body { padding: 20px; } }
        </style>
      </head>
      <body>
        <h1>Récapitulatif Bouteilles</h1>
        <h2>Événement du ${formattedDate}</h2>
        <table>
          <thead>
            <tr>
              <th>Client</th>
              <th>Bouteille</th>
              <th>Quantité</th>
              <th class="price">Prix</th>
            </tr>
          </thead>
          <tbody>
            ${dateBottles.map(b => {
              const esc = (s: string) => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
              return `
              <tr>
                <td>${esc(b.client_name)}</td>
                <td>${esc(b.bottle_type)}</td>
                <td>${b.quantity}</td>
                <td class="price">${b.price}€</td>
              </tr>`;
            }).join('')}
            <tr class="total-row">
              <td colspan="3">Total</td>
              <td class="price">${total}€</td>
            </tr>
          </tbody>
        </table>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <motion.header
        className="px-4 py-3 md:px-6 md:py-4 border-b border-border"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        {/* Top row: back + title + icon actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 md:gap-4">
            <Link to="/">
              <Button variant="ghost" size="icon" className="h-10 w-10">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-base md:text-lg font-bold text-foreground">Administration</h1>
              <p className="text-[10px] md:text-xs text-muted-foreground">Gestion des réservations</p>
            </div>
          </div>
          <div className="flex items-center gap-1 md:gap-2">
            <Button
              variant={pushSubscribed ? "default" : "outline"}
              size="icon"
              className="h-9 w-9 md:h-10 md:w-10"
              onClick={async () => {
                if (!pushSupported) {
                  toast.error("Les notifications push ne sont pas supportées sur ce navigateur. Sur iPhone, installez l'app sur l'écran d'accueil d'abord.");
                  return;
                }
                if (pushSubscribed) {
                  await pushUnsubscribe();
                  toast.success('Notifications push désactivées');
                } else {
                  await pushSubscribe();
                  if (pushPermission === 'denied') {
                    toast.error('Les notifications sont bloquées dans les paramètres de votre navigateur');
                  } else {
                    toast.success('Notifications push activées !');
                  }
                }
              }}
              disabled={pushLoading}
              title={pushSubscribed ? 'Désactiver les notifications push' : pushSupported ? 'Activer les notifications push' : 'Notifications push non supportées'}
            >
              {pushSubscribed ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
            </Button>
            <Button
              variant="ghost" 
              size="icon"
              className="h-9 w-9 md:h-10 md:w-10"
              onClick={async () => {
                await signOut();
                toast.success('Déconnexion réussie');
              }}
              title="Se déconnecter"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Bottom row: action buttons — horizontal scroll on mobile */}
        <div className="flex items-center gap-2 mt-3 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
          <Button
            variant="outline"
            className="gap-1.5 h-8 px-3 text-xs whitespace-nowrap shrink-0"
            onClick={exportGuestList}
            disabled={reservations.length === 0}
          >
            <Download className="w-3.5 h-3.5" />
            Exporter CSV
          </Button>
          <Button
            variant="outline"
            className="gap-1.5 h-8 px-3 text-xs whitespace-nowrap shrink-0"
            onClick={() => {
              const emails = [...new Set(reservations.map(r => r.client_email).filter(Boolean))].join(', ');
              if (!emails) { toast.error('Aucune adresse email'); return; }
              navigator.clipboard.writeText(emails);
              toast.success(`${emails.split(', ').length} emails copiés`);
            }}
            disabled={reservations.length === 0}
          >
            <Copy className="w-3.5 h-3.5" />
            Copier emails
          </Button>
          <Button
            variant="outline"
            className="gap-1.5 h-8 px-3 text-xs whitespace-nowrap shrink-0"
            onClick={printBottles}
            disabled={!activeDate}
          >
            <Printer className="w-3.5 h-3.5" />
            Bouteilles
          </Button>
          <Button 
            variant="outline" 
            className="gap-1.5 h-8 px-3 text-xs whitespace-nowrap shrink-0"
            onClick={() => setUserDialogOpen(true)}
          >
            <UserPlus className="w-3.5 h-3.5" />
            Utilisateur
          </Button>
        </div>
      </motion.header>

      <main className="p-6 max-w-4xl mx-auto space-y-6">
        {/* Stats */}
        <motion.div
          className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4"
        >
          <Card>
            <CardContent className="p-3 md:pt-6 md:px-6">
              <div className="flex items-center gap-2 md:gap-3">
                <Users className="w-6 h-6 md:w-8 md:h-8 text-primary shrink-0" />
                <div className="min-w-0">
                  <p className="text-xl md:text-2xl font-bold truncate">{filteredReservations.length}</p>
                  <p className="text-[10px] md:text-xs text-muted-foreground truncate">Réservations</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 md:pt-6 md:px-6">
              <div className="flex items-center gap-2 md:gap-3">
                <Users className="w-6 h-6 md:w-8 md:h-8 text-primary/70 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xl md:text-2xl font-bold truncate">{filteredReservations.length}</p>
                  <p className="text-[10px] md:text-xs text-muted-foreground truncate">Personnes</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 md:pt-6 md:px-6">
              <div className="flex items-center gap-2 md:gap-3">
                <CheckCircle className="w-6 h-6 md:w-8 md:h-8 text-valid shrink-0" />
                <div className="min-w-0">
                  <p className="text-xl md:text-2xl font-bold truncate">{validatedCount}</p>
                  <p className="text-[10px] md:text-xs text-muted-foreground truncate">Validés</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 md:pt-6 md:px-6">
              <div className="flex items-center gap-2 md:gap-3">
                <Clock className="w-6 h-6 md:w-8 md:h-8 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-xl md:text-2xl font-bold truncate">{pendingCount}</p>
                  <p className="text-[10px] md:text-xs text-muted-foreground truncate">En attente</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Payment Stats */}
        {reservationsWithPayment.length > 0 && (
          <motion.div
            className="grid grid-cols-3 gap-3 md:gap-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
          >
            <Card>
              <CardContent className="p-3 md:pt-6 md:px-6">
                <div className="flex items-center gap-2 md:gap-3">
                  <Banknote className="w-5 h-5 md:w-8 md:h-8 text-valid shrink-0" />
                  <div className="min-w-0">
                    <p className="text-base md:text-2xl font-bold truncate">{totalCash.toFixed(2)}€</p>
                    <p className="text-[10px] md:text-xs text-muted-foreground truncate">Espèces</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 md:pt-6 md:px-6">
                <div className="flex items-center gap-2 md:gap-3">
                  <CreditCard className="w-5 h-5 md:w-8 md:h-8 text-primary shrink-0" />
                  <div className="min-w-0">
                    <p className="text-base md:text-2xl font-bold truncate">{totalCard.toFixed(2)}€</p>
                    <p className="text-[10px] md:text-xs text-muted-foreground truncate">Carte</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 md:pt-6 md:px-6">
                <div className="flex items-center gap-2 md:gap-3">
                  <Clock className="w-5 h-5 md:w-8 md:h-8 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="text-base md:text-2xl font-bold truncate">{totalPending.toFixed(2)}€</p>
                    <p className="text-[10px] md:text-xs text-muted-foreground truncate">En attente</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Add new reservation */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card>
            <CardHeader className="px-4 py-3 md:px-6 md:py-4">
              <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                <Plus className="w-4 h-4 md:w-5 md:h-5" />
                Nouvelle réservation
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 md:px-6 md:pb-6 space-y-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3 md:gap-4">
                {newPersons <= 1 && (
                  <div className="space-y-2">
                    <Label htmlFor="name">Nom du client *</Label>
                    <Input
                      id="name"
                      placeholder="Jean Dupont"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="jean@example.com"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="persons">Nombre de personnes</Label>
                  <Input
                    id="persons"
                    type="number"
                    min={1}
                    value={newPersons}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 1;
                      setNewPersons(val);
                      if (val > 1) {
                        setPersonNames(prev => {
                          const updated = [...prev];
                          while (updated.length < val) updated.push('');
                          return updated.slice(0, val);
                        });
                      } else {
                        setPersonNames([]);
                      }
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Date de l'événement *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !eventDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {eventDate ? format(eventDate, "PPP", { locale: fr }) : "Choisir une date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={eventDate}
                        onSelect={(d) => d && setEventDate(d)}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="eventTime">Heure de l'événement</Label>
                    <Input
                      id="eventTime"
                      type="time"
                      value={eventTime}
                      onChange={(e) => setEventTime(e.target.value)}
                      placeholder="23:00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Adresse du lieu</Label>
                    <Select
                      value={eventAddressType}
                      onValueChange={(val: 'default' | 'other') => {
                        setEventAddressType(val);
                        if (val === 'default') {
                          setEventAddress('Café Le Français, Place Napoléon, 31800 Saint-Gaudens');
                        } else {
                          setEventAddress('');
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="default">Café Le Français, Saint-Gaudens</SelectItem>
                        <SelectItem value="other">Autre adresse...</SelectItem>
                      </SelectContent>
                    </Select>
                    {eventAddressType === 'other' && (
                      <Input
                        placeholder="Saisir l'adresse du lieu"
                        value={eventAddress}
                        onChange={(e) => setEventAddress(e.target.value)}
                      />
                    )}
                  </div>
                </div>
              </div>
              {newPersons > 1 && (
                <div className="space-y-3">
                  <Label>Noms des personnes *</Label>
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2 md:gap-3">
                    {Array.from({ length: newPersons }, (_, i) => (
                      <Input
                        key={i}
                        placeholder={`Personne ${i + 1}`}
                        value={personNames[i] || ''}
                        onChange={(e) => {
                          const updated = [...personNames];
                          updated[i] = e.target.value;
                          setPersonNames(updated);
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}
              {/* Bottle option */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="hasBottle"
                    checked={hasBottle}
                    onCheckedChange={(checked) => {
                      setHasBottle(!!checked);
                      if (!checked) setBottles([{ type: '', quantity: 1 }]);
                    }}
                  />
                  <Label htmlFor="hasBottle" className="flex items-center gap-1 cursor-pointer">
                    <Wine className="w-4 h-4" />
                    Avec bouteille
                  </Label>
                </div>

                {hasBottle && (
                  <div className="space-y-3 pl-4 md:pl-6 border-l-2 border-primary/20">
                    {bottles.map((bottle, i) => (
                      <div key={i} className="flex items-end gap-2">
                        <div className="flex-1 space-y-1">
                          <Label className="text-xs">Type de bouteille</Label>
                          <Input
                            placeholder="Ex: Champagne, Vodka..."
                            value={bottle.type}
                            onChange={(e) => {
                              const updated = [...bottles];
                              updated[i] = { ...updated[i], type: e.target.value };
                              setBottles(updated);
                            }}
                          />
                        </div>
                        <div className="w-20 space-y-1">
                          <Label className="text-xs">Qté</Label>
                          <Input
                            type="number"
                            min={1}
                            value={bottle.quantity}
                            onChange={(e) => {
                              const updated = [...bottles];
                              updated[i] = { ...updated[i], quantity: parseInt(e.target.value) || 1 };
                              setBottles(updated);
                            }}
                          />
                        </div>
                        {bottles.length > 1 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10 shrink-0"
                            onClick={() => setBottles(bottles.filter((_, j) => j !== i))}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setBottles([...bottles, { type: '', quantity: 1 }])}
                      className="gap-1"
                    >
                      <Plus className="w-3 h-3" />
                      Ajouter une bouteille
                    </Button>
                    <div className="bg-muted/50 rounded-md p-3 space-y-1">
                      {bottles.filter(b => b.type.trim()).map((b, i) => (
                        <div key={i} className="flex justify-between text-sm">
                          <span>{b.type} × {b.quantity}</span>
                          <span className="font-medium">{b.quantity * 60}€</span>
                        </div>
                      ))}
                      <div className="border-t border-border pt-1 flex justify-between font-bold">
                        <span>Sous-total bouteilles</span>
                        <span>{bottles.reduce((sum, b) => sum + b.quantity * 60, 0)}€</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Payment option */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="hasPayment"
                    checked={hasPayment}
                    onCheckedChange={(checked) => {
                      setHasPayment(!!checked);
                      if (!checked) {
                        setPaymentAmount('');
                        setPaymentMethod('');
                      }
                    }}
                  />
                  <Label htmlFor="hasPayment" className="flex items-center gap-1 cursor-pointer">
                    <CreditCard className="w-4 h-4" />
                    Avec paiement
                  </Label>
                </div>

                {hasPayment && (
                  <div className="space-y-3 pl-4 md:pl-6 border-l-2 border-primary/20">
                    <div className="space-y-2">
                      <Label className="text-xs">Montant (€)</Label>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder="0.00"
                        value={paymentAmount}
                        onChange={(e) => setPaymentAmount(e.target.value)}
                      />
                    </div>
                    {paymentAmount && parseFloat(paymentAmount) > 0 && (
                      <div className="space-y-2">
                        <Label className="text-xs">Mode de paiement</Label>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant={paymentMethod === 'cash' ? 'default' : 'outline'}
                            className="flex-1 gap-2"
                            onClick={() => setPaymentMethod('cash')}
                          >
                            <Banknote className="w-4 h-4" />
                            Espèces
                          </Button>
                          <Button
                            type="button"
                            variant={paymentMethod === 'card' ? 'default' : 'outline'}
                            className="flex-1 gap-2"
                            onClick={() => setPaymentMethod('card')}
                          >
                            <CreditCard className="w-4 h-4" />
                            CB (SumUp)
                          </Button>
                        </div>
                      </div>
                    )}
                    {paymentAmount && parseFloat(paymentAmount) > 0 && paymentMethod === 'cash' && (
                      <p className="text-sm text-muted-foreground">💵 Le paiement sera marqué comme reçu en espèces.</p>
                    )}
                    {paymentAmount && parseFloat(paymentAmount) > 0 && paymentMethod === 'card' && (
                      <p className="text-sm text-muted-foreground">💳 Vous serez redirigé vers SumUp pour effectuer le paiement. La réservation ne sera validée qu'après confirmation du paiement.</p>
                    )}
                  </div>
                )}
              </div>

              <Button onClick={addReservation} disabled={isAdding} className="w-full h-12 md:h-10 md:w-auto text-sm">
                <Send className="w-4 h-4 mr-2" />
                {isAdding ? 'Création et envoi...' : `Créer et envoyer ${newPersons > 1 ? newPersons + ' tickets' : 'le ticket'}`}
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        {/* Flyer Invitations */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <Card>
            <CardHeader className="px-4 py-3 md:p-6">
              <CardTitle className="flex items-center gap-2 text-lg md:text-2xl">
                <Ticket className="w-4 h-4 md:w-5 md:h-5" />
                Invitations Flyer
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 md:px-6 md:pb-6 space-y-3 md:space-y-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3 md:gap-4">
                <div className="space-y-2">
                  <Label>Nom du flyer *</Label>
                  <Input
                    placeholder="Ex: Soirée VIP Mars"
                    value={newFlyerLabel}
                    onChange={(e) => setNewFlyerLabel(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Date de l'événement *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn("w-full justify-start text-left font-normal")}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {format(flyerDate, "PPP", { locale: fr })}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={flyerDate}
                        onSelect={(d) => d && setFlyerDate(d)}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="flex items-end">
                  <Button
                    onClick={async () => {
                      if (!newFlyerLabel.trim()) {
                        toast.error('Le nom du flyer est requis');
                        return;
                      }
                      setIsAddingFlyer(true);
                      const qrCode = `FLYER-${crypto.randomUUID().toUpperCase()}`;
                      const { error } = await supabase.from('flyer_invitations').insert({
                        label: newFlyerLabel.trim(),
                        event_date: format(flyerDate, 'yyyy-MM-dd'),
                        qr_code: qrCode,
                      } as any);
                      if (error) {
                        toast.error('Erreur lors de la création');
                      } else {
                        toast.success('Invitation flyer créée');
                        setNewFlyerLabel('');
                        fetchReservations();
                      }
                      setIsAddingFlyer(false);
                    }}
                    disabled={isAddingFlyer}
                    className="w-full h-12 md:h-10"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    {isAddingFlyer ? 'Création...' : 'Créer le flyer'}
                  </Button>
                </div>
              </div>

              {/* List existing flyers */}
              {flyers.length > 0 && (
                <div className="space-y-2 md:space-y-3 mt-3 md:mt-4">
                  {flyers.map((flyer) => (
                    <div
                      key={flyer.id}
                      className="p-3 md:p-4 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2 md:gap-4 min-w-0">
                        <div className="p-1.5 md:p-2 rounded-full bg-primary/10 shrink-0">
                          <Ticket className="w-4 h-4 md:w-5 md:h-5 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-sm md:text-base text-foreground truncate">{flyer.label}</p>
                          <p className="text-xs md:text-sm text-muted-foreground truncate">
                            {format(new Date(flyer.event_date + 'T00:00:00'), 'dd/MM/yyyy')} • {flyer.scan_count} scan{flyer.scan_count !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 md:gap-2 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={async () => {
                            setSelectedFlyer(flyer);
                            const colorHex = '#' + getEventColorHex(flyer.event_date);
                            const dataUrl = await QRCode.toDataURL(flyer.qr_code, {
                              width: 300,
                              margin: 2,
                              color: { dark: colorHex, light: '#ffffff' },
                            });
                            setFlyerQrDataUrl(dataUrl);
                            setFlyerQrDialogOpen(true);
                          }}
                          title="Voir le QR code"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={async () => {
                            const { error } = await supabase.from('flyer_invitations').delete().eq('id', flyer.id);
                            if (error) {
                              toast.error('Erreur lors de la suppression');
                            } else {
                              toast.success('Flyer supprimé');
                              fetchReservations();
                            }
                          }}
                          title="Supprimer"
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>


        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card>
            <CardHeader className="px-4 py-3 md:p-6">
              <CardTitle className="flex items-center gap-2 text-base md:text-2xl">
                <Users className="w-4 h-4 md:w-5 md:h-5" />
                Réservations ({searchFilteredReservations.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 md:px-6 md:pb-6">
              {/* Search filters */}
              <div className="flex flex-col md:flex-row gap-3 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher par nom..."
                    value={searchName}
                    onChange={(e) => setSearchName(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <div className="relative flex-1">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher par email..."
                    value={searchEmail}
                    onChange={(e) => setSearchEmail(e.target.value)}
                    className="pl-9"
                  />
                </div>
                {(searchName || searchEmail) && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => { setSearchName(''); setSearchEmail(''); }}
                    title="Effacer les filtres"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : reservations.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Aucune réservation pour le moment
                </p>
              ) : activeDate ? (
                  <Tabs value={activeDate} onValueChange={setSelectedDate} className="w-full">
                    <TabsList className="w-full flex flex-wrap h-auto gap-1 mb-4">
                      {sortedDates.map(date => (
                        <TabsTrigger key={date} value={date} className="text-xs">
                          {format(new Date(date + 'T00:00:00'), 'dd/MM/yyyy')} ({dateGroups[date].length})
                        </TabsTrigger>
                      ))}
                    </TabsList>
                    {sortedDates.map(date => {
                      // Get bottles for this date
                      const dateBottles = bottleData.filter(b => {
                        const res = b.reservations as any;
                        return res?.event_date === date;
                      }).map(b => ({
                        bottle_type: b.bottle_type,
                        quantity: b.quantity,
                        client_name: (b.reservations as any)?.client_name || '',
                      }));
                      const bottleTotal = dateBottles.reduce((s, i) => s + i.quantity * 60, 0);

                      return (
                        <TabsContent key={date} value={date}>
                          <div className="space-y-3">
                            {dateGroups[date].map((reservation) => {
                              // Get bottles for this specific reservation
                              const resBottles = bottleData.filter(b => b.reservation_id === reservation.id);
                              return (
                              <motion.div
                                key={reservation.id}
                                className={cn(
                                  "p-3 md:p-4 rounded-lg hover:bg-secondary transition-colors border-l-4",
                                  reservation.amount && reservation.amount > 0
                                    ? reservation.payment_status === 'paid'
                                      ? 'bg-valid/5 border-l-valid'
                                      : reservation.payment_status === 'failed'
                                        ? 'bg-destructive/5 border-l-destructive'
                                        : 'bg-amber-50 dark:bg-amber-950/20 border-l-amber-400'
                                    : 'bg-secondary/50 border-l-transparent'
                                )}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                              >
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                                  <div className="flex items-center gap-2 md:gap-4 min-w-0">
                                    <div className={`p-1.5 md:p-2 rounded-full shrink-0 ${reservation.is_validated ? 'bg-valid/20' : 'bg-muted'}`}>
                                      {reservation.is_validated ? (
                                        <CheckCircle className="w-4 h-4 md:w-5 md:h-5 text-valid" />
                                      ) : (
                                        <QrCode className="w-4 h-4 md:w-5 md:h-5 text-muted-foreground" />
                                      )}
                                    </div>
                                    <div className="min-w-0">
                                      <p className="font-medium text-sm md:text-base text-foreground truncate">
                                        {reservation.client_name}
                                        <span className="ml-2 text-sm text-muted-foreground">
                                          ({reservation.number_of_persons} pers.)
                                        </span>
                                      </p>
                                      <p className="text-sm text-muted-foreground">
                                        {reservation.is_validated
                                          ? `Validé le ${new Date(reservation.validated_at!).toLocaleString('fr-FR')}`
                                          : reservation.client_email || 'Pas d\'email'}
                                      </p>
                                      {reservation.amount != null && reservation.amount > 0 && (
                                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                          <p className="text-xs flex items-center gap-1">
                                            {reservation.payment_method === 'card' ? (
                                              <CreditCard className="w-3 h-3" />
                                            ) : (
                                              <Banknote className="w-3 h-3" />
                                            )}
                                            <span className="font-medium">{reservation.amount}€</span>
                                            <span className={cn(
                                              "px-1.5 py-0.5 rounded text-[10px] font-medium",
                                              reservation.payment_status === 'paid' ? 'bg-valid/20 text-valid' :
                                              reservation.payment_status === 'failed' ? 'bg-destructive/20 text-destructive' :
                                              'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                                            )}>
                                              {reservation.payment_status === 'paid' ? '✅ Payé' : reservation.payment_status === 'failed' ? '❌ Échoué' : '⏳ En attente'}
                                            </span>
                                          </p>
                                          {reservation.payment_method === 'card' && reservation.payment_status !== 'paid' && (
                                            <button
                                              onClick={async (e) => {
                                                e.stopPropagation();
                                                try {
                                                  const { data: checkoutData, error: checkoutError } = await supabase.functions.invoke('create-sumup-checkout', {
                                                    body: {
                                                      amount: reservation.amount,
                                                      description: `Réservation ${reservation.client_name}`,
                                                      reservation_id: reservation.id,
                                                      redirect_url: window.location.origin + '/admin',
                                                    },
                                                  });
                                                  if (checkoutError) throw checkoutError;
                                                  if (checkoutData?.checkout_id) {
                                                    setPendingCardReservations([reservation]);
                                                    setSumupCheckoutId(checkoutData.checkout_id);
                                                    setSumupDialogOpen(true);
                                                  }
                                                } catch (err) {
                                                  console.error('SumUp retry error:', err);
                                                  toast.error('Erreur lors de la relance du paiement');
                                                }
                                              }}
                                              className="px-2 py-0.5 rounded text-[10px] font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors flex items-center gap-1"
                                              title="Relancer le paiement CB"
                                            >
                                              💳 Relancer
                                            </button>
                                          )}
                                          {reservation.payment_status !== 'paid' && reservation.amount > 0 && (
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                markAsPaid(reservation.id);
                                              }}
                                              className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary/20 text-primary hover:bg-primary/30 transition-colors"
                                              title="Marquer comme payé"
                                            >
                                              ✓ Payé
                                            </button>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1 md:gap-2 shrink-0 self-end md:self-auto">
                                    {reservation.client_email && (
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => sendTicketEmail(reservation)}
                                        disabled={sendingEmail === reservation.id}
                                        title="Renvoyer le ticket"
                                      >
                                        {sendingEmail === reservation.id ? (
                                          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                                        ) : (
                                          <Mail className="w-4 h-4" />
                                        )}
                                      </Button>
                                    )}
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => showQRCode(reservation)}
                                      title="Voir le QR code"
                                    >
                                      <Eye className="w-4 h-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => deleteReservation(reservation.id)}
                                      title="Supprimer"
                                    >
                                      <Trash2 className="w-4 h-4 text-destructive" />
                                    </Button>
                                  </div>
                                </div>
                                {resBottles.length > 0 && (
                                  <div className="mt-2 ml-8 md:ml-14 flex flex-wrap gap-1.5 md:gap-2">
                                    {resBottles.map((b, i) => (
                                      <span key={i} className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary rounded-full px-2.5 py-1">
                                        <Wine className="w-3 h-3" />
                                        {b.bottle_type} × {b.quantity} ({b.quantity * 60}€)
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </motion.div>
                              );
                            })}

                            {/* Total bouteilles pour la date */}
                            {bottleTotal > 0 && (
                              <div className="mt-2 p-3 rounded-lg bg-primary/5 border border-primary/10 flex justify-between items-center">
                                <span className="flex items-center gap-2 font-semibold text-sm">
                                  <Wine className="w-4 h-4" />
                                  Total bouteilles
                                </span>
                                <span className="font-bold">{bottleTotal}€</span>
                              </div>
                            )}
                          </div>
                        </TabsContent>
                      );
                    })}
                  </Tabs>
              ) : null}
            </CardContent>
          </Card>
        </motion.div>

        {/* Arrival History */}
        <ArrivalHistory />

        <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-center">
                QR Code - {selectedReservation?.client_name}
              </DialogTitle>
            </DialogHeader>
            <div className="flex flex-col items-center gap-4 py-4">
              <h2 
                className="text-2xl font-black tracking-wider"
                style={{ color: selectedReservation ? getEventColor(selectedReservation.event_date) : undefined }}
              >
                L'ACCESS
              </h2>
              {qrCodeDataUrl && (
                <img 
                  src={qrCodeDataUrl} 
                  alt="QR Code" 
                  className="w-64 h-64 rounded-lg border border-border"
                />
              )}
              <p className="font-semibold text-foreground text-lg">
                {selectedReservation?.client_name}
              </p>
              <p className="text-sm text-muted-foreground font-mono break-all text-center px-4">
                {selectedReservation?.qr_code}
              </p>
              <p className="text-sm text-muted-foreground">
                {selectedReservation?.event_date && format(new Date(selectedReservation.event_date + 'T00:00:00'), 'dd/MM/yyyy')}
              </p>
            </div>
          </DialogContent>
        </Dialog>

        {/* Add User Dialog */}
        <Dialog open={userDialogOpen} onOpenChange={setUserDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Ajouter un utilisateur</DialogTitle>
              <DialogDescription>
                L'utilisateur doit d'abord créer un compte sur la page de connexion.
                Ensuite, entrez son email ici pour lui attribuer un rôle.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="user-email">Email de l'utilisateur</Label>
                <Input
                  id="user-email"
                  type="email"
                  placeholder="agent@example.com"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="user-role">Rôle</Label>
                <Select value={newUserRole} onValueChange={(v) => setNewUserRole(v as 'admin' | 'agent')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="agent">Agent (scanner uniquement)</SelectItem>
                    <SelectItem value="admin">Admin (accès complet)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button 
                className="w-full"
                disabled={isAddingUser || !newUserEmail}
                onClick={async () => {
                  setIsAddingUser(true);
                  try {
                    // Find user by email via auth admin API (need edge function)
                    const { data, error } = await supabase.functions.invoke('assign-user-role', {
                      body: { email: newUserEmail, role: newUserRole }
                    });
                    
                    if (error) throw error;
                    if (!data.success) throw new Error(data.error);
                    
                    toast.success(`Rôle "${newUserRole}" attribué à ${newUserEmail}`);
                    setNewUserEmail('');
                    setUserDialogOpen(false);
                  } catch (err: any) {
                    toast.error(err.message || 'Erreur lors de l\'attribution du rôle');
                  } finally {
                    setIsAddingUser(false);
                  }
                }}
              >
                {isAddingUser ? 'Attribution...' : 'Attribuer le rôle'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Flyer QR Code Dialog */}
        <Dialog open={flyerQrDialogOpen} onOpenChange={setFlyerQrDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-center">
                QR Code Flyer - {selectedFlyer?.label}
              </DialogTitle>
            </DialogHeader>
            <div className="flex flex-col items-center gap-4 py-4">
              <h2 
                className="text-2xl font-black tracking-wider"
                style={{ color: selectedFlyer ? getEventColor(selectedFlyer.event_date) : undefined }}
              >
                L'ACCESS
              </h2>
              {flyerQrDataUrl && (
                <img 
                  src={flyerQrDataUrl} 
                  alt="QR Code Flyer" 
                  className="w-64 h-64 rounded-lg border border-border"
                />
              )}
              <p className="font-semibold text-foreground text-lg">
                {selectedFlyer?.label}
              </p>
              <p className="text-sm text-muted-foreground">
                {selectedFlyer?.event_date && format(new Date(selectedFlyer.event_date + 'T00:00:00'), 'dd/MM/yyyy')}
              </p>
              <p className="text-xs text-muted-foreground">
                {selectedFlyer?.scan_count} scan{(selectedFlyer?.scan_count || 0) !== 1 ? 's' : ''} enregistré{(selectedFlyer?.scan_count || 0) !== 1 ? 's' : ''}
              </p>
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => {
                  if (!flyerQrDataUrl) return;
                  const link = document.createElement('a');
                  link.href = flyerQrDataUrl;
                  link.download = `flyer-qr-${selectedFlyer?.label || 'code'}.png`;
                  link.click();
                  toast.success('QR code téléchargé');
                }}
              >
                <Download className="w-4 h-4" />
                Télécharger le QR code
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* SumUp Payment Dialog */}
        <Dialog open={sumupDialogOpen} onOpenChange={(open) => {
          setSumupDialogOpen(open);
          if (!open) {
            setSumupCheckoutId(null);
            fetchReservations();
          }
        }}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Paiement par carte bancaire
              </DialogTitle>
              <DialogDescription>
                Complétez le paiement ci-dessous via SumUp.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              {sumupCheckoutId && (
                <SumUpPaymentWidget
                  checkoutId={sumupCheckoutId}
                  onComplete={async () => {
                    toast.success('💳 Paiement confirmé ! Envoi du ticket en cours...');
                    // Now send the email after successful payment
                    if (pendingCardReservations && pendingCardReservations.length > 0 && pendingCardReservations[0].client_email) {
                      await sendTicketEmail(pendingCardReservations);
                    }
                    setPendingCardReservations(null);
                    setSumupDialogOpen(false);
                    setSumupCheckoutId(null);
                    fetchReservations();
                  }}
                  onClose={() => {
                    if (pendingCardReservations) {
                      toast.warning('⚠️ Paiement non effectué. La réservation reste en attente.');
                    }
                    setPendingCardReservations(null);
                    setSumupDialogOpen(false);
                    setSumupCheckoutId(null);
                    fetchReservations();
                  }}
                />
              )}
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};

// SumUp Card Payment Widget
const SumUpPaymentWidget = ({ checkoutId, onComplete, onClose }: {
  checkoutId: string;
  onComplete: () => void;
  onClose: () => void;
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mounted = true;

    const loadWidget = async () => {
      // Load SumUp SDK if not already loaded
      if (!(window as any).SumUpCard) {
        const script = document.createElement('script');
        script.src = 'https://gateway.sumup.com/gateway/ecom/card/v2/sdk.js';
        script.async = true;
        await new Promise<void>((resolve, reject) => {
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('Failed to load SumUp SDK'));
          document.head.appendChild(script);
        });
      }

      if (!mounted || !containerRef.current) return;

      const SumUpCard = (window as any).SumUpCard;
      if (SumUpCard) {
        SumUpCard.mount({
          id: 'sumup-card-container',
          checkoutId,
          onResponse: (_type: string, body: any) => {
            if (body?.status === 'PAID') {
              onComplete();
            }
          },
        });
      }
    };

    loadWidget().catch((err) => {
      console.error('SumUp widget error:', err);
      toast.error('Impossible de charger le formulaire de paiement');
    });

    return () => {
      mounted = false;
    };
  }, [checkoutId]);

  return (
    <div className="space-y-4">
      <div id="sumup-card-container" ref={containerRef} className="min-h-[300px]" />
      <p className="text-xs text-muted-foreground text-center">
        Paiement sécurisé traité par SumUp
      </p>
      <Button
        variant="outline"
        className="w-full"
        onClick={onClose}
      >
        Fermer et vérifier plus tard
      </Button>
    </div>
  );
};


// Admin now uses ProtectedRoute for authentication
export default AdminContent;
