
ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS client_phone text;

CREATE OR REPLACE FUNCTION public.validate_reservation_input()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF length(NEW.client_name) > 100 THEN
    RAISE EXCEPTION 'client_name must be 100 characters or less';
  END IF;

  IF NEW.client_email IS NOT NULL AND NEW.client_email !~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
    RAISE EXCEPTION 'Invalid email format';
  END IF;

  IF NEW.client_email IS NOT NULL AND length(NEW.client_email) > 255 THEN
    RAISE EXCEPTION 'client_email must be 255 characters or less';
  END IF;

  IF NEW.client_phone IS NOT NULL AND length(NEW.client_phone) > 30 THEN
    RAISE EXCEPTION 'client_phone must be 30 characters or less';
  END IF;

  IF NEW.client_phone IS NOT NULL AND NEW.client_phone !~ '^[0-9 +().-]{6,30}$' THEN
    RAISE EXCEPTION 'Invalid phone format';
  END IF;

  IF length(NEW.qr_code) > 200 THEN
    RAISE EXCEPTION 'qr_code must be 200 characters or less';
  END IF;

  IF NEW.number_of_persons < 1 OR NEW.number_of_persons > 100 THEN
    RAISE EXCEPTION 'number_of_persons must be between 1 and 100';
  END IF;

  RETURN NEW;
END;
$function$;
