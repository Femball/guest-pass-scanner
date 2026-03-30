
-- Fix reservation_bottles policies: change from public to authenticated
DROP POLICY "Admins can delete bottles" ON public.reservation_bottles;
DROP POLICY "Admins can insert bottles" ON public.reservation_bottles;
DROP POLICY "Staff can read bottles" ON public.reservation_bottles;

CREATE POLICY "Admins can delete bottles" ON public.reservation_bottles FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert bottles" ON public.reservation_bottles FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Staff can read bottles" ON public.reservation_bottles FOR SELECT TO authenticated USING (is_staff(auth.uid()));

-- Fix Realtime exposure: remove reservations from realtime publication
-- Only flyer tables need realtime
ALTER PUBLICATION supabase_realtime DROP TABLE public.reservations;
