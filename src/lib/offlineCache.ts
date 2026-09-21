import { get, set, del } from 'idb-keyval';

export interface PendingValidation {
  id: string;
  type: 'ticket' | 'flyer';
  targetId: string;
  qrCode: string;
  clientName: string;
  scannedAt: string;
}

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

const QUEUE_KEY = 'laccess:offline-queue:v1';

export const loadQueue = async (): Promise<PendingValidation[]> => {
  try {
    return (await get<PendingValidation[]>(QUEUE_KEY)) ?? [];
  } catch {
    return [];
  }
};

export const saveQueue = (queue: PendingValidation[]) => set(QUEUE_KEY, queue);

export const enqueueValidation = async (entry: PendingValidation) => {
  const queue = await loadQueue();
  if (queue.some((q) => q.qrCode.toUpperCase() === entry.qrCode.toUpperCase() && q.type === 'ticket')) {
    return queue;
  }
  const next = [...queue, entry];
  await saveQueue(next);
  return next;
};

export const isQueued = (queue: PendingValidation[], qrCode: string) =>
  queue.some((q) => q.qrCode.toUpperCase() === qrCode.toUpperCase());

/** Marque localement une réservation comme validée pour refléter le scan hors-ligne. */
export const markCachedValidated = async (qrCode: string, at: string) => {
  const cache = await loadCache();
  if (!cache) return;
  const upper = qrCode.toUpperCase();
  const reservations = cache.reservations.map((r) =>
    r.qr_code.toUpperCase() === upper ? { ...r, is_validated: true, validated_at: at } : r,
  );
  await saveCache({ ...cache, reservations });
};
