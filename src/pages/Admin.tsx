import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Plus, Users, CheckCircle, Clock, Trash2, Send, QrCode, Mail, Eye, LogOut, UserPlus, Download, CalendarIcon, Wine, X, Printer, Copy, Ticket } from 'lucide-react';
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
}

interface BottleWithReservation {
  bottle_type: string;
  quantity: number;
  reservation_id: string;
  reservations: { client_name: string; event_date: string } | null;
}

const AdminContent = () => {
  const { signOut } = useAuth();
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
  const [sendingEmail, setSendingEmail] = useState<string | null>(null);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  
  // User management
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState<'admin' | 'agent'>('agent');
  const [isAddingUser, setIsAddingUser] = useState(false);

  const [bottleData, setBottleData] = useState<BottleWithReservation[]>([]);

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

    setReservations(data || []);
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

    // Subscribe to realtime changes
    const channel = supabase
      .channel('reservations-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reservations',
        },
        (payload) => {
          console.log('Realtime update:', payload);
          // Refresh the list when any change occurs
          fetchReservations();
        }
      )
      .subscribe();

    // Cleanup subscription on unmount
    return () => {
      supabase.removeChannel(channel);
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

  const sendTicketEmail = async (reservation: Reservation) => {
    if (!reservation.client_email) {
      toast.error('Pas d\'adresse email pour ce client');
      return;
    }

    setSendingEmail(reservation.id);

    try {
      const colorHex = getEventColorHex(reservation.event_date);
      const { data, error } = await supabase.functions.invoke('send-ticket-email', {
        body: {
          clientName: reservation.client_name,
          clientEmail: reservation.client_email,
          qrCode: reservation.qr_code,
          eventName: 'Soirée',
          eventDate: reservation.event_date,
          qrColor: colorHex,
        },
      });

      if (error) throw error;

      if (data.success) {
        toast.success(`Ticket envoyé à ${reservation.client_email}`);
      } else {
        throw new Error(data.error || 'Erreur lors de l\'envoi');
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

    const reservationsToInsert = names.map(name => ({
      client_name: name,
      client_email: newEmail.trim(),
      qr_code: generateQRCode(),
      number_of_persons: 1,
      event_date: eventDateStr,
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
    
    // Send emails for each reservation
    if (data) {
      for (const reservation of data) {
        if (reservation.client_email) {
          await sendTicketEmail(reservation);
        }
      }
    }

    setNewName('');
    setNewEmail('');
    setNewPersons(1);
    setPersonNames([]);
    setHasBottle(false);
    setBottles([{ type: '', quantity: 1 }]);
    setEventDate(new Date());
    setIsAdding(false);
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

  // Compute sorted dates for tabs
  const dateGroups = reservations.reduce<Record<string, Reservation[]>>((acc, r) => {
    const date = r.event_date;
    if (!acc[date]) acc[date] = [];
    acc[date].push(r);
    return acc;
  }, {});
  const sortedDates = Object.keys(dateGroups).sort((a, b) => b.localeCompare(a));

  // Auto-select first date if none selected or selected date no longer exists
  const activeDate = selectedDate && dateGroups[selectedDate] ? selectedDate : sortedDates[0] || null;
  const filteredReservations = activeDate ? dateGroups[activeDate] : [];

  const validatedCount = filteredReservations.filter(r => r.is_validated).length;
  const pendingCount = filteredReservations.filter(r => !r.is_validated).length;

  const exportGuestList = () => {
    const header = ['Nom', 'Email', 'Nombre de personnes', 'Date événement', 'Statut'];
    const rows = reservations.map(r => [
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
    link.download = `liste-invites-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(`Liste exportée (${reservations.length} invités)`);
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
            ${dateBottles.map(b => `
              <tr>
                <td>${b.client_name}</td>
                <td>${b.bottle_type}</td>
                <td>${b.quantity}</td>
                <td class="price">${b.price}€</td>
              </tr>
            `).join('')}
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
        className="px-4 py-5 md:px-6 md:py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center gap-4">
          <Link to="/">
            <Button variant="ghost" size="icon" className="h-12 w-12 md:h-10 md:w-10">
              <ArrowLeft className="w-6 h-6 md:w-5 md:h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-lg font-bold text-foreground">Administration</h1>
            <p className="text-xs text-muted-foreground">Gestion des réservations</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            className="gap-2 h-12 px-4 md:h-10 text-sm flex-1 md:flex-none"
            onClick={exportGuestList}
            disabled={reservations.length === 0}
            title="Exporter la liste des invités"
          >
            <Download className="w-5 h-5 md:w-4 md:h-4" />
            <span className="md:inline">Exporter CSV</span>
          </Button>
          <Button
            variant="outline"
            className="gap-2 h-12 px-4 md:h-10 text-sm flex-1 md:flex-none"
            onClick={() => {
              const emails = [...new Set(reservations.map(r => r.client_email).filter(Boolean))].join(', ');
              if (!emails) { toast.error('Aucune adresse email'); return; }
              navigator.clipboard.writeText(emails);
              toast.success(`${emails.split(', ').length} emails copiés`);
            }}
            disabled={reservations.length === 0}
            title="Copier les emails"
          >
            <Copy className="w-5 h-5 md:w-4 md:h-4" />
            <span className="md:inline">Copier emails</span>
          </Button>
          <Button
            variant="outline"
            className="gap-2 h-12 px-4 md:h-10 text-sm flex-1 md:flex-none"
            onClick={printBottles}
            disabled={!activeDate}
            title="Imprimer les bouteilles"
          >
            <Printer className="w-5 h-5 md:w-4 md:h-4" />
            <span className="md:inline">Imprimer bouteilles</span>
          </Button>
          <Button 
            variant="outline" 
            className="gap-2 h-12 px-4 md:h-10 text-sm flex-1 md:flex-none"
            onClick={() => setUserDialogOpen(true)}
          >
            <UserPlus className="w-5 h-5 md:w-4 md:h-4" />
            <span className="md:inline">Ajouter utilisateur</span>
          </Button>
          <Button
            variant="ghost" 
            size="icon"
            className="h-12 w-12 md:h-10 md:w-10"
            onClick={async () => {
              await signOut();
              toast.success('Déconnexion réussie');
            }}
            title="Se déconnecter"
          >
            <LogOut className="w-5 h-5 md:w-4 md:h-4" />
          </Button>
        </div>
      </motion.header>

      <main className="p-6 max-w-4xl mx-auto space-y-6">
        {/* Stats */}
        <motion.div
          className="grid grid-cols-2 md:grid-cols-4 gap-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Users className="w-8 h-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{filteredReservations.length}</p>
                  <p className="text-xs text-muted-foreground">Réservations</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Users className="w-8 h-8 text-primary/70" />
                <div>
                  <p className="text-2xl font-bold">{filteredReservations.length}</p>
                  <p className="text-xs text-muted-foreground">Personnes</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-8 h-8 text-valid" />
                <div>
                  <p className="text-2xl font-bold">{validatedCount}</p>
                  <p className="text-xs text-muted-foreground">Validés</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Clock className="w-8 h-8 text-muted-foreground" />
                <div>
                  <p className="text-2xl font-bold">{pendingCount}</p>
                  <p className="text-xs text-muted-foreground">En attente</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Add new reservation */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="w-5 h-5" />
                Nouvelle réservation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              </div>
              {newPersons > 1 && (
                <div className="space-y-3">
                  <Label>Noms des personnes *</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
                  <div className="space-y-3 pl-6 border-l-2 border-primary/20">
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

              <Button onClick={addReservation} disabled={isAdding} className="w-full md:w-auto">
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
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Ticket className="w-5 h-5" />
                Invitations Flyer
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                    className="w-full"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    {isAddingFlyer ? 'Création...' : 'Créer le flyer'}
                  </Button>
                </div>
              </div>

              {/* List existing flyers */}
              {flyers.length > 0 && (
                <div className="space-y-3 mt-4">
                  {flyers.map((flyer) => (
                    <div
                      key={flyer.id}
                      className="p-4 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors flex items-center justify-between"
                    >
                      <div className="flex items-center gap-4">
                        <div className="p-2 rounded-full bg-primary/10">
                          <Ticket className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{flyer.label}</p>
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(flyer.event_date + 'T00:00:00'), 'dd/MM/yyyy')} • {flyer.scan_count} scan{flyer.scan_count !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
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
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Réservations ({reservations.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
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
                                className="p-4 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-4">
                                    <div className={`p-2 rounded-full ${reservation.is_validated ? 'bg-valid/20' : 'bg-muted'}`}>
                                      {reservation.is_validated ? (
                                        <CheckCircle className="w-5 h-5 text-valid" />
                                      ) : (
                                        <QrCode className="w-5 h-5 text-muted-foreground" />
                                      )}
                                    </div>
                                    <div>
                                      <p className="font-medium text-foreground">
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
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
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
                                  <div className="mt-2 ml-14 flex flex-wrap gap-2">
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
      </main>
    </div>
  );
};

// Admin now uses ProtectedRoute for authentication
export default AdminContent;
