-- Add DELETE policy for reservations
CREATE POLICY "Allow public delete"
ON public.reservations
FOR DELETE
USING (true);

-- Add number_of_persons column
ALTER TABLE public.reservations
ADD COLUMN number_of_persons integer NOT NULL DEFAULT 1;