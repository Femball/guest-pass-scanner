
CREATE TABLE public.special_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  event_date date NOT NULL,
  event_time text NOT NULL,
  poster_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.special_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.special_events(id) ON DELETE CASCADE,
  guest_names text NOT NULL,
  price numeric,
  qr_code text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.special_events TO authenticated;
GRANT ALL ON public.special_events TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.special_bookings TO authenticated;
GRANT ALL ON public.special_bookings TO service_role;

ALTER TABLE public.special_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.special_bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view special events" ON public.special_events FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Admins can insert special events" ON public.special_events FOR INSERT TO authenticated WITH CHECK (public.has_admin_privileges(auth.uid()));
CREATE POLICY "Admins can update special events" ON public.special_events FOR UPDATE TO authenticated USING (public.has_admin_privileges(auth.uid())) WITH CHECK (public.has_admin_privileges(auth.uid()));
CREATE POLICY "Admins can delete special events" ON public.special_events FOR DELETE TO authenticated USING (public.has_admin_privileges(auth.uid()));

CREATE POLICY "Staff can view special bookings" ON public.special_bookings FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Admins can insert special bookings" ON public.special_bookings FOR INSERT TO authenticated WITH CHECK (public.has_admin_privileges(auth.uid()));
CREATE POLICY "Admins can update special bookings" ON public.special_bookings FOR UPDATE TO authenticated USING (public.has_admin_privileges(auth.uid())) WITH CHECK (public.has_admin_privileges(auth.uid()));
CREATE POLICY "Admins can delete special bookings" ON public.special_bookings FOR DELETE TO authenticated USING (public.has_admin_privileges(auth.uid()));

CREATE TRIGGER special_events_touch BEFORE UPDATE ON public.special_events
FOR EACH ROW EXECUTE FUNCTION public.touch_clients_updated_at();
