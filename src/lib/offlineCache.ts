import { get, set, del } from 'idb-keyval';

export interface CachedReservation {
  id: string;
  qr_code: string;
  client_name: string;
  client_email: string | null;
  number_of_persons: number;
  event_date: string;
  is_validated: boolean;
  validated_at: string | null;
  payment_method: string | null;
  payment_status: string | null;
  amount: number | null;
}

export interface CachedFlyer {
  id: string;
  qr_code: string;
  label: string;
  event_date: string;
  scan_count: number;
}

interface CachePayload {
  reservations: CachedReservation[];
  flyers: CachedFlyer[];
  syncedAt: string;
  eventDate: string;
}

const KEY = 'laccess:offline-cache:v1';

export const saveCache = (payload: CachePayload) => set(KEY, payload);

export const loadCache = async (): Promise<CachePayload | undefined> => {
  try {
    return (await get<CachePayload>(KEY)) ?? undefined;
  } catch {
    return undefined;
  }
};

export const clearCache = () => del(KEY);

export const findReservationByQr = (
  cache: CachePayload | undefined,
  qrCode: string,
): CachedReservation | undefined => {
  if (!cache) return undefined;
  const upper = qrCode.toUpperCase();
  return cache.reservations.find((r) => r.qr_code.toUpperCase() === upper);
};

export const findFlyerByQr = (
  cache: CachePayload | undefined,
  qrCode: string,
): CachedFlyer | undefined => {
  if (!cache) return undefined;
  const upper = qrCode.toUpperCase();
  return cache.flyers.find((f) => f.qr_code.toUpperCase() === upper);
};
