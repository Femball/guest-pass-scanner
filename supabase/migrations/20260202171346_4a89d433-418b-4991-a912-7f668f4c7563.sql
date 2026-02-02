-- =============================================
-- Fix: Block anonymous access to reservations table
-- =============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Staff can read reservations" ON public.reservations;
DROP POLICY IF EXISTS "Staff can update reservations for validation" ON public.reservations;
DROP POLICY IF EXISTS "Admins can insert reservations" ON public.reservations;
DROP POLICY IF EXISTS "Admins can delete reservations" ON public.reservations;

-- Recreate policies with explicit auth.uid() IS NOT NULL check
CREATE POLICY "Staff can read reservations" 
ON public.reservations 
FOR SELECT 
TO authenticated
USING (is_staff(auth.uid()));

CREATE POLICY "Staff can update reservations for validation" 
ON public.reservations 
FOR UPDATE 
TO authenticated
USING (is_staff(auth.uid()))
WITH CHECK (is_staff(auth.uid()));

CREATE POLICY "Admins can insert reservations" 
ON public.reservations 
FOR INSERT 
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete reservations" 
ON public.reservations 
FOR DELETE 
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- =============================================
-- Fix: Block anonymous access to user_roles table
-- =============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can delete roles" ON public.user_roles;

-- Recreate policies with TO authenticated clause
CREATE POLICY "Users can view their own roles" 
ON public.user_roles 
FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles" 
ON public.user_roles 
FOR SELECT 
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert roles" 
ON public.user_roles 
FOR INSERT 
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete roles" 
ON public.user_roles 
FOR DELETE 
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));