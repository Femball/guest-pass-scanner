import { useCallback, useEffect, useState } from 'react';

export interface ScanPreferences {
  sound: boolean;
  vibration: boolean;
}

const STORAGE_KEY = 'laccess.scan.preferences';
const EVENT = 'laccess-scan-preferences';

const DEFAULTS: ScanPreferences = { sound: true, vibration: true };

export const readScanPreferences = (): ScanPreferences => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw);
    return {
      sound: typeof parsed?.sound === 'boolean' ? parsed.sound : DEFAULTS.sound,
      vibration: typeof parsed?.vibration === 'boolean' ? parsed.vibration : DEFAULTS.vibration,
    };
  } catch {
    return DEFAULTS;
  }
};

export const useScanPreferences = () => {
  const [preferences, setPreferences] = useState<ScanPreferences>(() => readScanPreferences());

  useEffect(() => {
    const sync = () => setPreferences(readScanPreferences());
    window.addEventListener(EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const update = useCallback((partial: Partial<ScanPreferences>) => {
    const next = { ...readScanPreferences(), ...partial };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* stockage indisponible : on garde la valeur en mémoire */
    }
    setPreferences(next);
    window.dispatchEvent(new Event(EVENT));
  }, []);

  const vibrate = useCallback((pattern: number | number[]) => {
    if (!readScanPreferences().vibration) return;
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(pattern);
      } catch {
        /* vibration non supportée */
      }
    }
  }, []);

  return {
    preferences,
    setSound: (sound: boolean) => update({ sound }),
    setVibration: (vibration: boolean) => update({ vibration }),
    vibrate,
  };
};
