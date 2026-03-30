
-- 1. Add explicit admin-only UPDATE policy on user_roles to prevent privilege escalation
CREATE POLICY "Only admins can update roles" ON public.user_roles FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- 2. Add admin-only UPDATE policy on reservation_bottles
CREATE POLICY "Admins can update bottles" ON public.reservation_bottles FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- 3. Remove flyer tables from realtime publication to prevent unauthorized subscriptions
ALTER PUBLICATION supabase_realtime DROP TABLE public.flyer_invitations;
ALTER PUBLICATION supabase_realtime DROP TABLE public.flyer_scans;
