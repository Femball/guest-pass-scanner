CREATE TABLE public.special_event_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.special_events(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT 'Rappel',
  message text NOT NULL,
  scheduled_for timestamptz NOT NULL,
  booking_ids uuid[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending',
  sent_count integer NOT NULL DEFAULT 0,
  sent_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT special_event_reminders_status_check CHECK (status IN ('pending','sent','cancelled')),
  CONSTRAINT special_event_reminders_message_len CHECK (char_length(message) BETWEEN 1 AND 1000)
);

CREATE INDEX idx_special_event_reminders_event ON public.special_event_reminders(event_id, scheduled_for);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.special_event_reminders TO authenticated;
GRANT ALL ON public.special_event_reminders TO service_role;

ALTER TABLE public.special_event_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view special event reminders" ON public.special_event_reminders FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Admins can insert special event reminders" ON public.special_event_reminders FOR INSERT TO authenticated WITH CHECK (public.has_admin_privileges(auth.uid()));
CREATE POLICY "Admins can update special event reminders" ON public.special_event_reminders FOR UPDATE TO authenticated USING (public.has_admin_privileges(auth.uid())) WITH CHECK (public.has_admin_privileges(auth.uid()));
CREATE POLICY "Admins can delete special event reminders" ON public.special_event_reminders FOR DELETE TO authenticated USING (public.has_admin_privileges(auth.uid()));

CREATE TRIGGER special_event_reminders_touch BEFORE UPDATE ON public.special_event_reminders
FOR EACH ROW EXECUTE FUNCTION public.touch_clients_updated_at();