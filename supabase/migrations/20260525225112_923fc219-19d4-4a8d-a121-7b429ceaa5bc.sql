
-- 1. EVENT_FEEDBACK: Lock down public RLS, expose via SECURITY DEFINER RPCs
DROP POLICY IF EXISTS "Public can read feedback by token" ON public.event_feedback;
DROP POLICY IF EXISTS "Public can submit feedback" ON public.event_feedback;

CREATE OR REPLACE FUNCTION public.get_feedback_by_token(p_token text)
RETURNS TABLE (
  id uuid,
  client_name text,
  event_date date,
  rating integer,
  comment text,
  submitted_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, client_name, event_date, rating, comment, submitted_at
  FROM public.event_feedback
  WHERE token = p_token
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_feedback_by_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_feedback_by_token(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.submit_feedback_by_token(
  p_token text,
  p_rating integer,
  p_comment text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated int;
BEGIN
  IF p_rating IS NULL OR p_rating < 1 OR p_rating > 5 THEN
    RAISE EXCEPTION 'rating must be between 1 and 5';
  END IF;
  IF p_comment IS NOT NULL AND length(p_comment) > 2000 THEN
    RAISE EXCEPTION 'comment too long';
  END IF;

  UPDATE public.event_feedback
  SET rating = p_rating,
      comment = NULLIF(btrim(coalesce(p_comment, '')), ''),
      submitted_at = now()
  WHERE token = p_token
    AND submitted_at IS NULL;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_feedback_by_token(text, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_feedback_by_token(text, integer, text) TO anon, authenticated;

-- 2. Move service role key from app_config to Vault
DO $$
DECLARE
  v_key text;
BEGIN
  SELECT value INTO v_key FROM public.app_config WHERE key = 'service_role_key';
  IF v_key IS NOT NULL THEN
    BEGIN
      PERFORM vault.create_secret(v_key, 'service_role_key');
    EXCEPTION WHEN unique_violation THEN
      UPDATE vault.secrets SET secret = v_key WHERE name = 'service_role_key';
    END;
  END IF;
END $$;

DELETE FROM public.app_config WHERE key = 'service_role_key';

-- 3. Update notify_push_on_scan to read service role key from Vault
CREATE OR REPLACE FUNCTION public.notify_push_on_scan()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  service_key text;
  function_url text := 'https://cgowurmyyrkftiqweavn.supabase.co/functions/v1/send-push-notification';
BEGIN
  SELECT decrypted_secret INTO service_key
  FROM vault.decrypted_secrets
  WHERE name = 'service_role_key'
  LIMIT 1;

  IF service_key IS NULL THEN
    RAISE WARNING 'notify_push_on_scan: service_role_key not configured in vault';
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
$function$;
