
-- Table to store bottles per reservation
CREATE TABLE public.reservation_bottles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reservation_id UUID NOT NULL REFERENCES public.reservations(id) ON DELETE CASCADE,
  bottle_type TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.reservation_bottles ENABLE ROW LEVEL SECURITY;

-- Staff can read bottles
CREATE POLICY "Staff can read bottles"
ON public.reservation_bottles
FOR SELECT
USING (is_staff(auth.uid()));

-- Admins can insert bottles
CREATE POLICY "Admins can insert bottles"
ON public.reservation_bottles
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Admins can delete bottles
CREATE POLICY "Admins can delete bottles"
ON public.reservation_bottles
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));
