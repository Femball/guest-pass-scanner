
-- Table for flyer invitations (one QR code per flyer campaign)
CREATE TABLE public.flyer_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  event_date date NOT NULL DEFAULT CURRENT_DATE,
  qr_code text NOT NULL UNIQUE,
  scan_count integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Table to track individual scans
CREATE TABLE public.flyer_scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flyer_invitation_id uuid NOT NULL REFERENCES public.flyer_invitations(id) ON DELETE CASCADE,
  scanned_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.flyer_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flyer_scans ENABLE ROW LEVEL SECURITY;

-- RLS policies for flyer_invitations
CREATE POLICY "Admins can manage flyer invitations" ON public.flyer_invitations FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Staff can read flyer invitations" ON public.flyer_invitations FOR SELECT TO authenticated USING (is_staff(auth.uid()));

-- RLS policies for flyer_scans
CREATE POLICY "Staff can manage flyer scans" ON public.flyer_scans FOR ALL TO authenticated USING (is_staff(auth.uid())) WITH CHECK (is_staff(auth.uid()));

-- Enable realtime for flyer_scans
ALTER PUBLICATION supabase_realtime ADD TABLE public.flyer_scans;
ALTER PUBLICATION supabase_realtime ADD TABLE public.flyer_invitations;
