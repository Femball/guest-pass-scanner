
-- Add payment fields to reservations
ALTER TABLE public.reservations
  ADD COLUMN amount numeric(10,2) DEFAULT NULL,
  ADD COLUMN payment_method text DEFAULT NULL,
  ADD COLUMN payment_status text DEFAULT 'pending',
  ADD COLUMN sumup_checkout_id text DEFAULT NULL;

-- Add validation trigger for payment fields
CREATE OR REPLACE FUNCTION public.validate_payment_input()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  -- Validate amount
  IF NEW.amount IS NOT NULL AND (NEW.amount < 0 OR NEW.amount > 100000) THEN
    RAISE EXCEPTION 'amount must be between 0 and 100000';
  END IF;

  -- Validate payment_method
  IF NEW.payment_method IS NOT NULL AND NEW.payment_method NOT IN ('cash', 'card') THEN
    RAISE EXCEPTION 'payment_method must be cash or card';
  END IF;

  -- Validate payment_status
  IF NEW.payment_status IS NOT NULL AND NEW.payment_status NOT IN ('pending', 'paid', 'failed') THEN
    RAISE EXCEPTION 'payment_status must be pending, paid, or failed';
  END IF;

  -- Validate sumup_checkout_id length
  IF NEW.sumup_checkout_id IS NOT NULL AND length(NEW.sumup_checkout_id) > 255 THEN
    RAISE EXCEPTION 'sumup_checkout_id must be 255 characters or less';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_payment_before_insert_update
  BEFORE INSERT OR UPDATE ON public.reservations
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_payment_input();
