-- Fix 1: Restrict Realtime channel access to staff only
CREATE POLICY "Only staff can access realtime messages"
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (
    public.is_staff(auth.uid())
  );

-- Fix 2: Add BEFORE INSERT trigger to prevent self-escalation on user_roles
CREATE OR REPLACE FUNCTION public.prevent_role_self_escalation()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = 'public'
AS $$
BEGIN
  -- Only allow if the calling user already has admin role
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can assign roles';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER check_role_escalation
  BEFORE INSERT ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_role_self_escalation();