import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Plus, Users, CheckCircle, Clock, Trash2, Send, QrCode, Mail, Eye, LogOut, UserPlus, Download, CalendarIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
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

const AdminContent = () => {
  const { signOut } = useAuth();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPersons, setNewPersons] = useState(1);
  const [personNames, setPersonNames] = useState<string[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [eventDate, setEventDate] = useState<Date>(new Date());
  const [sendingEmail, setSendingEmail] = useState<string | null>(null);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  
  // User management
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState<'admin' | 'agent'>('agent');
  const [isAddingUser, setIsAddingUser] = useState(false);

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
    // Use cryptographically secure random generation
    return `TICKET-${crypto.randomUUID().toUpperCase()}`;
  };

  const sendTicketEmail = async (reservation: Reservation) => {
    if (!reservation.client_email) {
      toast.error('Pas d\'adresse email pour ce client');
      return;
    }

    setSendingEmail(reservation.id);

    try {
      const { data, error } = await supabase.functions.invoke('send-ticket-email', {
        body: {
          clientName: reservation.client_name,
          clientEmail: reservation.client_email,
          qrCode: reservation.qr_code,
          eventName: 'Soirée',
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
      const dataUrl = await QRCode.toDataURL(reservation.qr_code, {
        width: 300,
        margin: 2,
      });
      setQrCodeDataUrl(dataUrl);
      setQrDialogOpen(true);
    } catch (error) {
      toast.error('Erreur lors de la génération du QR code');
    }
  };

  const validatedCount = reservations.filter(r => r.is_validated).length;
  const pendingCount = reservations.filter(r => !r.is_validated).length;
  const totalPersons = reservations.reduce((sum, r) => sum + r.number_of_persons, 0);

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
                  <p className="text-2xl font-bold">{reservations.length}</p>
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
                  <p className="text-2xl font-bold">{totalPersons}</p>
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
              <Button onClick={addReservation} disabled={isAdding} className="w-full md:w-auto">
                <Send className="w-4 h-4 mr-2" />
                {isAdding ? 'Création et envoi...' : `Créer et envoyer ${newPersons > 1 ? newPersons + ' tickets' : 'le ticket'}`}
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        {/* Reservations list */}
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
              ) : (
                <div className="space-y-3">
                  {reservations.map((reservation) => (
                    <motion.div
                      key={reservation.id}
                      className="flex items-center justify-between p-4 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                    >
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
                            {' · '}
                            <span className="font-medium">
                              {format(new Date(reservation.event_date + 'T00:00:00'), 'dd/MM/yyyy')}
                            </span>
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
                    </motion.div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* QR Code Dialog */}
        <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-center">
                QR Code - {selectedReservation?.client_name}
              </DialogTitle>
            </DialogHeader>
            <div className="flex flex-col items-center gap-4 py-4">
              {qrCodeDataUrl && (
                <img 
                  src={qrCodeDataUrl} 
                  alt="QR Code" 
                  className="w-64 h-64 rounded-lg border border-border"
                />
              )}
              <p className="text-sm text-muted-foreground font-mono break-all text-center px-4">
                {selectedReservation?.qr_code}
              </p>
              <p className="text-sm text-muted-foreground">
                {selectedReservation?.number_of_persons} personne(s)
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
      </main>
    </div>
  );
};

// Admin now uses ProtectedRoute for authentication
export default AdminContent;
