CREATE OR REPLACE FUNCTION public.special_booking_seat_keys(_rows text, _nums text)
RETURNS text[] LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT COALESCE(array_agg(DISTINCT upper(trim(r)) || '-' || trim(n)), '{}')
  FROM unnest(string_to_array(COALESCE(_rows,''), ',')) r,
       unnest(string_to_array(COALESCE(_nums,''), ',')) n
  WHERE trim(r) <> '' AND trim(n) <> ''
$$;

CREATE OR REPLACE FUNCTION public.prevent_duplicate_special_seats()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _keys text[]; _clash text;
BEGIN
  _keys := public.special_booking_seat_keys(NEW.seat_rows, NEW.seat_numbers);
  IF array_length(_keys, 1) IS NULL THEN RETURN NEW; END IF;
  SELECT k INTO _clash
  FROM special_bookings b, unnest(public.special_booking_seat_keys(b.seat_rows, b.seat_numbers)) k
  WHERE b.event_id = NEW.event_id AND b.id <> NEW.id AND k = ANY(_keys)
  LIMIT 1;
  IF _clash IS NOT NULL THEN
    RAISE EXCEPTION 'SEAT_TAKEN:%', _clash USING ERRCODE = '23505';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_prevent_duplicate_special_seats ON public.special_bookings;
CREATE TRIGGER trg_prevent_duplicate_special_seats
BEFORE INSERT OR UPDATE OF seat_rows, seat_numbers, event_id ON public.special_bookings
FOR EACH ROW EXECUTE FUNCTION public.prevent_duplicate_special_seats();

REVOKE EXECUTE ON FUNCTION public.prevent_duplicate_special_seats() FROM anon, authenticated;