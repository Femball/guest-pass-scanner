-- Update is_staff to include supervisor
CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin', 'agent', 'supervisor')
  )
$$;

-- Helper: admin OR supervisor (for management actions excluding user/role management)
CREATE OR REPLACE FUNCTION public.has_admin_privileges(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin', 'supervisor')
  )
$$;

-- Reservations: allow supervisors to insert/delete (staff already covers select/update)
DROP POLICY IF EXISTS "Admins can insert reservations" ON public.reservations;
CREATE POLICY "Admins and supervisors can insert reservations"
ON public.reservations
FOR INSERT
TO authenticated
WITH CHECK (public.has_admin_privileges(auth.uid()));

DROP POLICY IF EXISTS "Admins can delete reservations" ON public.reservations;
CREATE POLICY "Admins and supervisors can delete reservations"
ON public.reservations
FOR DELETE
TO authenticated
USING (public.has_admin_privileges(auth.uid()));

-- Reservation bottles
DROP POLICY IF EXISTS "Admins can insert bottles" ON public.reservation_bottles;
CREATE POLICY "Admins and supervisors can insert bottles"
ON public.reservation_bottles
FOR INSERT
TO authenticated
WITH CHECK (public.has_admin_privileges(auth.uid()));

DROP POLICY IF EXISTS "Admins can update bottles" ON public.reservation_bottles;
CREATE POLICY "Admins and supervisors can update bottles"
ON public.reservation_bottles
FOR UPDATE
TO authenticated
USING (public.has_admin_privileges(auth.uid()))
WITH CHECK (public.has_admin_privileges(auth.uid()));

DROP POLICY IF EXISTS "Admins can delete bottles" ON public.reservation_bottles;
CREATE POLICY "Admins and supervisors can delete bottles"
ON public.reservation_bottles
FOR DELETE
TO authenticated
USING (public.has_admin_privileges(auth.uid()));

-- Flyer invitations
DROP POLICY IF EXISTS "Admins can manage flyer invitations" ON public.flyer_invitations;
CREATE POLICY "Admins and supervisors can manage flyer invitations"
ON public.flyer_invitations
FOR ALL
TO authenticated
USING (public.has_admin_privileges(auth.uid()))
WITH CHECK (public.has_admin_privileges(auth.uid()));
