import { format } from 'date-fns';
import { Contact, Plus, Download, Mail, Phone, MessageSquare, Eye, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import type { ClientRecord } from '@/types/admin';

interface ClientsDirectoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clients: ClientRecord[];
  search: string;
  onSearchChange: (value: string) => void;
  onAdd: () => void;
  onEdit: (client: ClientRecord) => void;
  onDelete: (id: string) => void;
  onSms: (client: ClientRecord) => void;
}

const exportClientsCsv = (rows: ClientRecord[]) => {
  const csv = [
    ['Nom', 'Email', 'Téléphone', 'Réservations', 'Dernière venue', 'Notes'].join(';'),
    ...rows.map((c) =>
      [
        c.name,
        c.email || '',
        c.phone || '',
        String(c.reservation_count),
        c.last_seen_at ? format(new Date(c.last_seen_at), 'yyyy-MM-dd') : '',
        c.notes || '',
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(';'),
    ),
  ].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `clients-${format(new Date(), 'yyyy-MM-dd')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

const ClientsDirectoryDialog = ({
  open,
  onOpenChange,
  clients,
  search,
  onSearchChange,
  onAdd,
  onEdit,
  onDelete,
  onSms,
}: ClientsDirectoryDialogProps) => {
  const q = search.toLowerCase().trim();
  const filteredClients = clients.filter(
    (c) =>
      !q ||
      c.name.toLowerCase().includes(q) ||
      (c.email || '').toLowerCase().includes(q) ||
      (c.phone || '').toLowerCase().includes(q),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Contact className="w-5 h-5" />
            Répertoire clients
          </DialogTitle>
          <DialogDescription>
            Base de données des clients (auto-alimentée par les réservations, modifiable).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            placeholder="Rechercher par nom, email ou téléphone..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{filteredClients.length} client(s)</span>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onAdd}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Ajouter
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => exportClientsCsv(filteredClients)}
              >
                <Download className="w-3.5 h-3.5 mr-1" /> CSV
              </Button>
            </div>
          </div>
          <div className="border rounded-md divide-y">
            {filteredClients.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">Aucun client trouvé</p>
            )}
            {filteredClients.map((c) => (
              <div key={c.id} className="p-3 flex items-center justify-between gap-3 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{c.name}</p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                    {c.email && (
                      <span className="flex items-center gap-1 truncate">
                        <Mail className="w-3 h-3 shrink-0" /> {c.email}
                      </span>
                    )}
                    {c.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3 shrink-0" /> {c.phone}
                      </span>
                    )}
                    <span className="text-[10px] uppercase tracking-wide">{c.reservation_count} résa</span>
                  </div>
                  {c.notes && (
                    <p className="text-xs text-muted-foreground mt-1 italic line-clamp-2">{c.notes}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {c.phone && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      title="Préparer un SMS avec le QR"
                      onClick={() => onSms(c)}
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" className="h-8 w-8" title="Modifier" onClick={() => onEdit(c)}>
                    <Eye className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    title="Supprimer"
                    onClick={() => onDelete(c.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ClientsDirectoryDialog;
