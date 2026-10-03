DROP TRIGGER IF EXISTS trg_prevent_duplicate_special_seats ON public.special_bookings;
COMMENT ON FUNCTION public.prevent_duplicate_special_seats() IS 'DEPRECATED: duplicate seat assignment is now allowed; trigger dropped.';
COMMENT ON FUNCTION public.special_booking_seat_keys(text, text) IS 'DEPRECATED: no longer used to prevent duplicate seats.';