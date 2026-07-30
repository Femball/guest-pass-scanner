CREATE OR REPLACE FUNCTION public.can_view_members(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin','agent','supervisor','member_control')
  )
$$;

REVOKE EXECUTE ON FUNCTION public.can_view_members(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_members(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Staff can view member cards" ON public.member_cards;
CREATE POLICY "Members viewers can view member cards"
ON public.member_cards FOR SELECT TO authenticated
USING (public.can_view_members(auth.uid()));

DROP POLICY IF EXISTS "Staff can view partner companies" ON public.partner_companies;
CREATE POLICY "Members viewers can view partner companies"
ON public.partner_companies FOR SELECT TO authenticated
USING (public.can_view_members(auth.uid()));