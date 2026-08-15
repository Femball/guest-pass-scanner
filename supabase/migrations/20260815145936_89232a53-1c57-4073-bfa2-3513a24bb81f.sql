CREATE TABLE public.special_booking_meals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.special_bookings(id) ON DELETE CASCADE,
  guest_index integer NOT NULL DEFAULT 1,
  guest_name text,
  starter text,
  main_course text,
  dessert text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (booking_id, guest_index)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.special_booking_meals TO authenticated;
GRANT ALL ON public.special_booking_meals TO service_role;

ALTER TABLE public.special_booking_meals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view meal choices" ON public.special_booking_meals
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff can insert meal choices" ON public.special_booking_meals
  FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Staff can update meal choices" ON public.special_booking_meals
  FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Admins can delete meal choices" ON public.special_booking_meals
  FOR DELETE TO authenticated USING (public.has_admin_privileges(auth.uid()));

CREATE OR REPLACE FUNCTION public.touch_special_booking_meals_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_special_booking_meals_updated_at
BEFORE UPDATE ON public.special_booking_meals
FOR EACH ROW EXECUTE FUNCTION public.touch_special_booking_meals_updated_at();