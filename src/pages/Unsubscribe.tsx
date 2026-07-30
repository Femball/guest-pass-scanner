import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle, XCircle, Loader2, MailX } from 'lucide-react';
import Seo from '@/components/Seo';

type Status = 'loading' | 'valid' | 'already' | 'invalid' | 'success' | 'error';

const Unsubscribe = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<Status>('loading');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!token) {
      setStatus('invalid');
      return;
    }
    const validate = async () => {
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        const res = await fetch(
          `${supabaseUrl}/functions/v1/handle-email-unsubscribe?token=${token}`,
          { headers: { apikey: anonKey } }
        );
        const data = await res.json();
        if (data.valid === false && data.reason === 'already_unsubscribed') {
          setStatus('already');
        } else if (data.valid) {
          setStatus('valid');
        } else {
          setStatus('invalid');
        }
      } catch {
        setStatus('invalid');
      }
    };
    validate();
  }, [token]);

  const handleUnsubscribe = async () => {
    if (!token) return;
    setProcessing(true);
    try {
      const { data } = await supabase.functions.invoke('handle-email-unsubscribe', {
        body: { token },
      });
      if (data?.success) {
        setStatus('success');
      } else if (data?.reason === 'already_unsubscribed') {
        setStatus('already');
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-4">
      <Seo
        title="Se désabonner des emails — L'Access"
        description="Gérez vos préférences email L'Access et désabonnez-vous en un clic des invitations et rappels de soirée."
        noindex
      />
      <Card className="max-w-md w-full">
        <CardContent className="pt-6 text-center space-y-4">
          <h1 className="sr-only">Désabonnement des emails L'Access</h1>
          {status === 'loading' && (
            <>
              <Loader2 className="h-12 w-12 animate-spin text-muted-foreground mx-auto" />
              <p className="text-muted-foreground">Vérification en cours…</p>
            </>
          )}
          {status === 'valid' && (
            <>
              <MailX className="h-12 w-12 text-primary mx-auto" />
              <h2 className="text-xl font-semibold text-foreground">Se désabonner</h2>
              <p className="text-muted-foreground">
                Vous ne recevrez plus d'emails de notre part.
              </p>
              <Button onClick={handleUnsubscribe} disabled={processing} className="w-full">
                {processing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Confirmer le désabonnement
              </Button>
            </>
          )}
          {status === 'success' && (
            <>
              <CheckCircle className="h-12 w-12 text-primary mx-auto" />
              <h2 className="text-xl font-semibold text-foreground">Désabonnement confirmé</h2>
              <p className="text-muted-foreground">Vous avez été désabonné avec succès.</p>
            </>
          )}
          {status === 'already' && (
            <>
              <CheckCircle className="h-12 w-12 text-muted-foreground mx-auto" />
              <h2 className="text-xl font-semibold text-foreground">Déjà désabonné</h2>
              <p className="text-muted-foreground">Vous êtes déjà désabonné de nos emails.</p>
            </>
          )}
          {status === 'invalid' && (
            <>
              <XCircle className="h-12 w-12 text-destructive mx-auto" />
              <h2 className="text-xl font-semibold text-foreground">Lien invalide</h2>
              <p className="text-muted-foreground">Ce lien de désabonnement est invalide ou expiré.</p>
            </>
          )}
          {status === 'error' && (
            <>
              <XCircle className="h-12 w-12 text-destructive mx-auto" />
              <h2 className="text-xl font-semibold text-foreground">Erreur</h2>
              <p className="text-muted-foreground">Une erreur est survenue. Veuillez réessayer.</p>
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
};

export default Unsubscribe;
