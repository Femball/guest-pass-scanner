CREATE OR REPLACE FUNCTION public.prevent_role_self_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Allow service role and superuser/postgres (trusted contexts) to bypass
  IF auth.role() = 'service_role' OR current_user IN ('postgres','supabase_admin','service_role') THEN
    RETURN NEW;
  END IF;
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can assign roles';
  END IF;
  RETURN NEW;
END;
$function$;