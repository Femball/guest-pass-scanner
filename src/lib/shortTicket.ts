export const PUBLIC_BASE_URL = 'https://laccess.lovable.app';

/**
 * Turns a full QR code ("TICKET-<uuid>" / "SOIREE-<uuid>") into a compact
 * 33-char id ("r" | "s" + uuid hex without dashes) for short SMS links.
 */
export const toShortTicketId = (qrCode: string): string | null => {
  const match = /^(TICKET|SOIREE)-([0-9a-fA-F-]{36})$/.exec(qrCode.trim());
  if (!match) return null;
  const prefix = match[1] === 'TICKET' ? 'r' : 's';
  return prefix + match[2].replace(/-/g, '').toLowerCase();
};

/** Short public ticket URL, or the legacy long URL if the code is not a UUID code. */
export const shortTicketUrl = (qrCode: string): string => {
  const short = toShortTicketId(qrCode);
  return short
    ? `${PUBLIC_BASE_URL}/t/${short}`
    : `${PUBLIC_BASE_URL}/ticket/${encodeURIComponent(qrCode)}`;
};
