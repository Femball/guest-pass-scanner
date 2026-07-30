export interface Reservation {
  id: string;
  client_name: string;
  client_email: string | null;
  client_phone?: string | null;
  qr_code: string;
  is_validated: boolean;
  validated_at: string | null;
  created_at: string;
  number_of_persons: number;
  event_date: string;
  amount: number | null;
  payment_method: string | null;
  payment_status: string | null;
  sumup_checkout_id: string | null;
}

export interface PendingSms {
  phone: string;
  body: string;
  url: string;
  fallbackUrl: string;
  recipientOnlyUrl: string;
  isIOS: boolean;
  qrCodes: { label: string; code: string }[];
}

export interface ClientRecord {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  reservation_count: number;
  first_seen_at: string;
  last_seen_at: string;
}

export interface BottleWithReservation {
  bottle_type: string;
  quantity: number;
  reservation_id: string;
  reservations: { client_name: string; event_date: string } | null;
}

export interface FlyerInvitation {
  id: string;
  label: string;
  event_date: string;
  qr_code: string;
  scan_count: number;
  created_at: string;
}
