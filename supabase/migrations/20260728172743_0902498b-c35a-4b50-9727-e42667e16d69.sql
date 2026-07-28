ALTER TABLE public.member_cards
  ADD COLUMN IF NOT EXISTS wallet_auth_token text NOT NULL DEFAULT encode(extensions.gen_random_bytes(24), 'hex');

CREATE TABLE IF NOT EXISTS public.wallet_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_library_identifier text NOT NULL,
  pass_type_identifier text NOT NULL,
  serial_number text NOT NULL,
  push_token text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (device_library_identifier, serial_number)
);

GRANT SELECT ON public.wallet_registrations TO authenticated;
GRANT ALL ON public.wallet_registrations TO service_role;

ALTER TABLE public.wallet_registrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view wallet registrations" ON public.wallet_registrations;
CREATE POLICY "Admins can view wallet registrations"
  ON public.wallet_registrations FOR SELECT TO authenticated
  USING (public.has_admin_privileges(auth.uid()));

DROP POLICY IF EXISTS "Service role manages wallet registrations" ON public.wallet_registrations;
CREATE POLICY "Service role manages wallet registrations"
  ON public.wallet_registrations FOR ALL
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

CREATE OR REPLACE FUNCTION public.notify_wallet_pass_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  service_key text;
BEGIN
  NEW.updated_at := now();

  IF TG_OP = 'UPDATE' THEN
    SELECT decrypted_secret INTO service_key
    FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1;

    IF service_key IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.wallet_registrations WHERE serial_number = NEW.card_uid
    ) THEN
      PERFORM net.http_post(
        url := 'https://cgowurmyyrkftiqweavn.supabase.co/functions/v1/apple-wallet-webservice/push',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || service_key
        ),
        body := jsonb_build_object('serial_number', NEW.card_uid)
      );
    END IF;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_wallet_pass_update failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS member_cards_wallet_update ON public.member_cards;
CREATE TRIGGER member_cards_wallet_update
  BEFORE UPDATE ON public.member_cards
  FOR EACH ROW EXECUTE FUNCTION public.notify_wallet_pass_update();