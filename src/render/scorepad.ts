/** Masadaki yazboz defterine el el puanları el yazısıyla yazar */
export interface PadData {
  title: string;
  columns: string[];
  rows: (number | string)[][];
  totals: number[];
}

export function drawScorepad(canvas: HTMLCanvasElement, data: PadData | null) {
  const g = canvas.getContext('2d')!;
  const W = canvas.width;
  const H = canvas.height;
  g.fillStyle = '#f6f0de';
  g.fillRect(0, 0, W, H);
  // kağıt dokusu
  for (let i = 0; i < 900; i++) {
    g.fillStyle = `rgba(120,100,60,${Math.random() * 0.04})`;
    g.fillRect(Math.random() * W, Math.random() * H, 2, 2);
  }
  // çizgiler
  const top = 96;
  const lh = 38;
  g.strokeStyle = 'rgba(70,120,190,0.35)';
  g.lineWidth = 1.5;
  for (let y = top; y < H - 10; y += lh) {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(W, y);
    g.stroke();
  }
  g.strokeStyle = 'rgba(200,60,60,0.45)';
  g.beginPath();
  g.moveTo(70, 0);
  g.lineTo(70, H);
  g.stroke();

  const ink = '#1d2f6b';
  g.fillStyle = ink;
  g.textBaseline = 'alphabetic';
  g.font = '700 46px Caveat, "Segoe Print", cursive';
  g.textAlign = 'center';
  g.fillText(data?.title ?? 'Yazboz', W / 2 + 20, 64);
  if (!data) return;

  const cols = data.columns.length;
  const x0 = 86;
  const colW = (W - x0 - 14) / cols;
  g.font = '700 32px Caveat, "Segoe Print", cursive';
  data.columns.forEach((c, i) => g.fillText(c, x0 + colW * (i + 0.5), top + lh - 10));
  g.strokeStyle = ink;
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(x0, top + lh + 2);
  g.lineTo(W - 14, top + lh + 2);
  g.stroke();
  for (let i = 1; i < cols; i++) {
    g.beginPath();
    g.moveTo(x0 + colW * i, top + 6);
    g.lineTo(x0 + colW * i, H - 20);
    g.globalAlpha = 0.35;
    g.stroke();
    g.globalAlpha = 1;
  }
  const maxRows = Math.floor((H - top - lh * 3) / lh);
  const rows = data.rows.slice(-maxRows);
  const startNo = data.rows.length - rows.length;
  g.font = '500 30px Caveat, "Segoe Print", cursive';
  rows.forEach((r, ri) => {
    const y = top + lh * (ri + 2) - 10;
    g.textAlign = 'right';
    g.fillStyle = 'rgba(29,47,107,0.6)';
    g.fillText(String(startNo + ri + 1), 58, y);
    g.textAlign = 'center';
    r.forEach((v, ci) => {
      const neg = typeof v === 'number' && v < 0;
      g.fillStyle = neg ? '#a3202a' : ink;
      g.fillText(String(v), x0 + colW * (ci + 0.5) + ((ri * 7 + ci * 3) % 5) - 2, y);
    });
  });
  const ty = top + lh * (rows.length + 2) + 2;
  g.strokeStyle = ink;
  g.lineWidth = 2.5;
  g.beginPath();
  g.moveTo(x0, ty - 26);
  g.lineTo(W - 14, ty - 26);
  g.stroke();
  g.font = '700 34px Caveat, "Segoe Print", cursive';
  data.totals.forEach((t, ci) => {
    g.fillStyle = t < 0 ? '#a3202a' : ink;
    g.fillText(String(t), x0 + colW * (ci + 0.5), ty + 8);
  });
}
