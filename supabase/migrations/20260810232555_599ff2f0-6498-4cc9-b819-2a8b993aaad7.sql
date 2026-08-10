ALTER TABLE public.special_bookings
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS number_of_persons integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS seat_rows text,
  ADD COLUMN IF NOT EXISTS seat_numbers text;