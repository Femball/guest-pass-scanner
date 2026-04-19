-- =========================================
-- 1) PURGE RGPD : supprime données > 90 jours
-- =========================================
CREATE OR REPLACE FUNCTION public.purge_old_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cutoff_date date := (CURRENT_DATE - INTERVAL '90 days')::date;
  deleted_reservations int := 0;
  deleted_scans int := 0;
  deleted_flyer_scans int := 0;
  deleted_feedback int := 0;
  deleted_dispatch int := 0;
BEGIN
  -- Email dispatch logs liés à des réservations anciennes
  DELETE FROM public.email_dispatch_log
  WHERE reservation_id IN (
    SELECT id FROM public.reservations WHERE event_date < cutoff_date
  );
  GET DIAGNOSTICS deleted_dispatch = ROW_COUNT;

  -- Feedback (cascade non actif, donc avant reservations)
  DELETE FROM public.event_feedback WHERE event_date < cutoff_date;
  GET DIAGNOSTICS deleted_feedback = ROW_COUNT;

  -- Scan notifications anciennes
  DELETE FROM public.scan_notifications WHERE event_date < cutoff_date;
  GET DIAGNOSTICS deleted_scans = ROW_COUNT;

  -- Flyer scans anciens
  DELETE FROM public.flyer_scans
  WHERE flyer_invitation_id IN (
    SELECT id FROM public.flyer_invitations WHERE event_date < cutoff_date
  );
  GET DIAGNOSTICS deleted_flyer_scans = ROW_COUNT;

  -- Réservations anciennes (cascade supprime reservation_bottles)
  DELETE FROM public.reservations WHERE event_date < cutoff_date;
  GET DIAGNOSTICS deleted_reservations = ROW_COUNT;

  RETURN jsonb_build_object(
    'cutoff_date', cutoff_date,
    'deleted_reservations', deleted_reservations,
    'deleted_scan_notifications', deleted_scans,
    'deleted_flyer_scans', deleted_flyer_scans,
    'deleted_feedback', deleted_feedback,
    'deleted_dispatch_logs', deleted_dispatch
  );
END;
$$;

REVOKE ALL ON FUNCTION public.purge_old_data() FROM PUBLIC, anon, authenticated;

-- =========================================
-- 2) TABLE des anomalies de scan
-- =========================================
CREATE TABLE IF NOT EXISTS public.scan_anomalies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name text NOT NULL,
  event_date date NOT NULL,
  source_kind text,
  source_record_id uuid,
  first_scan_at timestamptz NOT NULL,
  duplicate_scan_at timestamptz NOT NULL DEFAULT now(),
  delta_seconds numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.scan_anomalies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read scan anomalies"
ON public.scan_anomalies FOR SELECT
TO authenticated
USING (public.is_staff(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_scan_anomalies_created ON public.scan_anomalies(created_at DESC);

-- =========================================
-- 3) DÉTECTION double-scan < 30s
-- =========================================
CREATE OR REPLACE FUNCTION public.detect_duplicate_scan()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  prev record;
BEGIN
  IF NEW.source_kind IS NULL OR NEW.source_record_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT created_at INTO prev
  FROM public.scan_notifications
  WHERE source_kind = NEW.source_kind
    AND source_record_id = NEW.source_record_id
    AND id <> NEW.id
    AND created_at > (NEW.created_at - INTERVAL '30 seconds')
  ORDER BY created_at DESC
  LIMIT 1;

  IF prev.created_at IS NOT NULL THEN
    INSERT INTO public.scan_anomalies (
      client_name, event_date, source_kind, source_record_id,
      first_scan_at, duplicate_scan_at, delta_seconds
    ) VALUES (
      NEW.client_name, NEW.event_date, NEW.source_kind, NEW.source_record_id,
      prev.created_at, NEW.created_at,
      EXTRACT(EPOCH FROM (NEW.created_at - prev.created_at))
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_detect_duplicate_scan ON public.scan_notifications;
CREATE TRIGGER trg_detect_duplicate_scan
AFTER INSERT ON public.scan_notifications
FOR EACH ROW EXECUTE FUNCTION public.detect_duplicate_scan();

-- Contrainte unique pour éviter doublons exacts (déjà utilisé par ON CONFLICT)
CREATE UNIQUE INDEX IF NOT EXISTS uq_scan_notifications_source
ON public.scan_notifications(source_kind, source_record_id)
WHERE source_kind IS NOT NULL AND source_record_id IS NOT NULL;