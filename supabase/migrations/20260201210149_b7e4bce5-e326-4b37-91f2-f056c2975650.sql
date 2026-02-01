-- Table pour stocker les réservations avec QR codes
CREATE TABLE public.reservations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_name TEXT NOT NULL,
  client_email TEXT,
  qr_code TEXT NOT NULL UNIQUE,
  is_validated BOOLEAN NOT NULL DEFAULT false,
  validated_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index pour recherche rapide par QR code
CREATE INDEX idx_reservations_qr_code ON public.reservations(qr_code);

-- Activer RLS
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;

-- Politique pour permettre la lecture publique (agents de sécurité)
CREATE POLICY "Allow public read access" 
ON public.reservations 
FOR SELECT 
USING (true);

-- Politique pour permettre la mise à jour publique (validation du ticket)
CREATE POLICY "Allow public update for validation" 
ON public.reservations 
FOR UPDATE 
USING (true)
WITH CHECK (true);

-- Politique pour permettre l'insertion publique (création de réservations)
CREATE POLICY "Allow public insert" 
ON public.reservations 
FOR INSERT 
WITH CHECK (true);