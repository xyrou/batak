import { Card, RANK_LABELS, Suit, isRed, rankOf, suitOf } from '../engine/cards';

export const CARD_RATIO = 1.4; // yükseklik / genişlik

const RED = '#c0182b';
const BLACK = '#17171b';
const GOLD = '#b8913a';
const GOLD_LIGHT = '#e3c57a';

type Ctx = CanvasRenderingContext2D;

// ─── Renk şekilleri (birim kutu, merkez 0,0; y aşağı) ───────────────────

export function suitPath(ctx: Ctx, suit: Suit, x: number, y: number, size: number, flip = false) {
  ctx.save();
  ctx.translate(x, y);
  if (flip) ctx.rotate(Math.PI);
  ctx.scale(size, size);
  ctx.beginPath();
  switch (suit) {
    case 1: // kupa
      ctx.moveTo(0, 0.5);
      ctx.bezierCurveTo(-0.15, 0.32, -0.5, 0.12, -0.5, -0.15);
      ctx.bezierCurveTo(-0.5, -0.38, -0.33, -0.48, -0.24, -0.48);
      ctx.bezierCurveTo(-0.1, -0.48, -0.02, -0.4, 0, -0.27);
      ctx.bezierCurveTo(0.02, -0.4, 0.1, -0.48, 0.24, -0.48);
      ctx.bezierCurveTo(0.33, -0.48, 0.5, -0.38, 0.5, -0.15);
      ctx.bezierCurveTo(0.5, 0.12, 0.15, 0.32, 0, 0.5);
      ctx.fill();
      break;
    case 3: // karo
      ctx.moveTo(0, -0.5);
      ctx.quadraticCurveTo(0.13, -0.2, 0.4, 0);
      ctx.quadraticCurveTo(0.13, 0.2, 0, 0.5);
      ctx.quadraticCurveTo(-0.13, 0.2, -0.4, 0);
      ctx.quadraticCurveTo(-0.13, -0.2, 0, -0.5);
      ctx.fill();
      break;
    case 0: // maça
      ctx.moveTo(0, -0.5);
      ctx.bezierCurveTo(0.16, -0.3, 0.5, -0.12, 0.5, 0.12);
      ctx.bezierCurveTo(0.5, 0.32, 0.36, 0.4, 0.24, 0.4);
      ctx.bezierCurveTo(0.13, 0.4, 0.06, 0.34, 0.035, 0.26);
      ctx.bezierCurveTo(0.05, 0.4, 0.12, 0.47, 0.21, 0.5);
      ctx.lineTo(-0.21, 0.5);
      ctx.bezierCurveTo(-0.12, 0.47, -0.05, 0.4, -0.035, 0.26);
      ctx.bezierCurveTo(-0.06, 0.34, -0.13, 0.4, -0.24, 0.4);
      ctx.bezierCurveTo(-0.36, 0.4, -0.5, 0.32, -0.5, 0.12);
      ctx.bezierCurveTo(-0.5, -0.12, -0.16, -0.3, 0, -0.5);
      ctx.fill();
      break;
    case 2: // sinek
      ctx.arc(0, -0.25, 0.215, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(-0.255, 0.07, 0.215, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0.255, 0.07, 0.215, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, 0.02, 0.13, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-0.035, 0.05);
      ctx.bezierCurveTo(-0.04, 0.34, -0.12, 0.46, -0.21, 0.5);
      ctx.lineTo(0.21, 0.5);
      ctx.bezierCurveTo(0.12, 0.46, 0.04, 0.34, 0.035, 0.05);
      ctx.fill();
      break;
  }
  ctx.restore();
}

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

let noisePattern: HTMLCanvasElement | null = null;
function paperNoise(): HTMLCanvasElement {
  if (noisePattern) return noisePattern;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const img = g.createImageData(128, 128);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 120 + Math.random() * 60;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = Math.random() * 22;
  }
  g.putImageData(img, 0, 0);
  noisePattern = c;
  return c;
}

function cardBase(ctx: Ctx, W: number, H: number) {
  const r = W * 0.07;
  ctx.clearRect(0, 0, W, H);
  roundRect(ctx, 1, 1, W - 2, H - 2, r);
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, '#fffdf7');
  grad.addColorStop(1, '#f3ecdc');
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.save();
  ctx.clip();
  const pat = ctx.createPattern(paperNoise(), 'repeat');
  if (pat) {
    ctx.fillStyle = pat;
    ctx.fillRect(0, 0, W, H);
  }
  ctx.restore();
  roundRect(ctx, 1.5, 1.5, W - 3, H - 3, r);
  ctx.strokeStyle = 'rgba(80,60,30,0.35)';
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawIndex(ctx: Ctx, card: Card, W: number, H: number) {
  const suit = suitOf(card);
  const rank = rankOf(card);
  const color = isRed(suit) ? RED : BLACK;
  const label = RANK_LABELS[rank];
  for (const flip of [false, true]) {
    ctx.save();
    if (flip) {
      ctx.translate(W, H);
      ctx.rotate(Math.PI);
    }
    ctx.fillStyle = color;
    const fs = W * 0.19;
    ctx.font = `700 ${fs}px Rubik, "Segoe UI", Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    const cx = W * 0.115;
    const m = ctx.measureText(label);
    const maxW = W * 0.19;
    ctx.save();
    ctx.translate(cx, H * 0.155);
    if (m.width > maxW) ctx.scale(maxW / m.width, 1);
    ctx.fillText(label, 0, 0);
    ctx.restore();
    suitPath(ctx, suit, cx, H * 0.215, W * 0.115);
    ctx.restore();
  }
}

const PIPS: Record<number, [number, number][]> = {
  2: [[0.5, 0], [0.5, 1]],
  3: [[0.5, 0], [0.5, 0.5], [0.5, 1]],
  4: [[0, 0], [1, 0], [0, 1], [1, 1]],
  5: [[0, 0], [1, 0], [0.5, 0.5], [0, 1], [1, 1]],
  6: [[0, 0], [1, 0], [0, 0.5], [1, 0.5], [0, 1], [1, 1]],
  7: [[0, 0], [1, 0], [0.5, 0.25], [0, 0.5], [1, 0.5], [0, 1], [1, 1]],
  8: [[0, 0], [1, 0], [0.5, 0.25], [0, 0.5], [1, 0.5], [0.5, 0.75], [0, 1], [1, 1]],
  9: [[0, 0], [1, 0], [0, 1 / 3], [1, 1 / 3], [0.5, 0.5], [0, 2 / 3], [1, 2 / 3], [0, 1], [1, 1]],
  10: [[0, 0], [1, 0], [0.5, 1 / 6], [0, 1 / 3], [1, 1 / 3], [0, 2 / 3], [1, 2 / 3], [0.5, 5 / 6], [0, 1], [1, 1]],
};

function drawPips(ctx: Ctx, card: Card, W: number, H: number) {
  const suit = suitOf(card);
  const rank = rankOf(card);
  ctx.fillStyle = isRed(suit) ? RED : BLACK;
  const left = W * 0.3;
  const right = W * 0.7;
  const top = H * 0.2;
  const bottom = H * 0.8;
  const size = W * 0.2;
  for (const [px, py] of PIPS[rank]) {
    const x = left + (right - left) * px;
    const y = top + (bottom - top) * py;
    suitPath(ctx, suit, x, y, size, py > 0.5);
  }
}

function drawAce(ctx: Ctx, card: Card, W: number, H: number) {
  const suit = suitOf(card);
  const color = isRed(suit) ? RED : BLACK;
  ctx.fillStyle = color;
  if (suit === 0) {
    // Maça ası: süslü
    ctx.save();
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = W * 0.012;
    ctx.beginPath();
    ctx.ellipse(W / 2, H / 2, W * 0.3, W * 0.3, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = W * 0.005;
    ctx.beginPath();
    ctx.ellipse(W / 2, H / 2, W * 0.33, W * 0.33, 0, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      ctx.fillStyle = GOLD;
      ctx.beginPath();
      ctx.arc(W / 2 + Math.cos(a) * W * 0.315, H / 2 + Math.sin(a) * W * 0.315, W * 0.009, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    ctx.fillStyle = color;
    suitPath(ctx, suit, W / 2, H / 2, W * 0.42);
    ctx.fillStyle = GOLD_LIGHT;
    suitPath(ctx, suit, W / 2, H / 2 - W * 0.02, W * 0.1);
  } else {
    suitPath(ctx, suit, W / 2, H / 2, W * 0.36);
  }
}

// ─── Resimli kartlar (Vale, Kız, Papaz) ──────────────────────────────────

const ROBE: Record<Suit, [string, string]> = {
  0: ['#1f3b73', '#2f5aa3'],
  1: ['#a3162a', '#cf3446'],
  2: ['#1e5a3a', '#2f7d52'],
  3: ['#b5561a', '#d97a30'],
};

function drawFigureHalf(ctx: Ctx, rank: number, suit: Suit, fx: number, fy: number, fw: number, fh: number) {
  // fx,fy: çerçeve sol üst; fw: genişlik; fh: yarım yükseklik
  const cx = fx + fw / 2;
  const [robeDark, robeLight] = ROBE[suit];
  const skin = '#f2cfa8';
  const headY = fy + fh * 0.43;
  const headR = fw * 0.15;

  ctx.save();
  ctx.beginPath();
  ctx.rect(fx, fy, fw, fh);
  ctx.clip();

  // Omuzlar ve cüppe
  const shoulderY = headY + headR * 1.25;
  ctx.fillStyle = robeDark;
  ctx.beginPath();
  ctx.moveTo(fx + fw * 0.06, fy + fh);
  ctx.quadraticCurveTo(fx + fw * 0.08, shoulderY, cx - fw * 0.1, shoulderY - fh * 0.03);
  ctx.lineTo(cx + fw * 0.1, shoulderY - fh * 0.03);
  ctx.quadraticCurveTo(fx + fw * 0.92, shoulderY, fx + fw * 0.94, fy + fh);
  ctx.closePath();
  ctx.fill();
  // Cüppe deseni
  ctx.fillStyle = robeLight;
  ctx.beginPath();
  ctx.moveTo(cx - fw * 0.13, shoulderY);
  ctx.lineTo(cx + fw * 0.13, shoulderY);
  ctx.lineTo(cx + fw * 0.2, fy + fh);
  ctx.lineTo(cx - fw * 0.2, fy + fh);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = fw * 0.018;
  ctx.stroke();
  // Altın düğmeler / kareler
  ctx.fillStyle = GOLD_LIGHT;
  for (let i = 0; i < 3; i++) {
    const y = shoulderY + (fy + fh - shoulderY) * (0.25 + i * 0.25);
    ctx.save();
    ctx.translate(cx, y);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-fw * 0.025, -fw * 0.025, fw * 0.05, fw * 0.05);
    ctx.restore();
  }
  // Yaka
  ctx.fillStyle = '#f7efe0';
  ctx.beginPath();
  ctx.moveTo(cx - fw * 0.16, shoulderY - fh * 0.02);
  ctx.quadraticCurveTo(cx, shoulderY + fh * 0.1, cx + fw * 0.16, shoulderY - fh * 0.02);
  ctx.quadraticCurveTo(cx, shoulderY + fh * 0.03, cx - fw * 0.16, shoulderY - fh * 0.02);
  ctx.fill();

  // Saç (arka)
  if (rank === 12) {
    ctx.fillStyle = '#8a5a26';
    ctx.beginPath();
    ctx.ellipse(cx, headY + headR * 0.4, headR * 1.35, headR * 1.6, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Baş
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.ellipse(cx, headY, headR, headR * 1.12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(90,50,20,0.5)';
  ctx.lineWidth = fw * 0.008;
  ctx.stroke();

  // Yüz
  ctx.fillStyle = '#2a1a10';
  ctx.beginPath();
  ctx.arc(cx - headR * 0.38, headY - headR * 0.08, headR * 0.1, 0, Math.PI * 2);
  ctx.arc(cx + headR * 0.38, headY - headR * 0.08, headR * 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#2a1a10';
  ctx.lineWidth = fw * 0.01;
  ctx.beginPath();
  ctx.moveTo(cx - headR * 0.52, headY - headR * 0.3);
  ctx.lineTo(cx - headR * 0.2, headY - headR * 0.34);
  ctx.moveTo(cx + headR * 0.52, headY - headR * 0.3);
  ctx.lineTo(cx + headR * 0.2, headY - headR * 0.34);
  ctx.stroke();
  // burun
  ctx.beginPath();
  ctx.moveTo(cx, headY - headR * 0.05);
  ctx.lineTo(cx - headR * 0.08, headY + headR * 0.28);
  ctx.lineTo(cx + headR * 0.06, headY + headR * 0.3);
  ctx.stroke();

  if (rank === 13) {
    // Papaz: sakal ve bıyık
    ctx.fillStyle = '#e8e2d6';
    ctx.beginPath();
    ctx.moveTo(cx - headR * 0.9, headY + headR * 0.1);
    ctx.quadraticCurveTo(cx - headR * 0.8, headY + headR * 1.7, cx, headY + headR * 1.9);
    ctx.quadraticCurveTo(cx + headR * 0.8, headY + headR * 1.7, cx + headR * 0.9, headY + headR * 0.1);
    ctx.quadraticCurveTo(cx, headY + headR * 0.75, cx - headR * 0.9, headY + headR * 0.1);
    ctx.fill();
    ctx.strokeStyle = 'rgba(120,110,100,0.6)';
    ctx.lineWidth = fw * 0.006;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(cx + i * headR * 0.25, headY + headR * 0.75);
      ctx.lineTo(cx + i * headR * 0.18, headY + headR * 1.6);
      ctx.stroke();
    }
    ctx.fillStyle = '#d8d0c2';
    ctx.beginPath();
    ctx.ellipse(cx - headR * 0.28, headY + headR * 0.48, headR * 0.34, headR * 0.12, -0.25, 0, Math.PI * 2);
    ctx.ellipse(cx + headR * 0.28, headY + headR * 0.48, headR * 0.34, headR * 0.12, 0.25, 0, Math.PI * 2);
    ctx.fill();
  } else if (rank === 11) {
    // Vale: bıyık
    ctx.fillStyle = '#5a3a1a';
    ctx.beginPath();
    ctx.ellipse(cx - headR * 0.24, headY + headR * 0.5, headR * 0.26, headR * 0.09, -0.3, 0, Math.PI * 2);
    ctx.ellipse(cx + headR * 0.24, headY + headR * 0.5, headR * 0.26, headR * 0.09, 0.3, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Kız: dudak
    ctx.fillStyle = '#c0394a';
    ctx.beginPath();
    ctx.ellipse(cx, headY + headR * 0.58, headR * 0.2, headR * 0.08, 0, 0, Math.PI * 2);
    ctx.fill();
    // yanak
    ctx.fillStyle = 'rgba(230,110,110,0.35)';
    ctx.beginPath();
    ctx.arc(cx - headR * 0.5, headY + headR * 0.3, headR * 0.18, 0, Math.PI * 2);
    ctx.arc(cx + headR * 0.5, headY + headR * 0.3, headR * 0.18, 0, Math.PI * 2);
    ctx.fill();
  }

  // Taç / başlık
  const crownBase = headY - headR * 0.85;
  if (rank === 13) {
    ctx.fillStyle = '#d9a93a';
    ctx.beginPath();
    ctx.moveTo(cx - headR * 1.05, crownBase);
    ctx.lineTo(cx - headR * 1.15, crownBase - headR * 1.1);
    ctx.lineTo(cx - headR * 0.55, crownBase - headR * 0.55);
    ctx.lineTo(cx, crownBase - headR * 1.35);
    ctx.lineTo(cx + headR * 0.55, crownBase - headR * 0.55);
    ctx.lineTo(cx + headR * 1.15, crownBase - headR * 1.1);
    ctx.lineTo(cx + headR * 1.05, crownBase);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#7a5a14';
    ctx.lineWidth = fw * 0.008;
    ctx.stroke();
    ctx.fillStyle = '#c0182b';
    ctx.beginPath();
    ctx.arc(cx, crownBase - headR * 0.35, headR * 0.16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1f5fbf';
    ctx.beginPath();
    ctx.arc(cx - headR * 0.62, crownBase - headR * 0.25, headR * 0.11, 0, Math.PI * 2);
    ctx.arc(cx + headR * 0.62, crownBase - headR * 0.25, headR * 0.11, 0, Math.PI * 2);
    ctx.fill();
  } else if (rank === 12) {
    ctx.fillStyle = '#d9a93a';
    ctx.beginPath();
    ctx.moveTo(cx - headR * 0.95, crownBase + headR * 0.05);
    for (let i = 0; i < 5; i++) {
      const x0 = cx - headR * 0.95 + (i * headR * 1.9) / 5;
      const x1 = x0 + (headR * 1.9) / 5;
      ctx.quadraticCurveTo((x0 + x1) / 2, crownBase - headR * 1.05, x1, crownBase + headR * 0.05);
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#7a5a14';
    ctx.lineWidth = fw * 0.008;
    ctx.stroke();
    ctx.fillStyle = '#fff6e0';
    for (let i = 0; i < 5; i++) {
      const x = cx - headR * 0.95 + ((i + 0.5) * headR * 1.9) / 5;
      ctx.beginPath();
      ctx.arc(x, crownBase - headR * 0.55, headR * 0.09, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    // Vale: kasket ve tüy
    ctx.fillStyle = suit === 1 || suit === 3 ? '#1f3b73' : '#a3162a';
    ctx.beginPath();
    ctx.ellipse(cx, crownBase + headR * 0.05, headR * 1.25, headR * 0.5, -0.12, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(cx - headR * 1.2, crownBase - headR * 0.05, headR * 2.4, headR * 0.22);
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = fw * 0.012;
    ctx.beginPath();
    ctx.moveTo(cx - headR * 1.2, crownBase + headR * 0.12);
    ctx.lineTo(cx + headR * 1.2, crownBase + headR * 0.12);
    ctx.stroke();
    ctx.strokeStyle = '#f4ecd8';
    ctx.lineWidth = fw * 0.02;
    ctx.beginPath();
    ctx.moveTo(cx + headR * 0.6, crownBase - headR * 0.2);
    ctx.quadraticCurveTo(cx + headR * 1.8, crownBase - headR * 1.4, cx + headR * 1.5, crownBase - headR * 1.9);
    ctx.stroke();
  }

  // Elinde tuttuğu: Papaz kılıç, Kız lale, Vale mızrak
  const hx = fx + fw * 0.2;
  if (rank === 13) {
    ctx.strokeStyle = '#8f9aa8';
    ctx.lineWidth = fw * 0.03;
    ctx.beginPath();
    ctx.moveTo(hx, fy + fh * 0.12);
    ctx.lineTo(hx, fy + fh * 0.9);
    ctx.stroke();
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = fw * 0.03;
    ctx.beginPath();
    ctx.moveTo(hx - fw * 0.07, fy + fh * 0.75);
    ctx.lineTo(hx + fw * 0.07, fy + fh * 0.75);
    ctx.stroke();
  } else if (rank === 12) {
    ctx.strokeStyle = '#2f7d52';
    ctx.lineWidth = fw * 0.018;
    ctx.beginPath();
    ctx.moveTo(hx, fy + fh * 0.95);
    ctx.quadraticCurveTo(hx + fw * 0.03, fy + fh * 0.55, hx, fy + fh * 0.35);
    ctx.stroke();
    ctx.fillStyle = '#c0182b';
    ctx.beginPath();
    ctx.moveTo(hx - fw * 0.06, fy + fh * 0.36);
    ctx.quadraticCurveTo(hx - fw * 0.075, fy + fh * 0.2, hx - fw * 0.035, fy + fh * 0.16);
    ctx.lineTo(hx, fy + fh * 0.23);
    ctx.lineTo(hx + fw * 0.035, fy + fh * 0.16);
    ctx.quadraticCurveTo(hx + fw * 0.075, fy + fh * 0.2, hx + fw * 0.06, fy + fh * 0.36);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.strokeStyle = '#6b4a22';
    ctx.lineWidth = fw * 0.02;
    ctx.beginPath();
    ctx.moveTo(hx, fy + fh * 0.1);
    ctx.lineTo(hx, fy + fh);
    ctx.stroke();
    ctx.fillStyle = '#9aa4b0';
    ctx.beginPath();
    ctx.moveTo(hx, fy + fh * 0.02);
    ctx.lineTo(hx + fw * 0.04, fy + fh * 0.14);
    ctx.lineTo(hx - fw * 0.04, fy + fh * 0.14);
    ctx.closePath();
    ctx.fill();
  }

  // Küçük renk işareti
  ctx.fillStyle = isRed(suit) ? RED : BLACK;
  suitPath(ctx, suit, fx + fw * 0.8, fy + fh * 0.16, fw * 0.14);
  ctx.restore();
}

function drawCourt(ctx: Ctx, card: Card, W: number, H: number) {
  const suit = suitOf(card);
  const rank = rankOf(card);
  const fx = W * 0.2;
  const fy = H * 0.085;
  const fw = W * 0.6;
  const fh = H * 0.83;
  ctx.save();
  ctx.fillStyle = isRed(suit) ? '#fbeee6' : '#eef2f8';
  ctx.fillRect(fx, fy, fw, fh);
  // İnce çizgili arka plan
  ctx.strokeStyle = isRed(suit) ? 'rgba(192,24,43,0.08)' : 'rgba(31,59,115,0.08)';
  ctx.lineWidth = 1.5;
  for (let y = fy; y < fy + fh; y += 7) {
    ctx.beginPath();
    ctx.moveTo(fx, y);
    ctx.lineTo(fx + fw, y);
    ctx.stroke();
  }
  drawFigureHalf(ctx, rank, suit, fx, fy, fw, fh / 2);
  ctx.save();
  ctx.translate(W, H);
  ctx.rotate(Math.PI);
  drawFigureHalf(ctx, rank, suit, W - fx - fw, H - fy - fh, fw, fh / 2);
  ctx.restore();
  // Orta çizgi
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = W * 0.008;
  ctx.beginPath();
  ctx.moveTo(fx, fy + fh / 2);
  ctx.lineTo(fx + fw, fy + fh / 2);
  ctx.stroke();
  // Çerçeve
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = W * 0.012;
  ctx.strokeRect(fx, fy, fw, fh);
  ctx.strokeStyle = isRed(suit) ? RED : BLACK;
  ctx.lineWidth = W * 0.004;
  ctx.strokeRect(fx - W * 0.012, fy - W * 0.012, fw + W * 0.024, fh + W * 0.024);
  ctx.restore();
}

export function drawCardFace(canvas: HTMLCanvasElement, card: Card) {
  const W = canvas.width;
  const H = canvas.height;
  const ctx = canvas.getContext('2d')!;
  cardBase(ctx, W, H);
  const rank = rankOf(card);
  if (rank === 14) drawAce(ctx, card, W, H);
  else if (rank >= 11) drawCourt(ctx, card, W, H);
  else drawPips(ctx, card, W, H);
  drawIndex(ctx, card, W, H);
}

export function drawCardBack(canvas: HTMLCanvasElement) {
  const W = canvas.width;
  const H = canvas.height;
  const ctx = canvas.getContext('2d')!;
  cardBase(ctx, W, H);
  const m = W * 0.055;
  const x = m;
  const y = m;
  const w = W - m * 2;
  const h = H - m * 2;
  ctx.save();
  roundRect(ctx, x, y, w, h, W * 0.035);
  ctx.clip();
  const g = ctx.createRadialGradient(W / 2, H / 2, W * 0.05, W / 2, H / 2, H * 0.6);
  g.addColorStop(0, '#8e1f2e');
  g.addColorStop(1, '#5a0f19');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  // Kafes deseni
  ctx.strokeStyle = 'rgba(227,197,122,0.35)';
  ctx.lineWidth = W * 0.006;
  const step = W * 0.075;
  for (let i = -H; i < W + H; i += step) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + H, H);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(i, H);
    ctx.lineTo(i + H, 0);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(227,197,122,0.55)';
  for (let i = -H; i < W + H; i += step) {
    for (let j = 0; j < H + step; j += step) {
      const px = i + j;
      const py = j;
      if (px > 0 && px < W) {
        ctx.beginPath();
        ctx.arc(px, py, W * 0.008, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  ctx.restore();
  // Çerçeveler
  ctx.strokeStyle = GOLD_LIGHT;
  ctx.lineWidth = W * 0.012;
  roundRect(ctx, x + W * 0.02, y + W * 0.02, w - W * 0.04, h - W * 0.04, W * 0.025);
  ctx.stroke();
  ctx.lineWidth = W * 0.004;
  roundRect(ctx, x + W * 0.04, y + W * 0.04, w - W * 0.08, h - W * 0.08, W * 0.02);
  ctx.stroke();
  // Madalyon
  const cx = W / 2;
  const cy = H / 2;
  ctx.fillStyle = '#4a0a13';
  ctx.beginPath();
  ctx.ellipse(cx, cy, W * 0.22, H * 0.17, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = GOLD_LIGHT;
  ctx.lineWidth = W * 0.012;
  ctx.stroke();
  ctx.lineWidth = W * 0.004;
  ctx.beginPath();
  ctx.ellipse(cx, cy, W * 0.19, H * 0.145, 0, 0, Math.PI * 2);
  ctx.stroke();
  // Lale
  ctx.fillStyle = GOLD_LIGHT;
  const s = W * 0.0017;
  ctx.save();
  ctx.translate(cx, cy + H * 0.01);
  ctx.scale(s * 100, s * 100);
  ctx.beginPath();
  ctx.moveTo(0, -0.62);
  ctx.bezierCurveTo(0.12, -0.45, 0.14, -0.25, 0.05, -0.08);
  ctx.bezierCurveTo(0.2, -0.3, 0.34, -0.42, 0.42, -0.5);
  ctx.bezierCurveTo(0.44, -0.2, 0.3, 0.02, 0.0, 0.08);
  ctx.bezierCurveTo(-0.3, 0.02, -0.44, -0.2, -0.42, -0.5);
  ctx.bezierCurveTo(-0.34, -0.42, -0.2, -0.3, -0.05, -0.08);
  ctx.bezierCurveTo(-0.14, -0.25, -0.12, -0.45, 0, -0.62);
  ctx.fill();
  ctx.fillRect(-0.025, 0.05, 0.05, 0.5);
  ctx.beginPath();
  ctx.moveTo(0, 0.38);
  ctx.quadraticCurveTo(0.25, 0.2, 0.36, 0.26);
  ctx.quadraticCurveTo(0.22, 0.38, 0, 0.46);
  ctx.moveTo(0, 0.3);
  ctx.quadraticCurveTo(-0.25, 0.12, -0.36, 0.18);
  ctx.quadraticCurveTo(-0.22, 0.3, 0, 0.38);
  ctx.fill();
  ctx.restore();
}
