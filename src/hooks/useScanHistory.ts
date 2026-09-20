import { useCallback, useEffect, useState } from 'react';

export interface ScanHistoryEntry {
  id: string;
  at: string; // ISO
  isValid: boolean;
  clientName?: string;
  message?: string;
}

const STORAGE_KEY = 'laccess.scan.history';
const EVENT = 'laccess-scan-history';
const MAX_ENTRIES = 25;

const read = (): ScanHistoryEntry[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ScanHistoryEntry[]).slice(0, MAX_ENTRIES) : [];
  } catch {
    return [];
  }
};

const write = (entries: ScanHistoryEntry[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
  } catch {
    /* stockage indisponible */
  }
  window.dispatchEvent(new Event(EVENT));
};

export const useScanHistory = () => {
  const [history, setHistory] = useState<ScanHistoryEntry[]>(() => read());

  useEffect(() => {
    const sync = () => setHistory(read());
    window.addEventListener(EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const addEntry = useCallback((entry: Omit<ScanHistoryEntry, 'id' | 'at'>) => {
    const next: ScanHistoryEntry[] = [
      {
        ...entry,
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        at: new Date().toISOString(),
      },
      ...read(),
    ].slice(0, MAX_ENTRIES);
    setHistory(next);
    write(next);
  }, []);

  const clear = useCallback(() => {
    setHistory([]);
    write([]);
  }, []);

  return { history, addEntry, clear };
};
