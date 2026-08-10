import QRCode from 'qrcode';
import laccessLogo from '@/assets/laccess-logo.jpeg.asset.json';
import francaisLogo from '@/assets/le-francais-logo.png.asset.json';

export interface SpecialTicketData {
  title: string;
  dateLabel: string;
  timeLabel: string;
  guests: string;
  seats?: string | null;
  price: string | null;
  code: string;
  posterUrl: string | null;
  address?: string;
}

const GOLD = '#D4B26A';
const GOLD_SOFT = '#E8D7A8';
const W = 1080;
const H = 1750;

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image load failed'));
    img.src = src;
  });

const drawCover = (ctx: CanvasRenderingContext2D, img: HTMLImageElement) => {
  const ratio = Math.max(W / img.width, H / img.height);
  const w = img.width * ratio;
  const h = img.height * ratio;
  ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
};

const roundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
};

const fitText = (
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  startSize: number,
  font: (size: number) => string,
  minSize = 24,
) => {
  let size = startSize;
  ctx.font = font(size);
  while (ctx.measureText(text).width > maxWidth && size > minSize) {
    size -= 2;
    ctx.font = font(size);
  }
  return size;
};

const wrapLines = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number) => {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines;
};

const serif = (size: number, weight = 400) => `${weight} ${size}px Lora, Georgia, serif`;
const sans = (size: number, weight = 500) => `${weight} ${size}px "Work Sans", Helvetica, Arial, sans-serif`;

const spacedText = (
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  y: number,
  spacing: number,
) => {
  const chars = [...text];
  const total = chars.reduce((acc, c) => acc + ctx.measureText(c).width + spacing, -spacing);
  let x = cx - total / 2;
  for (const c of chars) {
    ctx.fillText(c, x + ctx.measureText(c).width / 2, y);
    x += ctx.measureText(c).width + spacing;
  }
};

/** Renders a refined gold-on-poster ticket as a PNG blob. */
export const renderSpecialTicket = async (data: SpecialTicketData): Promise<Blob> => {
  if (document.fonts?.ready) {
    try { await document.fonts.ready; } catch { /* ignore */ }
  }

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas unsupported');

  // Background
  ctx.fillStyle = '#0B0B0C';
  ctx.fillRect(0, 0, W, H);
  if (data.posterUrl) {
    try {
      const poster = await loadImage(data.posterUrl);
      drawCover(ctx, poster);
    } catch { /* keep plain background */ }
  }

  // Darkening scrim so gold text always reads
  const scrim = ctx.createLinearGradient(0, 0, 0, H);
  scrim.addColorStop(0, 'rgba(6,6,8,0.86)');
  scrim.addColorStop(0.38, 'rgba(6,6,8,0.58)');
  scrim.addColorStop(0.62, 'rgba(6,6,8,0.72)');
  scrim.addColorStop(1, 'rgba(6,6,8,0.94)');
  ctx.fillStyle = scrim;
  ctx.fillRect(0, 0, W, H);

  // Double gold frame
  ctx.strokeStyle = 'rgba(212,178,106,0.85)';
  ctx.lineWidth = 3;
  ctx.strokeRect(46, 46, W - 92, H - 92);
  ctx.strokeStyle = 'rgba(212,178,106,0.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(62, 62, W - 124, H - 124);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const cx = W / 2;
  const maxW = W - 220;

  // Logos band (L'Access + Le Français)
  const logoH = 108;
  const drawLogo = async (src: string, centerX: number, centerY: number, round: boolean) => {
    try {
      const img = await loadImage(src);
      const w = (img.width / img.height) * logoH;
      const x = centerX - w / 2;
      const y0 = centerY - logoH / 2;
      ctx.save();
      if (round) {
        roundRect(ctx, x, y0, w, logoH, 18);
        ctx.clip();
      }
      ctx.drawImage(img, x, y0, w, logoH);
      ctx.restore();
    } catch { /* ignore missing logo */ }
  };
  await drawLogo(laccessLogo.url, cx - 200, 168, true);
  await drawLogo(francaisLogo.url, cx + 200, 168, false);

  // Overline
  ctx.fillStyle = GOLD_SOFT;
  ctx.font = sans(26, 600);
  spacedText(ctx, "L'ACCESS", cx, 268, 10);
  ctx.font = sans(20, 400);
  ctx.fillStyle = 'rgba(232,215,168,0.65)';
  spacedText(ctx, 'SOIRÉE SPÉCIALE', cx, 308, 7);

  // Title
  ctx.fillStyle = GOLD;
  const titleSize = fitText(ctx, data.title.toUpperCase(), maxW, 78, (s) => serif(s, 600), 34);
  ctx.font = serif(titleSize, 600);
  const titleLines = wrapLines(ctx, data.title.toUpperCase(), maxW).slice(0, 2);
  let y = 402;
  titleLines.forEach((line, i) => {
    ctx.fillText(line, cx, y + i * (titleSize * 1.18));
  });
  y += (titleLines.length - 1) * (titleSize * 1.18) + titleSize * 0.75 + 30;

  // Ornament
  const ornY = y;
  ctx.strokeStyle = 'rgba(212,178,106,0.6)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx - 200, ornY);
  ctx.lineTo(cx - 26, ornY);
  ctx.moveTo(cx + 26, ornY);
  ctx.lineTo(cx + 200, ornY);
  ctx.stroke();
  ctx.fillStyle = GOLD;
  ctx.save();
  ctx.translate(cx, ornY);
  ctx.rotate(Math.PI / 4);
  ctx.fillRect(-7, -7, 14, 14);
  ctx.restore();

  // Date & time
  y = ornY + 62;
  ctx.fillStyle = GOLD_SOFT;
  ctx.font = sans(30, 500);
  spacedText(ctx, data.dateLabel.toUpperCase(), cx, y, 4);
  y += 46;
  ctx.font = sans(26, 400);
  ctx.fillStyle = 'rgba(232,215,168,0.8)';
  spacedText(ctx, data.timeLabel.toUpperCase(), cx, y, 4);

  // QR panel
  const qrDataUrl = await QRCode.toDataURL(data.code, {
    width: 900,
    margin: 1,
    errorCorrectionLevel: 'H',
    color: { dark: '#0B0B0C', light: '#FFFFFF' },
  });
  const qrImg = await loadImage(qrDataUrl);
  const panel = 500;
  const panelX = cx - panel / 2;
  const panelY = y + 60;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = 40;
  ctx.fillStyle = '#FFFFFF';
  roundRect(ctx, panelX, panelY, panel, panel, 26);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = 'rgba(212,178,106,0.9)';
  ctx.lineWidth = 3;
  roundRect(ctx, panelX - 12, panelY - 12, panel + 24, panel + 24, 34);
  ctx.stroke();
  const qrPad = 34;
  ctx.drawImage(qrImg, panelX + qrPad, panelY + qrPad, panel - qrPad * 2, panel - qrPad * 2);

  // Guests
  y = panelY + panel + 96;
  ctx.fillStyle = 'rgba(232,215,168,0.6)';
  ctx.font = sans(20, 500);
  spacedText(ctx, 'AU NOM DE', cx, y, 6);
  y += 48;
  ctx.fillStyle = GOLD;
  const guestSize = fitText(ctx, data.guests, maxW, 48, (s) => serif(s, 600), 26);
  ctx.font = serif(guestSize, 600);
  const guestLines = wrapLines(ctx, data.guests, maxW).slice(0, 3);
  guestLines.forEach((line, i) => ctx.fillText(line, cx, y + i * (guestSize * 1.25)));
  y += (guestLines.length - 1) * (guestSize * 1.25) + 70;

  // Price
  if (data.price) {
    ctx.strokeStyle = 'rgba(212,178,106,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - 150, y - 26);
    ctx.lineTo(cx + 150, y - 26);
    ctx.stroke();
    ctx.fillStyle = 'rgba(232,215,168,0.6)';
    ctx.font = sans(20, 500);
    spacedText(ctx, 'RÈGLEMENT', cx, y + 16, 6);
    ctx.fillStyle = GOLD_SOFT;
    ctx.font = serif(40, 600);
    ctx.fillText(data.price, cx, y + 66);
  }

  // Footer code
  ctx.fillStyle = 'rgba(232,215,168,0.45)';
  ctx.font = sans(18, 400);
  spacedText(ctx, data.code, cx, H - 100, 2);

  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png');
  });
};

export const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
};

export const shareTicketBlob = async (blob: Blob, filename: string, text: string) => {
  const file = new File([blob], filename, { type: 'image/png' });
  const shareData: ShareData = { files: [file], text, title: "L'Access — Invitation" };
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare?.(shareData) && navigator.share) {
    await navigator.share(shareData);
    return true;
  }
  return false;
};