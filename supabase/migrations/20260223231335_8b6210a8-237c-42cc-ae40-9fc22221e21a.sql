
-- Validation trigger for reservations
CREATE OR REPLACE FUNCTION public.validate_reservation_input()
RETURNS TRIGGER AS $$
BEGIN
  -- Validate client_name length
  IF length(NEW.client_name) > 100 THEN
    RAISE EXCEPTION 'client_name must be 100 characters or less';
  END IF;

  -- Validate client_email format if provided
  IF NEW.client_email IS NOT NULL AND NEW.client_email !~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
    RAISE EXCEPTION 'Invalid email format';
  END IF;

  -- Validate client_email length
  IF NEW.client_email IS NOT NULL AND length(NEW.client_email) > 255 THEN
    RAISE EXCEPTION 'client_email must be 255 characters or less';
  END IF;

  -- Validate qr_code length
  IF length(NEW.qr_code) > 200 THEN
    RAISE EXCEPTION 'qr_code must be 200 characters or less';
  END IF;

  -- Validate number_of_persons
  IF NEW.number_of_persons < 1 OR NEW.number_of_persons > 100 THEN
    RAISE EXCEPTION 'number_of_persons must be between 1 and 100';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER validate_reservation_before_insert_update
BEFORE INSERT OR UPDATE ON public.reservations
FOR EACH ROW
EXECUTE FUNCTION public.validate_reservation_input();

-- Validation trigger for reservation_bottles
CREATE OR REPLACE FUNCTION public.validate_bottle_input()
RETURNS TRIGGER AS $$
BEGIN
  -- Validate bottle_type length
  IF length(NEW.bottle_type) > 100 THEN
    RAISE EXCEPTION 'bottle_type must be 100 characters or less';
  END IF;

  -- Validate quantity
  IF NEW.quantity < 1 OR NEW.quantity > 1000 THEN
    RAISE EXCEPTION 'quantity must be between 1 and 1000';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER validate_bottle_before_insert_update
BEFORE INSERT OR UPDATE ON public.reservation_bottles
FOR EACH ROW
EXECUTE FUNCTION public.validate_bottle_input();
