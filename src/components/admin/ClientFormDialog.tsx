import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export interface ClientFormValues {
  name: string;
  phone: string;
  email: string;
  notes: string;
}

interface ClientFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isEditing: boolean;
  values: ClientFormValues;
  onChange: (values: ClientFormValues) => void;
  onSave: () => void;
  saving: boolean;
}

const ClientFormDialog = ({ open, onOpenChange, isEditing, values, onChange, onSave, saving }: ClientFormDialogProps) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>{isEditing ? 'Modifier le client' : 'Ajouter un client'}</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <div>
          <Label>Nom *</Label>
          <Input value={values.name} onChange={(e) => onChange({ ...values, name: e.target.value })} />
        </div>
        <div>
          <Label>Téléphone</Label>
          <Input
            type="tel"
            value={values.phone}
            onChange={(e) => onChange({ ...values, phone: e.target.value })}
            placeholder="+33..."
          />
        </div>
        <div>
          <Label>Email</Label>
          <Input type="email" value={values.email} onChange={(e) => onChange({ ...values, email: e.target.value })} />
        </div>
        <div>
          <Label>Notes</Label>
          <Textarea value={values.notes} onChange={(e) => onChange({ ...values, notes: e.target.value })} rows={3} />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={onSave} disabled={saving}>
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </Button>
        </div>
      </div>
    </DialogContent>
  </Dialog>
);

export default ClientFormDialog;
