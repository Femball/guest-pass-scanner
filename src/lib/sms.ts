import QRCode from 'qrcode';
import type { PendingSms } from '@/types/admin';

/** Single source of truth for iOS detection (iPhone/iPad, including iPadOS desktop UA). */
export const isIOSDevice = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
};

/**
 * Builds the native SMS deep links for a recipient.
 * Navigation to `url` MUST happen synchronously inside a user gesture,
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
  const standardUrl = `sms:${phoneClean}?body=${encodedBody}`;
  const iosUrl = `sms:${phoneClean}&body=${encodedBody}`;
  const iosFallbackUrl = `sms://open?addresses=${encodeURIComponent(phoneClean)}&body=${encodedBody}`;

  return {
    phone: phoneClean,
    body,
    url: isIOS ? iosUrl : standardUrl,
    fallbackUrl: isIOS ? iosFallbackUrl : `sms:${phoneClean}${separator}body=${encodedBody}`,
    recipientOnlyUrl: `sms:${phoneClean}`,
    isIOS,
    qrCodes,
  };
};

export type ShareQrResult =
  | { ok: true }
  | { ok: false; reason: 'no-qr' | 'unsupported' | 'aborted' | 'error' };

/** Generates QR PNG files and opens the native share sheet (iOS Messages, WhatsApp, etc.). */
export const shareQrFiles = async (payload: PendingSms): Promise<ShareQrResult> => {
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
    console.error('shareQrFiles error', err);
    return { ok: false, reason: 'error' };
  }
};
