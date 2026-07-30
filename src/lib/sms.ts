import QRCode from 'qrcode';
import type { PendingSms } from '@/types/admin';

/** Single source of truth for iOS detection (Safari iPhone/iPad, including iPadOS desktop UA). */
export const isIOSDevice = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
};

/**
 * Builds the native SMS deep links for a recipient.
 * The returned URL must be navigated to synchronously inside a user gesture,
 * otherwise iOS/Android silently block the sms: scheme.
 */
export const buildSmsPayload = (
  phone: string,
  body: string,
  qrCodes: { label: string; code: string }[] = [],
): PendingSms | null => {
  if (!phone) return null;
  const phoneClean = phone.replace(/[^0-9+]/g, '');
  if (!phoneClean) return null;

  const isIOS = isIOSDevice();
  // iOS uses '&', Android uses '?', others fall back to '?'
  const separator = isIOS ? '&' : '?';
  const encodedBody = encodeURIComponent(body);

  return {
    phone: phoneClean,
    body,
    url: isIOS ? `sms:${phoneClean}&body=${encodedBody}` : `sms:${phoneClean}?body=${encodedBody}`,
    fallbackUrl: isIOS
      ? `sms://open?addresses=${encodeURIComponent(phoneClean)}&body=${encodedBody}`
      : `sms:${phoneClean}${separator}body=${encodedBody}`,
    recipientOnlyUrl: `sms:${phoneClean}`,
    isIOS,
    qrCodes,
  };
};

/** Builds a simple sms: link (recipient + body) for one-off shares. */
export const buildSmsLink = (phone: string, body: string): string => {
  const phoneClean = phone.replace(/[^0-9+]/g, '');
  const separator = isIOSDevice() ? '&' : '?';
  return `sms:${phoneClean}${separator}body=${encodeURIComponent(body)}`;
};

/** Generates QR PNG files and opens the native share sheet (iOS Messages, WhatsApp, ...). */
export const shareQrViaNativeSheet = async (payload: PendingSms): Promise<
  { ok: true } | { ok: false; reason: 'no-qr' | 'unsupported' | 'aborted' | 'error' }
> => {
  if (!payload.qrCodes.length) return { ok: false, reason: 'no-qr' };
  try {
    const files: File[] = [];
    for (const qr of payload.qrCodes) {
      const dataUrl = await QRCode.toDataURL(qr.code, { width: 600, margin: 2, errorCorrectionLevel: 'H' });
      const blob = await (await fetch(dataUrl)).blob();
      const safeLabel = qr.label.replace(/[^a-zA-Z0-9_-]/g, '_') || 'qr';
      files.push(new File([blob], `${safeLabel}.png`, { type: 'image/png' }));
    }
    const shareData: ShareData = { files, text: payload.body, title: "L'Access — Votre ticket" };
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    if (!nav.canShare || !nav.canShare(shareData) || !navigator.share) {
      return { ok: false, reason: 'unsupported' };
    }
    await navigator.share(shareData);
    return { ok: true };
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') return { ok: false, reason: 'aborted' };
    return { ok: false, reason: 'error' };
  }
};
