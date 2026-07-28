ALTER TABLE public.member_cards ADD COLUMN IF NOT EXISTS member_type text NOT NULL DEFAULT 'Standard';

DROP FUNCTION IF EXISTS public.get_member_card_by_uid(text);

CREATE FUNCTION public.get_member_card_by_uid(p_uid text)
RETURNS TABLE (
  card_uid text,
  first_name text,
  last_name text,
  company_name text,
  company_logo_url text,
  valid_until date,
  member_type text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT mc.card_uid, mc.first_name, mc.last_name, pc.name, pc.logo_url, mc.valid_until, mc.member_type
  FROM public.member_cards mc
  LEFT JOIN public.partner_companies pc ON pc.id = mc.company_id
  WHERE mc.card_uid = p_uid
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_member_card_by_uid(text) TO anon, authenticated, service_role;