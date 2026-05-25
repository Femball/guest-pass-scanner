
DO $$
DECLARE
  fn text;
  fns text[] := ARRAY[
    'public.notify_push_on_scan()',
    'public.move_to_dlq(text, text, bigint, jsonb)',
    'public.validate_bottle_input()',
    'public.read_email_batch(text, integer, integer)',
    'public.create_scan_notification_from_reservation()',
    'public.delete_email(text, bigint)',
    'public.create_scan_notification_from_flyer_scan()',
    'public.purge_old_data()',
    'public.validate_payment_input()',
    'public.is_staff(uuid)',
    'public.has_role(uuid, public.app_role)',
    'public.prevent_role_self_escalation()',
    'public.validate_reservation_input()',
    'public.detect_duplicate_scan()',
    'public.has_admin_privileges(uuid)',
    'public.enqueue_email(text, jsonb)'
  ];
BEGIN
  FOREACH fn IN ARRAY fns LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn);
  END LOOP;
END $$;
