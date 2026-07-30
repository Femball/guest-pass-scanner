import QRCode from 'qrcode';
import type { PendingSms } from '@/types/admin';
import laccessMark from '@/assets/laccess-mark.png';

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

/** Draws the L'Access logo in the middle of a QR code data URL. */
const withCenterLogo = (qrDataUrl: string, size = 600): Promise<Blob> =>
  new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return reject(new Error('canvas unsupported'));

    const qrImg = new Image();
    qrImg.onload = () => {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(qrImg, 0, 0, size, size);

      const logo = new Image();
      logo.onload = () => {
        const logoSize = Math.round(size * 0.22);
        const pad = Math.round(logoSize * 0.1);
        const x = Math.round((size - logoSize) / 2);
        const y = Math.round((size - logoSize) / 2);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x - pad, y - pad, logoSize + pad * 2, logoSize + pad * 2);
        ctx.drawImage(logo, x, y, logoSize, logoSize);
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png');
      };
      logo.onerror = () =>
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png');
      logo.src = laccessMark;
    };
    qrImg.onerror = () => reject(new Error('qr load failed'));
    qrImg.src = qrDataUrl;
  });

/** Generates QR PNG files and opens the native share sheet (iOS Messages, WhatsApp, etc.). */
export const shareQrFiles = async (payload: PendingSms): Promise<ShareQrResult> => {
  if (!payload.qrCodes.length) return { ok: false, reason: 'no-qr' };
  try {
    const files: File[] = [];
    for (const qr of payload.qrCodes) {
      const dataUrl = await QRCode.toDataURL(qr.code, { width: 600, margin: 2, errorCorrectionLevel: 'H' });
      let blob: Blob;
      try {
        blob = await withCenterLogo(dataUrl);
      } catch {
        blob = await (await fetch(dataUrl)).blob();
      }
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
