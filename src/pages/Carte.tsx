import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Apple, Wallet, Loader2 } from 'lucide-react';
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

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

const Carte = () => {
  const { uid } = useParams<{ uid: string }>();
  const [card, setCard] = useState<CardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [generating, setGenerating] = useState<'apple' | 'google' | null>(null);
  const [walletError, setWalletError] = useState<string>('');

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

  const callGeneratePass = async (platform: 'apple' | 'google') => {
    if (!uid) return;
    setGenerating(platform);
    setWalletError('');
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/generate-wallet-pass`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid, platform }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Erreur inconnue' }));
        throw new Error(err.error || 'Erreur lors de la génération du pass');
      }

      if (platform === 'apple') {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `laccess-${uid}.pkpass`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      } else {
        const { save_url } = await res.json();
        window.location.href = save_url;
      }
    } catch (err) {
      console.error('Wallet generation error:', err);
      setWalletError(err instanceof Error ? err.message : 'Erreur inattendue');
    } finally {
      setGenerating(null);
    }
  };


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
              <div className="relative h-full w-full p-5 flex flex-col">
                {/* Top row: L'Access logo left, Le Français logo right */}
                <div className="flex items-start justify-between">
                  <img
                    src={laccessLogo.url}
                    alt="L'Access"
                    className="w-20 h-20 object-contain rounded-lg shadow-lg"
                  />
                  <img
                    src={leFrancaisLogo.url}
                    alt="Café Le Français"
                    className="max-h-14 object-contain"
                  />
                </div>

                {/* Middle: label + name and company logo on the same line */}
                <div className="flex-1 flex flex-col justify-center">
                  <p className="uppercase tracking-widest text-[9px] text-amber-300/80 mb-1">
                    Carte membre
                  </p>
                  <div className="flex items-center justify-between gap-3">
                    <h1 className="text-xl font-serif font-bold text-amber-100 leading-tight">
                      {card.first_name} {card.last_name}
                    </h1>
                    {card.company_logo_url ? (
                      <img
                        src={card.company_logo_url}
                        alt={card.company_name ?? 'Entreprise'}
                        className="max-h-16 max-w-[110px] object-contain bg-white rounded p-1 shrink-0"
                      />
                    ) : card.company_name ? (
                      <p className="text-xs text-white/80 text-right max-w-[120px] shrink-0">{card.company_name}</p>
                    ) : null}
                  </div>
                  {card.company_name && (
                    <p className="mt-1 text-[10px] uppercase tracking-wider text-white/60">
                      Entreprise · {card.company_name}
                    </p>
                  )}
                  <p className="mt-2 text-xs font-bold font-mono text-amber-300/80">
                    {card.card_uid}
                  </p>
                </div>

                {/* Bottom row: Valable chez */}
                <div className="flex items-end justify-end">
                  <div className="flex flex-col items-end">
                    <p className="text-xs uppercase tracking-widest text-white/50">Valable chez</p>
                    <p className="text-sm font-semibold text-white/90">Café Le Français</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Wallet buttons */}
            <div className="mt-6 space-y-2">
              {walletError && (
                <p className="text-xs text-center text-red-400 bg-red-950/40 rounded-lg px-3 py-2">
                  {walletError}
                </p>
              )}
              <Button
                onClick={() => callGeneratePass('apple')}
                disabled={generating !== null}
                variant="outline"
                className="w-full bg-black text-white border-white/30 hover:bg-neutral-900 disabled:opacity-50"
              >
                {generating === 'apple' ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Apple className="w-4 h-4 mr-2" />
                )}
                Ajouter à Apple Wallet
              </Button>
              <Button
                onClick={() => callGeneratePass('google')}
                disabled={generating !== null}
                variant="outline"
                className="w-full bg-black text-white border-white/30 hover:bg-neutral-900 disabled:opacity-50"
              >
                {generating === 'google' ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Wallet className="w-4 h-4 mr-2" />
                )}
                Ajouter à Google Wallet
              </Button>
              <p className="text-[10px] text-center text-white/40 mt-2">
                Nécessite les certificats développeur configurés côté Lovable Cloud.
              </p>
            </div>

          </>
        )}
      </div>
    </div>
  );
};

export default Carte;