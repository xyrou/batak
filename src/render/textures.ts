import * as THREE from 'three';

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

function rand(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function toTexture(c: HTMLCanvasElement, repeat = 1, srgb = true): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 8;
  return t;
}

function noise(ctx: CanvasRenderingContext2D, w: number, h: number, amount: number, seed = 1) {
  const r = rand(seed);
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (r() - 0.5) * amount;
    d[i] = Math.max(0, Math.min(255, d[i] + n));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n));
  }
  ctx.putImageData(img, 0, 0);
}

/** Yeşil çuha */
export function feltTexture(size = 512): { map: THREE.CanvasTexture; bump: THREE.CanvasTexture } {
  const [c, g] = canvas(size, size);
  g.fillStyle = '#17532f';
  g.fillRect(0, 0, size, size);
  const r = rand(7);
  for (let i = 0; i < size * 30; i++) {
    const x = r() * size;
    const y = r() * size;
    const l = 1 + r() * 3;
    const a = r() * Math.PI;
    g.strokeStyle = r() < 0.5 ? 'rgba(10,40,20,0.12)' : 'rgba(80,160,100,0.08)';
    g.lineWidth = 0.6;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    g.stroke();
  }
  noise(g, size, size, 14, 3);
  const [b, bg] = canvas(256, 256);
  bg.fillStyle = '#808080';
  bg.fillRect(0, 0, 256, 256);
  noise(bg, 256, 256, 60, 9);
  const map = toTexture(c, 3);
  const bump = toTexture(b, 6, false);
  return { map, bump };
}

/** Ahşap damarı: base renk, damar rengi */
export function woodTexture(
  base: string, grain: string, w = 512, h = 512, seed = 1, planks = 0,
): THREE.CanvasTexture {
  const [c, g] = canvas(w, h);
  g.fillStyle = base;
  g.fillRect(0, 0, w, h);
  const r = rand(seed);
  const lines = 90;
  for (let i = 0; i < lines; i++) {
    const y0 = r() * h;
    const amp = 2 + r() * 8;
    const freq = 0.004 + r() * 0.01;
    const ph = r() * 10;
    g.strokeStyle = grain;
    g.globalAlpha = 0.08 + r() * 0.22;
    g.lineWidth = 0.6 + r() * 2.2;
    g.beginPath();
    for (let x = 0; x <= w; x += 6) {
      const y = y0 + Math.sin(x * freq + ph) * amp + Math.sin(x * freq * 3.1 + ph) * amp * 0.3;
      if (x === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
  }
  // budaklar
  for (let i = 0; i < 3; i++) {
    const x = r() * w;
    const y = r() * h;
    for (let k = 0; k < 6; k++) {
      g.globalAlpha = 0.12;
      g.strokeStyle = grain;
      g.lineWidth = 1.2;
      g.beginPath();
      g.ellipse(x, y, 4 + k * 4, 2 + k * 1.6, 0, 0, Math.PI * 2);
      g.stroke();
    }
  }
  g.globalAlpha = 1;
  if (planks > 0) {
    const ph = h / planks;
    for (let i = 0; i < planks; i++) {
      g.fillStyle = `rgba(0,0,0,${0.05 + r() * 0.12})`;
      g.fillRect(0, i * ph, w, ph);
      g.fillStyle = 'rgba(0,0,0,0.55)';
      g.fillRect(0, i * ph, w, 2);
      const off = r() * w;
      g.fillRect(off, i * ph, 2, ph);
    }
  }
  noise(g, w, h, 10, seed + 5);
  return toTexture(c, 1);
}

/** Sıvalı duvar */
export function plasterTexture(): THREE.CanvasTexture {
  const [c, g] = canvas(512, 512);
  const grad = g.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, '#6b4a2c');
  grad.addColorStop(1, '#5a3c22');
  g.fillStyle = grad;
  g.fillRect(0, 0, 512, 512);
  const r = rand(11);
  for (let i = 0; i < 400; i++) {
    g.fillStyle = `rgba(${r() < 0.5 ? '255,220,170' : '30,15,5'},${r() * 0.05})`;
    g.beginPath();
    g.arc(r() * 512, r() * 512, 5 + r() * 40, 0, Math.PI * 2);
    g.fill();
  }
  noise(g, 512, 512, 16, 12);
  return toTexture(c, 2);
}

/** Lambri panelleri */
export function wainscotTexture(): THREE.CanvasTexture {
  const [c, g] = canvas(512, 256);
  const wood = woodTexture('#3b2414', '#1c0f07', 512, 256, 21);
  g.drawImage(wood.image as HTMLCanvasElement, 0, 0);
  for (let i = 0; i < 4; i++) {
    const x = i * 128 + 14;
    g.strokeStyle = 'rgba(0,0,0,0.55)';
    g.lineWidth = 6;
    g.strokeRect(x, 30, 100, 190);
    g.strokeStyle = 'rgba(255,200,140,0.12)';
    g.lineWidth = 2;
    g.strokeRect(x + 5, 35, 90, 180);
  }
  g.fillStyle = 'rgba(0,0,0,0.5)';
  g.fillRect(0, 0, 512, 10);
  return toTexture(c, 1);
}

/** Basit tablo (resim) */
export function paintingTexture(kind: 'bosphorus' | 'still'): THREE.CanvasTexture {
  const [c, g] = canvas(256, 192);
  if (kind === 'bosphorus') {
    const sky = g.createLinearGradient(0, 0, 0, 120);
    sky.addColorStop(0, '#e0a060');
    sky.addColorStop(1, '#f3d49a');
    g.fillStyle = sky;
    g.fillRect(0, 0, 256, 192);
    g.fillStyle = '#2d4a5e';
    g.fillRect(0, 120, 256, 72);
    g.fillStyle = '#3a2a2a';
    // silüet: kubbeler ve minareler
    g.beginPath();
    g.moveTo(0, 122);
    g.lineTo(40, 122);
    g.arc(80, 122, 30, Math.PI, 0);
    g.lineTo(150, 122);
    g.arc(170, 122, 16, Math.PI, 0);
    g.lineTo(256, 122);
    g.lineTo(256, 126);
    g.lineTo(0, 126);
    g.fill();
    for (const x of [44, 116, 196, 212]) {
      g.fillRect(x, 60, 5, 64);
      g.beginPath();
      g.moveTo(x - 1, 60);
      g.lineTo(x + 2.5, 48);
      g.lineTo(x + 6, 60);
      g.fill();
    }
    g.fillStyle = 'rgba(255,230,180,0.25)';
    for (let i = 0; i < 20; i++) g.fillRect(Math.random() * 256, 130 + Math.random() * 60, 20 + Math.random() * 30, 1.5);
  } else {
    g.fillStyle = '#2a1c14';
    g.fillRect(0, 0, 256, 192);
    g.fillStyle = '#6b1a1a';
    g.beginPath();
    g.ellipse(128, 150, 90, 20, 0, 0, Math.PI * 2);
    g.fill();
    const fruit = ['#c8551a', '#a81d1d', '#d9a52a', '#6b8f2a'];
    fruit.forEach((f, i) => {
      g.fillStyle = f;
      g.beginPath();
      g.arc(80 + i * 32, 128 - (i % 2) * 12, 20, 0, Math.PI * 2);
      g.fill();
    });
  }
  noise(g, 256, 192, 18, 4);
  return toTexture(c, 1);
}

export function clockTexture(): THREE.CanvasTexture {
  const [c, g] = canvas(256, 256);
  g.fillStyle = '#efe4c8';
  g.beginPath();
  g.arc(128, 128, 124, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#3b2414';
  g.lineWidth = 8;
  g.stroke();
  g.fillStyle = '#2a1a10';
  g.font = '700 26px "Playfair Display", serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  for (let i = 1; i <= 12; i++) {
    const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
    g.fillText(String(i), 128 + Math.cos(a) * 96, 128 + Math.sin(a) * 96);
  }
  g.lineCap = 'round';
  g.lineWidth = 7;
  g.beginPath();
  g.moveTo(128, 128);
  g.lineTo(128 + 50 * Math.cos(-2.2), 128 + 50 * Math.sin(-2.2));
  g.stroke();
  g.lineWidth = 4;
  g.beginPath();
  g.moveTo(128, 128);
  g.lineTo(128 + 80 * Math.cos(-0.4), 128 + 80 * Math.sin(-0.4));
  g.stroke();
  return toTexture(c, 1);
}

/** Tavla tahtası üst yüzü */
export function tavlaTexture(): THREE.CanvasTexture {
  const [c, g] = canvas(512, 384);
  g.fillStyle = '#e6cf9f';
  g.fillRect(0, 0, 512, 384);
  g.fillStyle = '#5a3418';
  g.fillRect(0, 0, 512, 16);
  g.fillRect(0, 368, 512, 16);
  g.fillRect(0, 0, 16, 384);
  g.fillRect(496, 0, 16, 384);
  g.fillRect(248, 0, 16, 384);
  const w = (232 - 8) / 6;
  for (let half = 0; half < 2; half++) {
    const x0 = half ? 264 : 16;
    for (let i = 0; i < 6; i++) {
      for (const top of [true, false]) {
        g.fillStyle = (i + (top ? 0 : 1)) % 2 ? '#8a1f1f' : '#2b2b2b';
        g.beginPath();
        const x = x0 + 4 + i * w;
        if (top) {
          g.moveTo(x, 16);
          g.lineTo(x + w, 16);
          g.lineTo(x + w / 2, 160);
        } else {
          g.moveTo(x, 368);
          g.lineTo(x + w, 368);
          g.lineTo(x + w / 2, 224);
        }
        g.fill();
      }
    }
  }
  noise(g, 512, 384, 12, 31);
  return toTexture(c, 1);
}
