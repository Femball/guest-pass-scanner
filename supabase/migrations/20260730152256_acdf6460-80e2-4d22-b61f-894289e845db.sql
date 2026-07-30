CREATE OR REPLACE FUNCTION public.notify_wallet_pass_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $fn$
DECLARE
  service_key text;
BEGIN
  NEW.updated_at := now();
  IF TG_OP = 'UPDATE' THEN
    SELECT decrypted_secret INTO service_key FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1;
    IF service_key IS NOT NULL THEN
      IF EXISTS (SELECT 1 FROM public.wallet_registrations WHERE serial_number = NEW.card_uid) THEN
        PERFORM net.http_post(
          url := 'https://cgowurmyyrkftiqweavn.supabase.co/functions/v1/apple-wallet-webservice/push',
          headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || service_key),
          body := jsonb_build_object('serial_number', NEW.card_uid)
        );
      END IF;
      PERFORM net.http_post(
        url := 'https://cgowurmyyrkftiqweavn.supabase.co/functions/v1/sync-google-wallet',
        headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || service_key),
        body := jsonb_build_object('uid', NEW.card_uid)
      );
    END IF;
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_wallet_pass_update failed: %', SQLERRM;
  RETURN NEW;
END;
$fn$;