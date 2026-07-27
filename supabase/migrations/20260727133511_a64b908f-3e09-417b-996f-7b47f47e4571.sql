
-- 1. Drop the overly-permissive public policies
DROP POLICY IF EXISTS "Public can read member cards by uid" ON public.member_cards;
DROP POLICY IF EXISTS "Public can read partner companies" ON public.partner_companies;

-- 2. Public lookup RPC (returns only non-sensitive fields)
CREATE OR REPLACE FUNCTION public.get_member_card_by_uid(p_uid text)
RETURNS TABLE (
  card_uid text,
  first_name text,
  last_name text,
  company_name text,
  company_logo_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT mc.card_uid, mc.first_name, mc.last_name, pc.name, pc.logo_url
  FROM public.member_cards mc
  LEFT JOIN public.partner_companies pc ON pc.id = mc.company_id
  WHERE mc.card_uid = p_uid
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_member_card_by_uid(text) TO anon, authenticated;

-- 3. Storage policies for partner-logos bucket
DROP POLICY IF EXISTS "Staff can read partner logos" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload partner logos" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update partner logos" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete partner logos" ON storage.objects;

CREATE POLICY "Staff can read partner logos"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'partner-logos' AND public.is_staff(auth.uid()));

CREATE POLICY "Admins can upload partner logos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'partner-logos' AND public.has_admin_privileges(auth.uid()));

CREATE POLICY "Admins can update partner logos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'partner-logos' AND public.has_admin_privileges(auth.uid()))
WITH CHECK (bucket_id = 'partner-logos' AND public.has_admin_privileges(auth.uid()));

CREATE POLICY "Admins can delete partner logos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'partner-logos' AND public.has_admin_privileges(auth.uid()));
