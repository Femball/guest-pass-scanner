import { useCallback, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';
import { Loader2, Copy, Trash2, ShieldCheck, ScrollText, UserPlus, Search, Pencil, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

type AppRole = 'admin' | 'agent' | 'supervisor' | 'member_control';

const ROLE_LABEL: Record<AppRole, string> = {
  admin: 'Admin — accès complet',
  supervisor: 'Superviseur — gestion sans export/utilisateurs',
  agent: "Agent d'accueil — scan des tickets uniquement",
  member_control: 'Contrôle membres — consultation des cartes membres uniquement',
};

const ROLE_SHORT: Record<AppRole, string> = {
  admin: 'Admin',
  supervisor: 'Superviseur',
  agent: "Agent d'accueil",
  member_control: 'Contrôle membres',
};

interface StaffMember {
  user_id: string;
  profile_id: string | null;
  first_name: string;
  last_name: string;
  phone: string | null;
  email: string | null;
  role: AppRole | null;
  is_self: boolean;
}

interface ActivityLog {
  id: string;
  user_id: string | null;
  actor_label: string | null;
  action: string;
  category: string;
  details: unknown;
  created_at: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const emptyForm = { first_name: '', last_name: '', phone: '', email: '', role: 'agent' as AppRole };

const StaffManager = ({ open, onOpenChange }: Props) => {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  const loadStaff = useCallback(async () => {
    setIsLoading(true);
    const [{ data: profiles }, { data: roles }] = await Promise.all([
      supabase.from('staff_profiles').select('*').order('last_name'),
      supabase.from('user_roles').select('user_id, role'),
    ]);
    const roleMap = new Map((roles ?? []).map((r) => [r.user_id, r.role as AppRole]));
    setStaff((profiles ?? []).map((p) => ({
      id: p.id,
      user_id: p.user_id,
      first_name: p.first_name,
      last_name: p.last_name,
      phone: p.phone,
      email: p.email,
      role: roleMap.get(p.user_id) ?? null,
    })));
    setIsLoading(false);
  }, []);

  const loadLogs = useCallback(async () => {
    const { data } = await supabase
      .from('activity_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    setLogs((data ?? []) as ActivityLog[]);
  }, []);

  useEffect(() => {
    if (!open) return;
    loadStaff();
    loadLogs();
  }, [open, loadStaff, loadLogs]);

  const submit = async () => {
    if (!form.first_name.trim() || !form.last_name.trim() || !form.email.trim()) {
      toast.error('Prénom, nom et email sont obligatoires');
      return;
    }
    setIsSaving(true);
    setTempPassword(null);
    try {
      const { data, error } = await supabase.functions.invoke('create-staff-user', {
        body: {
          email: form.email.trim(),
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
          phone: form.phone.trim(),
          role: form.role,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data?.temporary_password) {
        setTempPassword(data.temporary_password);
        toast.success('Compte créé — communiquez le mot de passe provisoire');
      } else {
        toast.success('Membre du personnel mis à jour');
      }
      setForm(emptyForm);
      loadStaff();
      loadLogs();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de l'enregistrement");
    } finally {
      setIsSaving(false);
    }
  };

  const removeStaff = async (member: StaffMember) => {
    if (!confirm(`Retirer ${member.first_name} ${member.last_name} du personnel ?`)) return;
    const { error } = await supabase.from('staff_profiles').delete().eq('id', member.id);
    if (error) { toast.error('Suppression impossible'); return; }
    await supabase.from('user_roles').delete().eq('user_id', member.user_id);
    toast.success('Membre retiré');
    loadStaff();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Personnel & journal d'activité</DialogTitle>
          <DialogDescription>
            Créez un accès en renseignant simplement nom, prénom, téléphone et rôle.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="staff" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="staff" className="gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" /> Personnel
            </TabsTrigger>
            <TabsTrigger value="logs" className="gap-1.5">
              <ScrollText className="w-3.5 h-3.5" /> Journal
            </TabsTrigger>
          </TabsList>

          <TabsContent value="staff" className="space-y-5 pt-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="staff-first">Prénom</Label>
                <Input id="staff-first" value={form.first_name}
                  onChange={(e) => setForm({ ...form, first_name: e.target.value })} maxLength={60} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="staff-last">Nom</Label>
                <Input id="staff-last" value={form.last_name}
                  onChange={(e) => setForm({ ...form, last_name: e.target.value })} maxLength={60} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="staff-phone">Téléphone</Label>
                <Input id="staff-phone" type="tel" placeholder="06 12 34 56 78" value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })} maxLength={30} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="staff-email">Email (identifiant de connexion)</Label>
                <Input id="staff-email" type="email" placeholder="agent@example.com" value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })} maxLength={255} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="staff-role">Rôle et droits</Label>
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as AppRole })}>
                  <SelectTrigger id="staff-role"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="agent">{ROLE_LABEL.agent}</SelectItem>
                    <SelectItem value="supervisor">{ROLE_LABEL.supervisor}</SelectItem>
                    <SelectItem value="admin">{ROLE_LABEL.admin}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button className="w-full gap-2" onClick={submit} disabled={isSaving}>
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
              {isSaving ? 'Enregistrement...' : 'Créer / mettre à jour le membre'}
            </Button>

            {tempPassword && (
              <div className="rounded-lg border border-primary/40 bg-primary/5 p-3 space-y-2">
                <p className="text-sm text-foreground">
                  Mot de passe provisoire à transmettre :
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 font-mono text-sm break-all">{tempPassword}</code>
                  <Button size="sm" variant="outline" className="gap-1.5"
                    onClick={() => { navigator.clipboard.writeText(tempPassword); toast.success('Copié'); }}>
                    <Copy className="w-3.5 h-3.5" /> Copier
                  </Button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">
                Membres ({staff.length})
              </p>
              {isLoading && <p className="text-sm text-muted-foreground">Chargement...</p>}
              {!isLoading && staff.length === 0 && (
                <p className="text-sm text-muted-foreground">Aucun membre enregistré.</p>
              )}
              {staff.map((member) => (
                <div key={member.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                  <div className="min-w-0">
                    <p className="font-medium text-foreground truncate">
                      {member.first_name} {member.last_name}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {member.email}{member.phone ? ` • ${member.phone}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant={member.role === 'admin' ? 'default' : 'secondary'}>
                      {member.role ? ROLE_SHORT[member.role] : 'Sans rôle'}
                    </Badge>
                    <Button size="icon" variant="ghost" onClick={() => removeStaff(member)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="logs" className="space-y-2 pt-4">
            <p className="text-xs text-muted-foreground">
              Journal réservé aux administrateurs — 200 dernières actions.
            </p>
            {logs.length === 0 && (
              <p className="text-sm text-muted-foreground">Aucune activité enregistrée pour le moment.</p>
            )}
            {logs.map((log) => {
              const author = staff.find((s) => s.user_id === log.user_id);
              return (
                <div key={log.id} className="rounded-lg border border-border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-foreground">{log.action}</p>
                    <Badge variant="outline" className="shrink-0 text-[10px]">{log.category}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {author ? `${author.first_name} ${author.last_name}` : log.actor_label ?? 'Inconnu'}
                    {' • '}
                    {format(new Date(log.created_at), 'dd MMM yyyy HH:mm', { locale: fr })}
                  </p>
                </div>
              );
            })}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default StaffManager;
