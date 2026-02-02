import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Plus, Users, CheckCircle, Clock, Trash2, Send, QrCode, Mail, Eye, LogOut, UserPlus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
}

const AdminContent = () => {
  const { signOut } = useAuth();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPersons, setNewPersons] = useState(1);
  const [isAdding, setIsAdding] = useState(false);
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
    return `TICKET-${Date.now()}-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
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
    if (!newName.trim()) {
      toast.error('Le nom est requis');
      return;
    }

    if (!newEmail.trim()) {
      toast.error('L\'email est requis pour envoyer le ticket');
      return;
    }

    setIsAdding(true);
    const qrCode = generateQRCode();

    const { data, error } = await supabase.from('reservations').insert({
      client_name: newName.trim(),
      client_email: newEmail.trim(),
      qr_code: qrCode,
      number_of_persons: newPersons,
    }).select().single();

    if (error) {
      toast.error('Erreur lors de la création de la réservation');
      setIsAdding(false);
      return;
    }

    toast.success('Réservation créée avec succès');
    
    // Automatically send email
    if (data && data.client_email) {
      await sendTicketEmail(data);
    }

    setNewName('');
    setNewEmail('');
    setNewPersons(1);
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

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <motion.header
        className="px-6 py-4 flex items-center justify-between border-b border-border"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center gap-4">
          <Link to="/">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-lg font-bold text-foreground">Administration</h1>
            <p className="text-xs text-muted-foreground">Gestion des réservations</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="gap-2"
            onClick={() => setUserDialogOpen(true)}
          >
            <UserPlus className="w-4 h-4" />
            Ajouter utilisateur
          </Button>
          <Button 
            variant="ghost" 
            size="icon"
            onClick={async () => {
              await signOut();
              toast.success('Déconnexion réussie');
            }}
            title="Se déconnecter"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </motion.header>

      <main className="p-6 max-w-4xl mx-auto space-y-6">
        {/* Stats */}
        <motion.div
          className="grid grid-cols-3 gap-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Users className="w-8 h-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{reservations.length}</p>
                  <p className="text-xs text-muted-foreground">Total</p>
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
                <div className="space-y-2">
                  <Label htmlFor="name">Nom du client *</Label>
                  <Input
                    id="name"
                    placeholder="Jean Dupont"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                  />
                </div>
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
                    onChange={(e) => setNewPersons(parseInt(e.target.value) || 1)}
                  />
                </div>
              </div>
              <Button onClick={addReservation} disabled={isAdding} className="w-full md:w-auto">
                <Send className="w-4 h-4 mr-2" />
                {isAdding ? 'Création et envoi...' : 'Créer et envoyer le ticket'}
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
