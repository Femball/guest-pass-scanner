-- 1. Enable pg_net for HTTP calls from Postgres
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 2. Wipe stale push subscriptions (old VAPID key is invalid)
DELETE FROM public.push_subscriptions;

-- 3. Internal config table to hold the service-role key for the trigger.
--    Strict RLS: nobody can read it via PostgREST.
CREATE TABLE IF NOT EXISTS public.app_config (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.app_config FROM anon, authenticated;
-- No policies => no row visible to anyone via the API. Only superuser/SECURITY DEFINER funcs can read.

-- 4. Trigger function: call the edge function asynchronously via pg_net
CREATE OR REPLACE FUNCTION public.notify_push_on_scan()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  service_key text;
  function_url text := 'https://cgowurmyyrkftiqweavn.supabase.co/functions/v1/send-push-notification';
BEGIN
  SELECT value INTO service_key FROM public.app_config WHERE key = 'service_role_key';
  IF service_key IS NULL THEN
    RAISE WARNING 'notify_push_on_scan: service_role_key not configured in app_config';
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body := jsonb_build_object(
      'client_name', NEW.client_name,
      'event_date', NEW.event_date::text
    )
  );
  RETURN NEW;
END;
$$;

-- 5. Trigger on scan_notifications insert
DROP TRIGGER IF EXISTS trg_notify_push_on_scan ON public.scan_notifications;
CREATE TRIGGER trg_notify_push_on_scan
AFTER INSERT ON public.scan_notifications
FOR EACH ROW
EXECUTE FUNCTION public.notify_push_on_scan();