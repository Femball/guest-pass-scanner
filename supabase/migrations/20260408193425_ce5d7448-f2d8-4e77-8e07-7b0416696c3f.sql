
-- Table for real-time scan notifications
CREATE TABLE public.scan_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_name TEXT NOT NULL,
  event_date DATE NOT NULL DEFAULT CURRENT_DATE,
  scanned_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.scan_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read scan notifications"
ON public.scan_notifications FOR SELECT TO authenticated
USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff can insert scan notifications"
ON public.scan_notifications FOR INSERT TO authenticated
WITH CHECK (public.is_staff(auth.uid()));

-- Enable realtime for scan_notifications only (non-sensitive data)
ALTER PUBLICATION supabase_realtime ADD TABLE public.scan_notifications;
