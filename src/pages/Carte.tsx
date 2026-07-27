import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Apple, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import laccessLogo from '@/assets/laccess-logo.jpeg.asset.json';
import leFrancaisLogo from '@/assets/le-francais-logo.png.asset.json';

interface CardData {
  card_uid: string;
  first_name: string;
  last_name: string;
  company_id: string | null;
  partner_companies: { name: string; logo_url: string | null } | null;
}

const Carte = () => {
  const { uid } = useParams<{ uid: string }>();
  const [card, setCard] = useState<CardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (!uid) {
      setError('Identifiant manquant');
      setLoading(false);
      return;
    }
    (async () => {
      const { data, error } = await supabase
        .from('member_cards')
        .select('card_uid, first_name, last_name, company_id, partner_companies(name, logo_url)')
        .eq('card_uid', uid)
        .maybeSingle();
      if (error || !data) {
        setError('Carte introuvable');
      } else {
        setCard(data as unknown as CardData);
      }
      setLoading(false);
    })();
  }, [uid]);

  const walletUnavailable = () =>
    alert(
      "L'intégration Apple Wallet / Google Wallet sera disponible dès que les certificats développeur seront configurés. En attendant, ajoutez cette page à votre écran d'accueil pour un accès rapide.",
    );

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-black via-neutral-900 to-black p-4 text-white">
      <div className="w-full max-w-sm">
        {loading && (
          <p className="text-center text-sm text-white/70">Chargement de la carte...</p>
        )}

        {error && !loading && (
          <div className="text-center">
            <p className="text-red-400 mb-2">{error}</p>
            <p className="text-xs text-white/60">Vérifiez le lien reçu par SMS.</p>
          </div>
        )}

        {card && (
          <>
            {/* The card */}
            <div className="relative rounded-3xl overflow-hidden shadow-2xl border border-amber-400/30 bg-gradient-to-br from-black via-neutral-900 to-black">
              <div
                className="absolute inset-0 opacity-30"
                style={{
                  backgroundImage:
                    'radial-gradient(circle at 20% 0%, rgba(212,175,55,0.35), transparent 55%), radial-gradient(circle at 100% 100%, rgba(212,175,55,0.25), transparent 55%)',
                }}
              />
              <div className="relative p-6 flex flex-col items-center">
                {/* Top: L'Access logo */}
                <img
                  src={laccessLogo.url}
                  alt="L'Access"
                  className="w-24 h-24 object-contain rounded-xl mb-4 shadow-lg"
                />

                {/* Name */}
                <p className="uppercase tracking-widest text-[10px] text-amber-300/80 mb-1">
                  Carte membre
                </p>
                <h1 className="text-2xl font-serif font-bold text-amber-100 text-center leading-tight">
                  {card.first_name}
                  <br />
                  {card.last_name}
                </h1>

                {/* Company */}
                {card.partner_companies && (
                  <div className="mt-5 pt-5 border-t border-amber-400/20 w-full flex flex-col items-center">
                    <p className="text-[10px] uppercase tracking-widest text-white/50 mb-2">
                      Partenaire
                    </p>
                    {card.partner_companies.logo_url ? (
                      <img
                        src={card.partner_companies.logo_url}
                        alt={card.partner_companies.name}
                        className="max-h-16 object-contain bg-white rounded p-2"
                      />
                    ) : (
                      <p className="text-sm">{card.partner_companies.name}</p>
                    )}
                    <p className="mt-2 text-xs text-white/70">{card.partner_companies.name}</p>
                  </div>
                )}

                {/* Bottom: Le Français */}
                <div className="mt-5 pt-5 border-t border-amber-400/20 w-full flex flex-col items-center">
                  <p className="text-[10px] uppercase tracking-widest text-white/50 mb-2">
                    Valable chez
                  </p>
                  <img
                    src={leFrancaisLogo.url}
                    alt="Café Le Français"
                    className="max-h-14 object-contain"
                  />
                </div>

                <p className="mt-6 text-[10px] text-white/40 font-mono">{card.card_uid}</p>
              </div>
            </div>

            {/* Wallet buttons (disabled) */}
            <div className="mt-6 space-y-2">
              <Button
                onClick={walletUnavailable}
                variant="outline"
                className="w-full bg-black text-white border-white/30 hover:bg-neutral-900"
              >
                <Apple className="w-4 h-4 mr-2" />
                Ajouter à Apple Wallet
              </Button>
              <Button
                onClick={walletUnavailable}
                variant="outline"
                className="w-full bg-black text-white border-white/30 hover:bg-neutral-900"
              >
                <Wallet className="w-4 h-4 mr-2" />
                Ajouter à Google Wallet
              </Button>
              <p className="text-[10px] text-center text-white/40 mt-2">
                Bientôt disponible — en attendant, ajoutez cette page à l'écran d'accueil.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Carte;