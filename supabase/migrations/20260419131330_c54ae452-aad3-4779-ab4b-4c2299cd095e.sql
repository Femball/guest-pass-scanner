-- Table pour les retours de satisfaction post-événement
CREATE TABLE public.event_feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reservation_id UUID NOT NULL REFERENCES public.reservations(id) ON DELETE CASCADE,
  client_email TEXT NOT NULL,
  client_name TEXT NOT NULL,
  event_date DATE NOT NULL,
  token TEXT NOT NULL UNIQUE,
  rating INTEGER,
  comment TEXT,
  submitted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT event_feedback_rating_range CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5)),
  CONSTRAINT event_feedback_comment_length CHECK (comment IS NULL OR length(comment) <= 2000)
);

CREATE UNIQUE INDEX event_feedback_reservation_unique ON public.event_feedback(reservation_id);
CREATE INDEX event_feedback_event_date_idx ON public.event_feedback(event_date DESC);

ALTER TABLE public.event_feedback ENABLE ROW LEVEL SECURITY;

-- Lecture par token (public, permet à un invité d'accéder à son enquête via le lien email)
CREATE POLICY "Public can read feedback by token"
ON public.event_feedback FOR SELECT
TO anon, authenticated
USING (true);

-- Soumission publique (mise à jour rating/comment via le token, sans authentification)
CREATE POLICY "Public can submit feedback"
ON public.event_feedback FOR UPDATE
TO anon, authenticated
USING (submitted_at IS NULL)
WITH CHECK (submitted_at IS NOT NULL);

-- Service role peut insérer (génération depuis l'edge function de l'enquête J+1)
CREATE POLICY "Service role can insert feedback"
ON public.event_feedback FOR INSERT
TO public
WITH CHECK (auth.role() = 'service_role');

-- Admins/supervisors peuvent tout lire dans le dashboard
CREATE POLICY "Admins can read all feedback"
ON public.event_feedback FOR SELECT
TO authenticated
USING (public.has_admin_privileges(auth.uid()));

-- Table journal des envois automatiques (idempotence)
CREATE TABLE public.email_dispatch_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reservation_id UUID NOT NULL REFERENCES public.reservations(id) ON DELETE CASCADE,
  dispatch_type TEXT NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT email_dispatch_log_type_check CHECK (dispatch_type IN ('reminder_d_minus_1', 'feedback_d_plus_1'))
);

CREATE UNIQUE INDEX email_dispatch_log_unique ON public.email_dispatch_log(reservation_id, dispatch_type);

ALTER TABLE public.email_dispatch_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages dispatch log"
ON public.email_dispatch_log FOR ALL
TO public
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Admins can read dispatch log"
ON public.email_dispatch_log FOR SELECT
TO authenticated
USING (public.has_admin_privileges(auth.uid()));