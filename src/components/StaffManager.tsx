import { useCallback, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';
import { Loader2, Copy, Trash2, ShieldCheck, ScrollText, UserPlus, Search, Pencil, X, KeyRound } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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

const CATEGORY_LABEL: Record<string, string> = {
  staff: 'Personnel',
  reservation: 'Réservations',
  payment: 'Paiements',
  general: 'Général',
};

const StaffManager = ({ open, onOpenChange }: Props) => {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<StaffMember | null>(null);
  const [pendingReset, setPendingReset] = useState<StaffMember | null>(null);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [logAuthor, setLogAuthor] = useState<string>('all');
  const [logCategory, setLogCategory] = useState<string>('all');
  const [logSearch, setLogSearch] = useState('');

  const loadStaff = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-staff', {
        body: { action: 'list' },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const members = ((data?.members ?? []) as StaffMember[]).filter((m) => !isHiddenEmail(m.email));
      members.sort((a, b) =>
        `${a.last_name} ${a.first_name} ${a.email ?? ''}`.localeCompare(
          `${b.last_name} ${b.first_name} ${b.email ?? ''}`,
          'fr',
        ),
      );
      setStaff(members);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Chargement du personnel impossible');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadLogs = useCallback(async () => {
    const { data } = await supabase
      .from('activity_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    setLogs(((data ?? []) as ActivityLog[]).filter((l) => !isHiddenEmail(l.actor_label)));
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
      setEditingUserId(null);
      loadStaff();
      loadLogs();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de l'enregistrement");
    } finally {
      setIsSaving(false);
    }
  };

  const startEdit = (member: StaffMember) => {
    setEditingUserId(member.user_id);
    setTempPassword(null);
    setForm({
      first_name: member.first_name,
      last_name: member.last_name,
      phone: member.phone ?? '',
      email: member.email ?? '',
      role: member.role ?? 'agent',
    });
  };

  const cancelEdit = () => {
    setEditingUserId(null);
    setForm(emptyForm);
  };

  const removeStaff = async (member: StaffMember) => {
    try {
      setBusyUserId(member.user_id);
      const { data, error } = await supabase.functions.invoke('manage-staff', {
        body: { action: 'delete', user_id: member.user_id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success('Compte supprimé');
      if (editingUserId === member.user_id) cancelEdit();
      loadStaff();
      loadLogs();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Suppression impossible');
    } finally {
      setBusyUserId(null);
      setPendingDelete(null);
    }
  };

  const changeRole = async (member: StaffMember, role: AppRole) => {
    if (member.role === role) return;
    setBusyUserId(member.user_id);
    try {
      const { data, error } = await supabase.functions.invoke('manage-staff', {
        body: { action: 'set_role', user_id: member.user_id, role },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setStaff((prev) => prev.map((m) => (m.user_id === member.user_id ? { ...m, role } : m)));
      toast.success(`Rôle mis à jour : ${ROLE_SHORT[role]}`);
      loadLogs();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Modification du rôle impossible');
      loadStaff();
    } finally {
      setBusyUserId(null);
    }
  };

  const resetPassword = async (member: StaffMember) => {
    setBusyUserId(member.user_id);
    setTempPassword(null);
    try {
      const { data, error } = await supabase.functions.invoke('manage-staff', {
        body: { action: 'reset_password', user_id: member.user_id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setTempPassword(data.temporary_password);
      toast.success('Nouveau mot de passe généré — transmettez-le au membre');
      loadLogs();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Réinitialisation impossible');
    } finally {
      setBusyUserId(null);
      setPendingReset(null);
    }
  };

  const term = search.trim().toLowerCase();
  const filteredStaff = term
    ? staff.filter((m) =>
        [m.first_name, m.last_name, m.email ?? '', m.phone ?? '', m.role ? ROLE_SHORT[m.role] : '']
          .join(' ')
          .toLowerCase()
          .includes(term),
      )
    : staff;

  const logTerm = logSearch.trim().toLowerCase();
  const logCategories = Array.from(new Set(logs.map((l) => l.category))).sort();
  const filteredLogs = logs.filter((log) => {
    if (logAuthor !== 'all' && log.user_id !== logAuthor) return false;
    if (logCategory !== 'all' && log.category !== logCategory) return false;
    if (logTerm && !`${log.action} ${log.actor_label ?? ''}`.toLowerCase().includes(logTerm)) return false;
    return true;
  });

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
                  disabled={!!editingUserId}
                  onChange={(e) => setForm({ ...form, email: e.target.value })} maxLength={255} />
                {editingUserId && (
                  <p className="text-xs text-muted-foreground">
                    L'email sert d'identifiant de connexion : il ne peut pas être modifié. Supprimez puis recréez le
                    compte si l'adresse doit changer.
                  </p>
                )}
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="staff-role">Rôle et droits</Label>
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as AppRole })}>
                  <SelectTrigger id="staff-role"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="agent">{ROLE_LABEL.agent}</SelectItem>
                    <SelectItem value="member_control">{ROLE_LABEL.member_control}</SelectItem>
                    <SelectItem value="supervisor">{ROLE_LABEL.supervisor}</SelectItem>
                    <SelectItem value="admin">{ROLE_LABEL.admin}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex gap-2">
              <Button className="flex-1 gap-2" onClick={submit} disabled={isSaving}>
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                {isSaving
                  ? 'Enregistrement...'
                  : editingUserId
                    ? 'Enregistrer les modifications'
                    : 'Créer le membre'}
              </Button>
              {editingUserId && (
                <Button variant="outline" className="gap-1.5" onClick={cancelEdit}>
                  <X className="w-4 h-4" /> Annuler
                </Button>
              )}
            </div>

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
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-muted-foreground">
                  Membres ({filteredStaff.length}/{staff.length})
                </p>
              </div>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Rechercher un membre (nom, email, rôle...)"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              {isLoading && <p className="text-sm text-muted-foreground">Chargement...</p>}
              {!isLoading && filteredStaff.length === 0 && (
                <p className="text-sm text-muted-foreground">Aucun membre trouvé.</p>
              )}
              {filteredStaff.map((member) => (
                <div key={member.user_id}
                  className={`flex items-center justify-between gap-3 rounded-lg border p-3 ${
                    editingUserId === member.user_id ? 'border-primary' : 'border-border'
                  }`}>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground truncate">
                      {`${member.first_name} ${member.last_name}`.trim() || member.email}
                      {member.is_self && <span className="text-xs text-muted-foreground"> (vous)</span>}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {member.email}{member.phone ? ` • ${member.phone}` : ''}
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <Select
                        value={member.role ?? undefined}
                        onValueChange={(v) => changeRole(member, v as AppRole)}
                        disabled={busyUserId === member.user_id}
                      >
                        <SelectTrigger className="h-8 w-[190px] text-xs">
                          <SelectValue placeholder="Sans rôle" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="agent">{ROLE_SHORT.agent}</SelectItem>
                          <SelectItem value="member_control">{ROLE_SHORT.member_control}</SelectItem>
                          <SelectItem value="supervisor">{ROLE_SHORT.supervisor}</SelectItem>
                          <SelectItem value="admin">{ROLE_SHORT.admin}</SelectItem>
                        </SelectContent>
                      </Select>
                      {busyUserId === member.user_id && (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 self-start">
                    {!member.role && <Badge variant="outline">Sans rôle</Badge>}
                    <Button size="icon" variant="ghost" onClick={() => setPendingReset(member)}
                      title="Réinitialiser le mot de passe">
                      <KeyRound className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => startEdit(member)} title="Modifier">
                      <Pencil className="w-4 h-4" />
                    </Button>
                    {!member.is_self && (
                      <Button size="icon" variant="ghost" onClick={() => setPendingDelete(member)} title="Supprimer">
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="logs" className="space-y-2 pt-4">
            <p className="text-xs text-muted-foreground">
              Journal réservé aux administrateurs — 200 dernières actions.
            </p>
            <div className="grid gap-2 sm:grid-cols-3">
              <Select value={logAuthor} onValueChange={setLogAuthor}>
                <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Personne" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les personnes</SelectItem>
                  {staff.map((m) => (
                    <SelectItem key={m.user_id} value={m.user_id}>
                      {`${m.first_name} ${m.last_name}`.trim() || m.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={logCategory} onValueChange={setLogCategory}>
                <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Catégorie" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les catégories</SelectItem>
                  {logCategories.map((c) => (
                    <SelectItem key={c} value={c}>{CATEGORY_LABEL[c] ?? c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input className="pl-9 h-9 text-xs" placeholder="Rechercher une action"
                  value={logSearch} onChange={(e) => setLogSearch(e.target.value)} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{filteredLogs.length} action(s) affichée(s)</p>
            {filteredLogs.length === 0 && (
              <p className="text-sm text-muted-foreground">Aucune activité enregistrée pour le moment.</p>
            )}
            {filteredLogs.map((log) => {
              const author = staff.find((s) => s.user_id === log.user_id);
              return (
                <div key={log.id} className="rounded-lg border border-border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-foreground">{log.action}</p>
                    <Badge variant="outline" className="shrink-0 text-[10px]">
                      {CATEGORY_LABEL[log.category] ?? log.category}
                    </Badge>
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

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce compte ?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete
                ? `${`${pendingDelete.first_name} ${pendingDelete.last_name}`.trim() || pendingDelete.email} perdra définitivement son accès à l'application. Cette action est irréversible.`
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => pendingDelete && removeStaff(pendingDelete)}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!pendingReset} onOpenChange={(o) => !o && setPendingReset(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Réinitialiser le mot de passe ?</AlertDialogTitle>
            <AlertDialogDescription>
              Un nouveau mot de passe provisoire sera généré pour{' '}
              {pendingReset ? `${`${pendingReset.first_name} ${pendingReset.last_name}`.trim() || pendingReset.email}` : ''}.
              L'ancien mot de passe cessera immédiatement de fonctionner.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => pendingReset && resetPassword(pendingReset)}>
              Générer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
};

export default StaffManager;
