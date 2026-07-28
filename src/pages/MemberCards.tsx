import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Pencil, Building2, IdCard, Send, ExternalLink, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Company {
  id: string;
  name: string;
  logo_url: string | null;
}

interface MemberCard {
  id: string;
  card_uid: string;
  first_name: string;
  last_name: string;
  company_id: string | null;
  phone: string | null;
  notes: string | null;
  valid_until: string | null;
  created_at: string;
}

const MAX_LOGO_BYTES = 400 * 1024; // 400KB raw file

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function generateCardUid(): string {
  const rand = crypto.randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase();
  return `CARD-${rand}`;
}

function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

function buildCardSmsBody(card: MemberCard, url: string): string {
  const name = `${card.first_name} ${card.last_name}`.trim();
  return (
    `🎫 L'Access — Carte membre\n` +
    `${name}\n` +
    `Votre carte : ${url}\n` +
    `À présenter à l'entrée.`
  );
}

const MemberCards = () => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [cards, setCards] = useState<MemberCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [cardSearch, setCardSearch] = useState('');

  // Company dialog
  const [companyDialogOpen, setCompanyDialogOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [companyName, setCompanyName] = useState('');
  const [companyLogoDataUrl, setCompanyLogoDataUrl] = useState<string | null>(null);
  const [savingCompany, setSavingCompany] = useState(false);

  // Card dialog
  const [cardDialogOpen, setCardDialogOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<MemberCard | null>(null);
  const [cardFirstName, setCardFirstName] = useState('');
  const [cardLastName, setCardLastName] = useState('');
  const [cardCompanyId, setCardCompanyId] = useState<string>('');
  const [cardPhone, setCardPhone] = useState('');
  const [cardNotes, setCardNotes] = useState('');
  const [cardValidUntil, setCardValidUntil] = useState('');
  const [savingCard, setSavingCard] = useState(false);

  const fetchAll = async () => {
    const [{ data: comps, error: e1 }, { data: cds, error: e2 }] = await Promise.all([
      supabase.from('partner_companies').select('*').order('name'),
      supabase.from('member_cards').select('*').order('created_at', { ascending: false }),
    ]);
    if (e1) toast.error('Entreprises : ' + e1.message);
    if (e2) toast.error('Cartes : ' + e2.message);
    setCompanies(comps ?? []);
    setCards(cds ?? []);
    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
    const t = setInterval(fetchAll, 15000);
    return () => clearInterval(t);
  }, []);

  const companyById = useMemo(() => {
    const m = new Map<string, Company>();
    for (const c of companies) m.set(c.id, c);
    return m;
  }, [companies]);

  const filteredCards = useMemo(() => {
    const q = cardSearch.trim().toLowerCase();
    if (!q) return cards;
    return cards.filter((c) => {
      const comp = c.company_id ? companyById.get(c.company_id)?.name ?? '' : '';
      return (
        c.first_name.toLowerCase().includes(q) ||
        c.last_name.toLowerCase().includes(q) ||
        comp.toLowerCase().includes(q) ||
        (c.phone ?? '').toLowerCase().includes(q)
      );
    });
  }, [cards, cardSearch, companyById]);

  // ---- Company handlers ----
  const openNewCompany = () => {
    setEditingCompany(null);
    setCompanyName('');
    setCompanyLogoDataUrl(null);
    setCompanyDialogOpen(true);
  };
  const openEditCompany = (c: Company) => {
    setEditingCompany(c);
    setCompanyName(c.name);
    setCompanyLogoDataUrl(c.logo_url);
    setCompanyDialogOpen(true);
  };
  const handleLogoUpload = async (file: File | null) => {
    if (!file) return;
    if (file.size > MAX_LOGO_BYTES) {
      toast.error('Logo trop lourd (max 400 Ko). Compressez-le puis réessayez.');
      return;
    }
    try {
      const data = await fileToDataUrl(file);
      setCompanyLogoDataUrl(data);
    } catch {
      toast.error('Impossible de lire le fichier.');
    }
  };
  const saveCompany = async () => {
    const name = companyName.trim();
    if (!name) {
      toast.error('Nom requis');
      return;
    }
    setSavingCompany(true);
    const payload = { name, logo_url: companyLogoDataUrl };
    const { error } = editingCompany
      ? await supabase.from('partner_companies').update(payload).eq('id', editingCompany.id)
      : await supabase.from('partner_companies').insert(payload);
    setSavingCompany(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(editingCompany ? 'Entreprise modifiée' : 'Entreprise ajoutée');
    setCompanyDialogOpen(false);
    fetchAll();
  };
  const deleteCompany = async (c: Company) => {
    if (!confirm(`Supprimer "${c.name}" ? Les cartes liées seront détachées.`)) return;
    const { error } = await supabase.from('partner_companies').delete().eq('id', c.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Entreprise supprimée');
    fetchAll();
  };

  // ---- Card handlers ----
  const openNewCard = () => {
    setEditingCard(null);
    setCardFirstName('');
    setCardLastName('');
    setCardCompanyId('');
    setCardPhone('');
    setCardNotes('');
    setCardValidUntil('');
    setCardDialogOpen(true);
  };
  const openEditCard = (c: MemberCard) => {
    setEditingCard(c);
    setCardFirstName(c.first_name);
    setCardLastName(c.last_name);
    setCardCompanyId(c.company_id ?? '');
    setCardPhone(c.phone ?? '');
    setCardNotes(c.notes ?? '');
    setCardValidUntil(c.valid_until ?? '');
    setCardDialogOpen(true);
  };
  const saveCard = async () => {
    const first = cardFirstName.trim();
    const last = cardLastName.trim();
    if (!first || !last) {
      toast.error('Prénom et nom requis');
      return;
    }
    setSavingCard(true);
    const payload = {
      first_name: first,
      last_name: last,
      company_id: cardCompanyId || null,
      phone: cardPhone.trim() || null,
      notes: cardNotes.trim() || null,
      valid_until: cardValidUntil || null,
    };
    const { error } = editingCard
      ? await supabase.from('member_cards').update(payload).eq('id', editingCard.id)
      : await supabase.from('member_cards').insert({ ...payload, card_uid: generateCardUid() });
    setSavingCard(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(editingCard ? 'Carte modifiée' : 'Carte créée');
    setCardDialogOpen(false);
    fetchAll();
  };
  const deleteCard = async (c: MemberCard) => {
    if (!confirm(`Supprimer la carte de ${c.first_name} ${c.last_name} ?`)) return;
    const { error } = await supabase.from('member_cards').delete().eq('id', c.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Carte supprimée');
    fetchAll();
  };

  const cardUrl = (uid: string) => `${window.location.origin}/carte/${encodeURIComponent(uid)}`;

  const sendCardSms = (c: MemberCard) => {
    if (!c.phone) {
      toast.error('Aucun numéro de téléphone renseigné.');
      return;
    }
    const url = cardUrl(c.card_uid);
    const body = buildCardSmsBody(c, url);
    const sep = isIOS() ? '&' : '?';
    const link = `sms:${c.phone}${sep}body=${encodeURIComponent(body)}`;
    window.location.href = link;
  };

  const copyCardLink = async (c: MemberCard) => {
    try {
      await navigator.clipboard.writeText(cardUrl(c.card_uid));
      toast.success('Lien copié');
    } catch {
      toast.error('Copie impossible');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="px-4 py-3 md:px-6 md:py-4 border-b border-border flex items-center gap-3">
        <Link to="/admin">
          <Button variant="ghost" size="icon" className="h-10 w-10">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-base md:text-lg font-bold">Cartes membres</h1>
          <p className="text-[10px] md:text-xs text-muted-foreground">
            Cartes nominatives partenaires
          </p>
        </div>
      </header>

      <div className="px-4 py-4 md:px-6 md:py-6 max-w-5xl mx-auto">
        <Tabs defaultValue="cards">
          <TabsList className="mb-4">
            <TabsTrigger value="cards">
              <IdCard className="w-4 h-4 mr-2" />
              Cartes
            </TabsTrigger>
            <TabsTrigger value="companies">
              <Building2 className="w-4 h-4 mr-2" />
              Entreprises
            </TabsTrigger>
          </TabsList>

          {/* CARDS */}
          <TabsContent value="cards" className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
              <div className="relative flex-1 max-w-sm">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Rechercher un membre..."
                  value={cardSearch}
                  onChange={(e) => setCardSearch(e.target.value)}
                />
              </div>
              <Button onClick={openNewCard}>
                <Plus className="w-4 h-4 mr-2" />
                Nouvelle carte
              </Button>
            </div>

            {loading ? (
              <p className="text-sm text-muted-foreground">Chargement...</p>
            ) : filteredCards.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center text-sm text-muted-foreground">
                  Aucune carte pour le moment.
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3">
                {filteredCards.map((c) => {
                  const comp = c.company_id ? companyById.get(c.company_id) : null;
                  return (
                    <Card key={c.id}>
                      <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                        {comp?.logo_url ? (
                          <img
                            src={comp.logo_url}
                            alt={comp.name}
                            className="w-14 h-14 object-contain rounded bg-white p-1 border border-border shrink-0"
                          />
                        ) : (
                          <div className="w-14 h-14 rounded bg-muted flex items-center justify-center shrink-0">
                            <Building2 className="w-5 h-5 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-foreground truncate">
                            {c.first_name} {c.last_name}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {comp?.name ?? 'Sans entreprise'}
                            {c.phone ? ` · ${c.phone}` : ''}
                          </p>
                          <p className="text-[10px] text-muted-foreground/70 font-mono truncate">
                            {c.card_uid}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2 justify-end">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => window.open(cardUrl(c.card_uid), '_blank')}
                            title="Ouvrir la carte"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => copyCardLink(c)}
                          >
                            Copier lien
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => sendCardSms(c)}
                            disabled={!c.phone}
                            title={c.phone ? 'Envoyer par SMS' : 'Aucun téléphone'}
                          >
                            <Send className="w-4 h-4 mr-1" />
                            SMS
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => openEditCard(c)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive"
                            onClick={() => deleteCard(c)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* COMPANIES */}
          <TabsContent value="companies" className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={openNewCompany}>
                <Plus className="w-4 h-4 mr-2" />
                Nouvelle entreprise
              </Button>
            </div>

            {loading ? (
              <p className="text-sm text-muted-foreground">Chargement...</p>
            ) : companies.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center text-sm text-muted-foreground">
                  Aucune entreprise partenaire pour le moment.
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {companies.map((c) => (
                  <Card key={c.id}>
                    <CardContent className="p-4 flex items-center gap-3">
                      {c.logo_url ? (
                        <img
                          src={c.logo_url}
                          alt={c.name}
                          className="w-16 h-16 object-contain rounded bg-white p-1 border border-border shrink-0"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded bg-muted flex items-center justify-center shrink-0">
                          <Building2 className="w-6 h-6 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate">{c.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {cards.filter((x) => x.company_id === c.id).length} carte(s)
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => openEditCompany(c)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => deleteCompany(c)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Company dialog */}
      <Dialog open={companyDialogOpen} onOpenChange={setCompanyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCompany ? 'Modifier l\'entreprise' : 'Nouvelle entreprise'}
            </DialogTitle>
            <DialogDescription>
              Le logo apparaîtra sur les cartes des membres de cette entreprise.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="company-name">Nom</Label>
              <Input
                id="company-name"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="ex: Café Le Français"
              />
            </div>
            <div>
              <Label htmlFor="company-logo">Logo (PNG/JPEG, max 400 Ko)</Label>
              <Input
                id="company-logo"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                onChange={(e) => handleLogoUpload(e.target.files?.[0] ?? null)}
              />
              {companyLogoDataUrl && (
                <div className="mt-2 flex items-center gap-2">
                  <img
                    src={companyLogoDataUrl}
                    alt="Aperçu"
                    className="w-20 h-20 object-contain bg-white rounded border border-border p-1"
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setCompanyLogoDataUrl(null)}
                  >
                    Retirer
                  </Button>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompanyDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={saveCompany} disabled={savingCompany}>
              {savingCompany ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Card dialog */}
      <Dialog open={cardDialogOpen} onOpenChange={setCardDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCard ? 'Modifier la carte' : 'Nouvelle carte membre'}
            </DialogTitle>
            <DialogDescription>
              La carte sera consultable via un lien envoyé par SMS.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="first-name">Prénom</Label>
              <Input
                id="first-name"
                value={cardFirstName}
                onChange={(e) => setCardFirstName(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="last-name">Nom</Label>
              <Input
                id="last-name"
                value={cardLastName}
                onChange={(e) => setCardLastName(e.target.value)}
              />
            </div>
            <div className="col-span-2">
              <Label htmlFor="company">Entreprise</Label>
              <Select
                value={cardCompanyId || 'none'}
                onValueChange={(v) => setCardCompanyId(v === 'none' ? '' : v)}
              >
                <SelectTrigger id="company">
                  <SelectValue placeholder="Sans entreprise" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sans entreprise</SelectItem>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label htmlFor="phone">Téléphone (pour l'envoi SMS)</Label>
              <Input
                id="phone"
                value={cardPhone}
                onChange={(e) => setCardPhone(e.target.value)}
                placeholder="+33..."
              />
            </div>
            <div className="col-span-2">
              <Label htmlFor="notes">Notes (interne)</Label>
            </div>
            <div className="col-span-2">
              <Textarea
                id="notes"
                value={cardNotes}
                onChange={(e) => setCardNotes(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCardDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={saveCard} disabled={savingCard}>
              {savingCard ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MemberCards;