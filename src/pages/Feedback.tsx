import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Star, Check, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';

interface FeedbackRecord {
  id: string;
  client_name: string;
  event_date: string;
  rating: number | null;
  comment: string | null;
  submitted_at: string | null;
}

const Feedback = () => {
  const [params] = useSearchParams();
  const token = params.get('token');
  const [loading, setLoading] = useState(true);
  const [record, setRecord] = useState<FeedbackRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('Lien invalide');
      setLoading(false);
      return;
    }
    (async () => {
      const { data, error: dbErr } = await supabase
        .from('event_feedback')
        .select('id, client_name, event_date, rating, comment, submitted_at')
        .eq('token', token)
        .maybeSingle();

      if (dbErr || !data) {
        setError('Lien invalide ou expiré');
      } else {
        setRecord(data as FeedbackRecord);
        if (data.submitted_at) setSubmitted(true);
      }
      setLoading(false);
    })();
  }, [token]);

  const handleSubmit = async () => {
    if (!record || !token || rating === 0) return;
    setSubmitting(true);
    const { error: updErr } = await supabase
      .from('event_feedback')
      .update({
        rating,
        comment: comment.trim() || null,
        submitted_at: new Date().toISOString(),
      })
      .eq('token', token)
      .is('submitted_at', null);

    setSubmitting(false);
    if (updErr) {
      setError('Impossible d\'enregistrer votre avis. Réessayez plus tard.');
    } else {
      setSubmitted(true);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
          <h1 className="text-2xl font-bold text-foreground">Oups</h1>
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md text-center space-y-4"
        >
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <Check className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Merci pour votre avis !</h1>
          <p className="text-muted-foreground">
            Votre retour nous aide à améliorer nos prochaines soirées.
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 md:p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md space-y-6 bg-card border border-border rounded-2xl p-6 md:p-8 shadow-lg"
      >
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-foreground">
            Votre avis, {record?.client_name.split(' ')[0]} ?
          </h1>
          <p className="text-sm text-muted-foreground">
            Comment s'est passée votre soirée L'Access ?
          </p>
        </div>

        <div className="space-y-3">
          <label className="text-sm font-medium text-foreground block text-center">
            Votre note
          </label>
          <div className="flex items-center justify-center gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRating(n)}
                onMouseEnter={() => setHoverRating(n)}
                onMouseLeave={() => setHoverRating(0)}
                className="p-1 transition-transform hover:scale-110"
                aria-label={`${n} étoile${n > 1 ? 's' : ''}`}
              >
                <Star
                  className={`w-10 h-10 transition-colors ${
                    n <= (hoverRating || rating)
                      ? 'fill-primary text-primary'
                      : 'text-muted-foreground/40'
                  }`}
                />
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="comment" className="text-sm font-medium text-foreground">
            Un commentaire ? (optionnel)
          </label>
          <Textarea
            id="comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Ce qui vous a plu, ce qu'on peut améliorer..."
            rows={4}
            maxLength={2000}
          />
        </div>

        <Button
          onClick={handleSubmit}
          disabled={rating === 0 || submitting}
          className="w-full"
          size="lg"
        >
          {submitting ? 'Envoi…' : 'Envoyer mon avis'}
        </Button>
      </motion.div>
    </div>
  );
};

export default Feedback;
