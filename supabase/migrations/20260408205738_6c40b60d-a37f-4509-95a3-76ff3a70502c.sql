ALTER TABLE public.scan_notifications
ADD COLUMN IF NOT EXISTS source_kind text,
ADD COLUMN IF NOT EXISTS source_record_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS scan_notifications_source_unique_idx
ON public.scan_notifications (source_kind, source_record_id)
WHERE source_kind IS NOT NULL AND source_record_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.create_scan_notification_from_reservation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_validated IS TRUE AND COALESCE(OLD.is_validated, FALSE) IS FALSE THEN
    INSERT INTO public.scan_notifications (client_name, event_date, scanned_by, source_kind, source_record_id)
    VALUES (NEW.client_name, NEW.event_date, auth.uid(), 'reservation', NEW.id)
    ON CONFLICT (source_kind, source_record_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_scan_notification_from_flyer_scan()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  flyer_record public.flyer_invitations%ROWTYPE;
BEGIN
  SELECT *
  INTO flyer_record
  FROM public.flyer_invitations
  WHERE id = NEW.flyer_invitation_id;

  IF flyer_record.id IS NOT NULL THEN
    INSERT INTO public.scan_notifications (client_name, event_date, scanned_by, source_kind, source_record_id)
    VALUES ('Invité Flyer - ' || flyer_record.label, flyer_record.event_date, auth.uid(), 'flyer_scan', NEW.id)
    ON CONFLICT (source_kind, source_record_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS create_scan_notification_on_reservation_validation ON public.reservations;
CREATE TRIGGER create_scan_notification_on_reservation_validation
AFTER UPDATE OF is_validated ON public.reservations
FOR EACH ROW
EXECUTE FUNCTION public.create_scan_notification_from_reservation();

DROP TRIGGER IF EXISTS create_scan_notification_on_flyer_scan ON public.flyer_scans;
CREATE TRIGGER create_scan_notification_on_flyer_scan
AFTER INSERT ON public.flyer_scans
FOR EACH ROW
EXECUTE FUNCTION public.create_scan_notification_from_flyer_scan();