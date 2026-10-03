import { get, set, del } from 'idb-keyval';

export interface PendingValidation {
  id: string;
  type: 'ticket' | 'flyer' | 'special_checkin' | 'special_seat';
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

export interface CachedSpecialBooking {
  id: string;
  qr_code: string;
  guest_names: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  number_of_persons: number;
  seat_rows: string | null;
  seat_numbers: string | null;
  validated_at: string | null;
  seated_at: string | null;
  event_title: string;
  event_date: string;
}

interface CachePayload {
  reservations: CachedReservation[];
  flyers: CachedFlyer[];
  specials?: CachedSpecialBooking[];
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

export const findSpecialByQr = (cache: CachePayload | undefined, qrCode: string) =>
  cache?.specials?.find((b) => b.qr_code.toUpperCase() === qrCode.toUpperCase());

const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/** Recherche locale (hors-ligne) : chaque mot saisi doit apparaître dans le nom, le téléphone ou le code. */
export const searchSpecials = (cache: CachePayload | undefined, query: string) => {
  const words = norm(query).split(/\s+/).filter((w) => w.length > 1);
  if (!words.length) return [];
  return (cache?.specials ?? []).filter((b) => {
    const hay = norm([b.guest_names, b.first_name, b.last_name, b.qr_code].filter(Boolean).join(' '));
    const tel = (b.phone ?? '').replace(/\D/g, '');
    return words.every((w) => hay.includes(w) || (/^\d+$/.test(w) && tel.includes(w)));
  }).slice(0, 5);
};

/** Met à jour localement une réservation cabaret (entrée / placement hors-ligne). */
export const patchCachedSpecial = async (id: string, patch: Partial<CachedSpecialBooking>) => {
  const cache = await loadCache();
  if (!cache?.specials) return;
  await saveCache({ ...cache, specials: cache.specials.map((b) => (b.id === id ? { ...b, ...patch } : b)) });
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
