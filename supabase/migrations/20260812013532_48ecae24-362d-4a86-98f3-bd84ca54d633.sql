CREATE OR REPLACE FUNCTION public.get_public_ticket(p_short text)
RETURNS TABLE(qr_code text, guest_name text, event_date date, event_time text, seats text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kind text;
  v_hex text;
  v_uuid uuid;
  v_code text;
BEGIN
  IF p_short IS NULL OR length(p_short) <> 33 THEN
    RETURN;
  END IF;
  v_kind := lower(left(p_short, 1));
  v_hex := lower(right(p_short, 32));
  IF v_hex !~ '^[0-9a-f]{32}$' THEN
    RETURN;
  END IF;
  BEGIN
    v_uuid := v_hex::uuid;
  EXCEPTION WHEN others THEN
    RETURN;
  END;

  IF v_kind = 'r' THEN
    v_code := 'TICKET-' || v_uuid::text;
    RETURN QUERY
      SELECT r.qr_code, r.client_name, r.event_date, NULL::text, NULL::text
      FROM public.reservations r
      WHERE r.qr_code = v_code
      LIMIT 1;
  ELSIF v_kind = 's' THEN
    v_code := 'SOIREE-' || v_uuid::text;
    RETURN QUERY
      SELECT b.qr_code,
             b.guest_names,
             e.event_date,
             e.event_time,
             NULLIF(trim(coalesce(b.seat_rows, '') || ' ' || coalesce(b.seat_numbers, '')), '')
      FROM public.special_bookings b
      JOIN public.special_events e ON e.id = b.event_id
      WHERE b.qr_code = v_code
      LIMIT 1;
  END IF;
  RETURN;
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_ticket(text) FROM public;
GRANT EXECUTE ON FUNCTION public.get_public_ticket(text) TO anon, authenticated, service_role;