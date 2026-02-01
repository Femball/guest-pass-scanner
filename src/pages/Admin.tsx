import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Plus, Users, CheckCircle, Clock, Trash2, Download, QrCode } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Reservation {
  id: string;
  client_name: string;
  client_email: string | null;
  qr_code: string;
  is_validated: boolean;
  validated_at: string | null;
  created_at: string;
}

const Admin = () => {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [isAdding, setIsAdding] = useState(false);

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
  }, []);

  const generateQRCode = () => {
    return `TICKET-${Date.now()}-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
  };

  const addReservation = async () => {
    if (!newName.trim()) {
      toast.error('Le nom est requis');
      return;
    }

    setIsAdding(true);
    const qrCode = generateQRCode();

    const { error } = await supabase.from('reservations').insert({
      client_name: newName.trim(),
      client_email: newEmail.trim() || null,
      qr_code: qrCode,
    });

    if (error) {
      toast.error('Erreur lors de la création de la réservation');
      setIsAdding(false);
      return;
    }

    toast.success('Réservation créée avec succès');
    setNewName('');
    setNewEmail('');
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

  const downloadQRCode = (reservation: Reservation) => {
    // Create a simple text file with the QR code value
    const content = `Réservation: ${reservation.client_name}\nCode QR: ${reservation.qr_code}\n\nPrésentez ce code à l'entrée.`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ticket-${reservation.client_name.replace(/\s+/g, '-')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Ticket téléchargé');
  };

  const validatedCount = reservations.filter(r => r.is_validated).length;
  const pendingCount = reservations.filter(r => !r.is_validated).length;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <motion.header
        className="px-6 py-4 flex items-center gap-4 border-b border-border"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Link to="/">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-lg font-bold text-foreground">Administration</h1>
          <p className="text-xs text-muted-foreground">Gestion des réservations</p>
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  <Label htmlFor="email">Email (optionnel)</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="jean@example.com"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                  />
                </div>
              </div>
              <Button onClick={addReservation} disabled={isAdding} className="w-full md:w-auto">
                {isAdding ? 'Création...' : 'Créer la réservation'}
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
                          <p className="font-medium text-foreground">{reservation.client_name}</p>
                          <p className="text-sm text-muted-foreground">
                            {reservation.is_validated
                              ? `Validé le ${new Date(reservation.validated_at!).toLocaleString('fr-FR')}`
                              : reservation.client_email || 'Pas d\'email'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => downloadQRCode(reservation)}
                          title="Télécharger le ticket"
                        >
                          <Download className="w-4 h-4" />
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
      </main>
    </div>
  );
};

export default Admin;
