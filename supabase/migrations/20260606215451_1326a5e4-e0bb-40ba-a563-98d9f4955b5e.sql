
-- 1. Table clients
CREATE TABLE public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text,
  email text,
  notes text,
  reservation_count integer NOT NULL DEFAULT 0,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX clients_phone_unique ON public.clients (lower(phone)) WHERE phone IS NOT NULL;
CREATE UNIQUE INDEX clients_email_unique ON public.clients (lower(email)) WHERE email IS NOT NULL AND phone IS NULL;
CREATE INDEX clients_name_idx ON public.clients (lower(name));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients TO authenticated;
GRANT ALL ON public.clients TO service_role;

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view clients"
  ON public.clients FOR SELECT
  TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff can insert clients"
  ON public.clients FOR INSERT
  TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Staff can update clients"
  ON public.clients FOR UPDATE
  TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Staff can delete clients"
  ON public.clients FOR DELETE
  TO authenticated
  USING (public.is_staff(auth.uid()));

-- 2. updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_clients_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER clients_touch_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.touch_clients_updated_at();

-- 3. Validation
CREATE OR REPLACE FUNCTION public.validate_client_input()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF length(NEW.name) > 100 OR length(NEW.name) = 0 THEN
    RAISE EXCEPTION 'name must be between 1 and 100 characters';
  END IF;
  IF NEW.email IS NOT NULL AND NEW.email !~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
    RAISE EXCEPTION 'Invalid email format';
  END IF;
  IF NEW.email IS NOT NULL AND length(NEW.email) > 255 THEN
    RAISE EXCEPTION 'email too long';
  END IF;
  IF NEW.phone IS NOT NULL AND NEW.phone !~ '^[0-9 +().-]{6,30}$' THEN
    RAISE EXCEPTION 'Invalid phone format';
  END IF;
  IF NEW.notes IS NOT NULL AND length(NEW.notes) > 2000 THEN
    RAISE EXCEPTION 'notes too long';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER clients_validate_input
  BEFORE INSERT OR UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.validate_client_input();

-- 4. Sync trigger from reservations
CREATE OR REPLACE FUNCTION public.sync_client_from_reservation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing_id uuid;
  is_new_reservation boolean;
BEGIN
  is_new_reservation := (TG_OP = 'INSERT');

  IF NEW.client_phone IS NULL AND NEW.client_email IS NULL THEN
    RETURN NEW;
  END IF;

  -- Try to find existing client by phone first, then by email
  IF NEW.client_phone IS NOT NULL THEN
    SELECT id INTO existing_id FROM public.clients
    WHERE lower(phone) = lower(NEW.client_phone) LIMIT 1;
  END IF;

  IF existing_id IS NULL AND NEW.client_email IS NOT NULL THEN
    SELECT id INTO existing_id FROM public.clients
    WHERE lower(email) = lower(NEW.client_email) LIMIT 1;
  END IF;

  IF existing_id IS NULL THEN
    INSERT INTO public.clients (name, phone, email, reservation_count, first_seen_at, last_seen_at)
    VALUES (NEW.client_name, NEW.client_phone, NEW.client_email, 1, now(), now());
  ELSE
    UPDATE public.clients SET
      name = COALESCE(NULLIF(NEW.client_name, ''), name),
      phone = COALESCE(phone, NEW.client_phone),
      email = COALESCE(email, NEW.client_email),
      last_seen_at = now(),
      reservation_count = reservation_count + CASE WHEN is_new_reservation THEN 1 ELSE 0 END
    WHERE id = existing_id;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Don't block reservation creation on client sync failures
  RAISE WARNING 'sync_client_from_reservation failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

CREATE TRIGGER reservations_sync_client
  AFTER INSERT OR UPDATE OF client_name, client_phone, client_email ON public.reservations
  FOR EACH ROW EXECUTE FUNCTION public.sync_client_from_reservation();

-- 5. Backfill existing reservations
INSERT INTO public.clients (name, phone, email, reservation_count, first_seen_at, last_seen_at)
SELECT
  (array_agg(client_name ORDER BY created_at DESC))[1] AS name,
  MAX(client_phone) AS phone,
  MAX(client_email) AS email,
  COUNT(*)::int AS reservation_count,
  MIN(created_at) AS first_seen_at,
  MAX(created_at) AS last_seen_at
FROM public.reservations
WHERE client_phone IS NOT NULL OR client_email IS NOT NULL
GROUP BY COALESCE(lower(client_phone), 'email:' || lower(client_email))
ON CONFLICT DO NOTHING;
