
CREATE POLICY "Staff can read event posters" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'event-posters' AND public.is_staff(auth.uid()));
CREATE POLICY "Admins can upload event posters" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'event-posters' AND public.has_admin_privileges(auth.uid()));
CREATE POLICY "Admins can update event posters" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'event-posters' AND public.has_admin_privileges(auth.uid()));
CREATE POLICY "Admins can delete event posters" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'event-posters' AND public.has_admin_privileges(auth.uid()));
