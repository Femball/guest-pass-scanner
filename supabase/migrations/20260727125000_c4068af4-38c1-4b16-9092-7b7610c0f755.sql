
-- Partner companies
CREATE TABLE public.partner_companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  logo_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.partner_companies TO authenticated;
GRANT ALL ON public.partner_companies TO service_role;

ALTER TABLE public.partner_companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view partner companies"
  ON public.partner_companies FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE POLICY "Admins can manage partner companies"
  ON public.partner_companies FOR ALL TO authenticated
  USING (public.has_admin_privileges(auth.uid()))
  WITH CHECK (public.has_admin_privileges(auth.uid()));

CREATE TRIGGER touch_partner_companies_updated_at
  BEFORE UPDATE ON public.partner_companies
  FOR EACH ROW EXECUTE FUNCTION public.touch_clients_updated_at();

-- Member cards
CREATE TABLE public.member_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_uid text NOT NULL UNIQUE,
  first_name text NOT NULL,
  last_name text NOT NULL,
  company_id uuid REFERENCES public.partner_companies(id) ON DELETE SET NULL,
  phone text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX member_cards_company_id_idx ON public.member_cards(company_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.member_cards TO authenticated;
GRANT ALL ON public.member_cards TO service_role;
-- Public read via card_uid for the SMS link landing page
GRANT SELECT ON public.member_cards TO anon;
GRANT SELECT ON public.partner_companies TO anon;

ALTER TABLE public.member_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view member cards"
  ON public.member_cards FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE POLICY "Admins can manage member cards"
  ON public.member_cards FOR ALL TO authenticated
  USING (public.has_admin_privileges(auth.uid()))
  WITH CHECK (public.has_admin_privileges(auth.uid()));

-- Public read policies (anon + authenticated): needed for the /carte/:uid landing page.
-- Only exposes rows explicitly requested by card_uid; no enumeration.
CREATE POLICY "Public can read member cards by uid"
  ON public.member_cards FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "Public can read partner companies"
  ON public.partner_companies FOR SELECT TO anon
  USING (true);

CREATE TRIGGER touch_member_cards_updated_at
  BEFORE UPDATE ON public.member_cards
  FOR EACH ROW EXECUTE FUNCTION public.touch_clients_updated_at();
