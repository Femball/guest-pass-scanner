ALTER TABLE public.special_bookings
  ADD COLUMN IF NOT EXISTS validated_at timestamptz,
  ADD COLUMN IF NOT EXISTS seated_at timestamptz;

CREATE OR REPLACE FUNCTION public.check_in_special_booking(p_qr text)
RETURNS TABLE(id uuid, guest_names text, number_of_persons integer, seat_rows text, seat_numbers text, event_title text, event_date date, already_validated_at timestamptz, seated_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE b record; prev timestamptz;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT sb.*, se.title AS ev_title, se.event_date AS ev_date INTO b
  FROM public.special_bookings sb JOIN public.special_events se ON se.id = sb.event_id
  WHERE upper(sb.qr_code) = upper(p_qr) FOR UPDATE OF sb;
  IF NOT FOUND THEN RETURN; END IF;
  prev := b.validated_at;
  IF prev IS NULL AND b.ev_date = (now() AT TIME ZONE 'Europe/Paris')::date THEN
    UPDATE public.special_bookings SET validated_at = now() WHERE special_bookings.id = b.id;
  END IF;
  RETURN QUERY SELECT b.id, b.guest_names, b.number_of_persons, b.seat_rows, b.seat_numbers, b.ev_title, b.ev_date, prev, b.seated_at;
END $$;

CREATE OR REPLACE FUNCTION public.seat_special_booking(p_id uuid)
RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t timestamptz;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.special_bookings SET seated_at = COALESCE(seated_at, now()) WHERE id = p_id RETURNING seated_at INTO t;
  RETURN t;
END $$;

REVOKE EXECUTE ON FUNCTION public.check_in_special_booking(text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.seat_special_booking(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.check_in_special_booking(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.seat_special_booking(uuid) TO authenticated;