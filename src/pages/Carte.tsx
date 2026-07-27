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
  company_name: string | null;
  company_logo_url: string | null;
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
      const { data, error } = await supabase.rpc('get_member_card_by_uid', { p_uid: uid });
      const row = Array.isArray(data) ? data[0] : null;
      if (error || !row) {
        setError('Carte introuvable');
      } else {
        setCard(row as CardData);
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
      <div className="w-full max-w-md">
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
            {/* The card — credit-card aspect ratio (85.6 x 53.98 mm ≈ 1.586:1) */}
            <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-amber-400/30 bg-gradient-to-br from-black via-neutral-900 to-black aspect-[1.586/1] w-full">
              <div
                className="absolute inset-0 opacity-30"
                style={{
                  backgroundImage:
                    'radial-gradient(circle at 20% 0%, rgba(212,175,55,0.35), transparent 55%), radial-gradient(circle at 100% 100%, rgba(212,175,55,0.25), transparent 55%)',
                }}
              />
              <div className="relative h-full w-full p-4 grid grid-cols-[1fr_auto] grid-rows-[auto_1fr_auto] gap-2">
                {/* Top left: L'Access logo */}
                <img
                  src={laccessLogo.url}
                  alt="L'Access"
                  className="w-12 h-12 object-contain rounded-lg shadow-lg row-start-1 col-start-1"
                />

                {/* Top right: Entreprise logo */}
                <div className="row-start-1 col-start-2 flex items-start justify-end">
                  {card.company_logo_url ? (
                    <img
                      src={card.company_logo_url}
                      alt={card.company_name ?? 'Entreprise'}
                      className="max-h-12 max-w-[80px] object-contain bg-white rounded p-1"
                    />
                  ) : card.company_name ? (
                    <p className="text-xs text-white/80 text-right max-w-[100px]">{card.company_name}</p>
                  ) : null}
                </div>

                {/* Middle: Name */}
                <div className="row-start-2 col-span-2 flex flex-col justify-center">
                  <p className="uppercase tracking-widest text-[9px] text-amber-300/80 mb-1">
                    Carte membre
                  </p>
                  <h1 className="text-xl font-serif font-bold text-amber-100 leading-tight">
                    {card.first_name} {card.last_name}
                  </h1>
                  {card.company_name && card.company_logo_url && (
                    <p className="mt-1 text-[10px] uppercase tracking-wider text-white/60">
                      Entreprise · {card.company_name}
                    </p>
                  )}
                </div>

                {/* Bottom left: UID */}
                <p className="row-start-3 col-start-1 self-end text-[9px] text-white/40 font-mono">
                  {card.card_uid}
                </p>

                {/* Bottom right: Le Français */}
                <div className="row-start-3 col-start-2 self-end flex flex-col items-end">
                  <p className="text-[8px] uppercase tracking-widest text-white/50">Valable chez</p>
                  <img
                    src={leFrancaisLogo.url}
                    alt="Café Le Français"
                    className="max-h-8 object-contain"
                  />
                </div>
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