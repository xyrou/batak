import * as THREE from 'three';
import { Card, Suit, sortHand, suitOf } from '../engine/cards';
import { CARD_RATIO, drawCardBack, drawCardFace } from './cardface';
import { Stage } from './stage';
import { Ease, easings } from './tween';

export const CW = 0.118;
export const CH = CW * CARD_RATIO;

const tmpV = new THREE.Vector3();
const tmpQ = new THREE.Quaternion();
const tmpE = new THREE.Euler();

export type Zone = 'deck' | 'hand' | 'trick' | 'won' | 'kitty' | 'dummy' | 'buried';

export class CardView {
  card: Card;
  group = new THREE.Group();
  front: THREE.Mesh;
  back: THREE.Mesh;
  glow: THREE.Mesh;
  faceMat: THREE.MeshStandardMaterial;
  zone: Zone = 'deck';
  seat = -1;
  hover = 0;
  lift = 0;
  selected = false;
  dim = false;

  constructor(card: Card, geo: THREE.BufferGeometry, faceMat: THREE.MeshStandardMaterial, backMat: THREE.Material, glowMat: THREE.Material, glowGeo: THREE.BufferGeometry) {
    this.card = card;
    this.faceMat = faceMat;
    this.front = new THREE.Mesh(geo, faceMat);
    this.front.position.z = 0.0004;
    this.front.castShadow = true;
    this.front.userData.view = this;
    this.back = new THREE.Mesh(geo, backMat);
    this.back.rotation.y = Math.PI;
    this.back.position.z = -0.0004;
    this.back.castShadow = true;
    this.back.userData.view = this;
    this.glow = new THREE.Mesh(glowGeo, glowMat);
    this.glow.position.z = -0.001;
    this.glow.visible = false;
    this.group.add(this.front, this.back, this.glow);
  }

  setDim(d: boolean) {
    if (this.dim === d) return;
    this.dim = d;
    this.faceMat.color.setScalar(d ? 0.4 : 1);
  }

  setGlow(on: boolean, color?: string) {
    this.glow.visible = on;
    if (on && color) ((this.glow.material as THREE.MeshBasicMaterial).color as THREE.Color).set(color);
  }

  setShadow(on: boolean) {
    this.front.castShadow = on;
    this.back.castShadow = on;
  }
}

export interface Slot {
  parent: THREE.Object3D;
  pos: THREE.Vector3;
  quat: THREE.Quaternion;
  scale: number;
}

/** Koltuk yerel koordinatları: +z masanın merkezinden koltuğa doğru */
const SEAT_ROT = [0, Math.PI / 2, Math.PI, -Math.PI / 2];

function seatToWorld(seat: number, local: THREE.Vector3): THREE.Vector3 {
  return local.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), SEAT_ROT[seat]);
}

function quatFromEuler(x: number, y: number, z: number, order: THREE.EulerOrder = 'YXZ'): THREE.Quaternion {
  return new THREE.Quaternion().setFromEuler(tmpE.set(x, y, z, order));
}

/** Masada yüzü yukarı, oyuncuya okunur şekilde yatan kart */
function flatUp(yaw = 0): THREE.Quaternion {
  return quatFromEuler(-Math.PI / 2, yaw, 0, 'YXZ');
}
function flatDown(yaw = 0): THREE.Quaternion {
  return quatFromEuler(Math.PI / 2, yaw, 0, 'YXZ');
}

export class CardTable {
  stage: Stage;
  views: CardView[] = [];
  private geo!: THREE.BufferGeometry;
  private glowGeo!: THREE.BufferGeometry;
  private backMat!: THREE.MeshStandardMaterial;
  private glowMat = new THREE.MeshBasicMaterial({ color: '#f3c969', transparent: true, opacity: 0.85, depthWrite: false });
  speed = 1;
  /** İnsan oyuncunun elindeki sıralı kartlar */
  handOrder: Card[] = [];
  sortBySuit = true;
  trump: Suit | -1 = -1;
  seatsActive: number[] = [0, 1, 2, 3];
  dummySeat = -1;

  constructor(stage: Stage) {
    this.stage = stage;
  }

  async init(texSize: number, onProgress: (p: number) => void) {
    this.geo = cardGeometry(CW, CH, CW * 0.07);
    this.glowGeo = cardGeometry(CW + 0.012, CH + 0.012, CW * 0.1);
    const bc = document.createElement('canvas');
    bc.width = texSize;
    bc.height = Math.round(texSize * CARD_RATIO);
    drawCardBack(bc);
    const backTex = new THREE.CanvasTexture(bc);
    backTex.colorSpace = THREE.SRGBColorSpace;
    backTex.anisotropy = this.stage.renderer.capabilities.getMaxAnisotropy();
    this.backMat = new THREE.MeshStandardMaterial({ map: backTex, roughness: 0.5, metalness: 0, alphaTest: 0.5 });
    for (let c = 0; c < 52; c++) {
      const cv = document.createElement('canvas');
      cv.width = texSize;
      cv.height = Math.round(texSize * CARD_RATIO);
      drawCardFace(cv, c);
      const tex = new THREE.CanvasTexture(cv);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = this.stage.renderer.capabilities.getMaxAnisotropy();
      const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.42, metalness: 0, alphaTest: 0.5 });
      const v = new CardView(c, this.geo, mat, this.backMat, this.glowMat, this.glowGeo);
      this.views.push(v);
      this.stage.tableLayer.add(v.group);
      if (c % 4 === 3) {
        onProgress((c + 1) / 52);
        await new Promise((r) => setTimeout(r, 0));
      }
    }
    // GPU'ya önceden yükle
    for (const v of this.views) this.stage.renderer.initTexture(v.faceMat.map!);
    this.stage.renderer.initTexture(backTex);
  }

  view(c: Card) {
    return this.views[c];
  }

  dur(sec: number) {
    return sec * this.speed;
  }

  // ─── Yerleşimler ───────────────────────────────────────────────────────

  deckSlot(dealer: number, i: number): Slot {
    const local = new THREE.Vector3(0.3, 0.004 + i * 0.0009, 0.36);
    return {
      parent: this.stage.tableLayer,
      pos: seatToWorld(dealer, local),
      quat: flatDown(SEAT_ROT[dealer] + (i % 3) * 0.004),
      scale: 1,
    };
  }

  /** İnsan oyuncunun (koltuk 0) elindeki kart yuvası — kameraya bağlı */
  handSlot(index: number, n: number, v?: CardView): Slot {
    const depth = 0.78;
    const half = this.stage.visibleHalfSize(depth);
    const overlap = this.stage.camera.aspect < 1 ? 0.3 : 0.44;
    const needW = CW * (1 + (n - 1) * overlap);
    const fit = Math.min(0.92, (half.w * 2 * 0.94) / needW, (half.h * 2 * 0.3) / CH);
    const scale = Number.isFinite(fit) && fit > 0 ? fit : 0.5;
    const spacing = CW * overlap * scale;
    const mid = (n - 1) / 2;
    const d = index - mid;
    const x = d * spacing;
    const arc = -Math.pow(d / Math.max(1, mid), 2) * 0.012 * scale;
    const px = (2 * half.h) / Math.max(1, window.innerHeight);
    const baseY = -half.h + CH * scale * 0.5 + (this.stage.camera.aspect < 1 ? 76 : 58) * px;
    const lift = v ? v.lift * scale : 0;
    const pos = new THREE.Vector3(x, baseY + arc + lift, -depth + index * 0.0012);
    const quat = quatFromEuler(-0.1, 0, -d * 0.022, 'XYZ');
    return { parent: this.stage.handAnchor, pos, quat, scale };
  }

  /** Rakip ellerindeki kapalı kartlar (yelpaze) */
  oppHandSlot(seat: number, index: number, n: number): Slot {
    const mid = (n - 1) / 2;
    const d = index - mid;
    const side = seat % 2 === 1;
    const spacing = (n > 13 ? 0.02 : 0.025) * (side ? 0.95 : 1);
    // Kartlar sahibine doğru yaslanmış: yüzü sahibine, sırtı masanın ortasına/kameraya bakar
    const tilt = side ? 1.2 : 1.0;
    const local = new THREE.Vector3(d * spacing, 0.05 - Math.abs(d) * 0.001, 0.6 + Math.abs(d) * 0.0012 + index * 0.0006);
    const pos = seatToWorld(seat, local);
    const q = quatFromEuler(tilt, SEAT_ROT[seat], 0, 'YXZ');
    q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), d * 0.04));
    return { parent: this.stage.tableLayer, pos, quat: q, scale: 0.8 };
  }

  trickSlot(seat: number, order: number): Slot {
    const local = new THREE.Vector3(0, 0, 0.16);
    const pos = seatToWorld(seat, local);
    pos.x *= seat % 2 === 1 ? 1.25 : 1;
    pos.y = 0.003 + order * 0.0012;
    const jitter = (((seat * 7 + order * 3) % 5) - 2) * 0.05;
    return { parent: this.stage.tableLayer, pos, quat: flatUp(jitter), scale: 1 };
  }

  /** Koltuğun aldığı ellerin yığın yeri (dünya) ve yığılma yönü */
  pileBase(seat: number): { pos: THREE.Vector3; dir: THREE.Vector3 } {
    const d = this.dummySeat;
    switch (seat) {
      case 0: return { pos: new THREE.Vector3(0.36, 0, 0.17), dir: new THREE.Vector3(0.006, 0, 0.003) };
      case 1: return d === 1
        ? { pos: new THREE.Vector3(0.5, 0, -0.5), dir: new THREE.Vector3(0.004, 0, -0.004) }
        : { pos: new THREE.Vector3(0.44, 0, -0.36), dir: new THREE.Vector3(0.004, 0, -0.005) };
      case 2: return { pos: new THREE.Vector3(-0.36, 0, -0.47), dir: new THREE.Vector3(-0.006, 0, -0.002) };
      default: return d === 3
        ? { pos: new THREE.Vector3(-0.5, 0, 0.44), dir: new THREE.Vector3(-0.004, 0, 0.004) }
        : { pos: new THREE.Vector3(-0.44, 0, 0.22), dir: new THREE.Vector3(-0.005, 0, 0.004) };
    }
  }

  wonSlot(seat: number, trickIdx: number, k: number): Slot {
    const { pos: base, dir } = this.pileBase(seat);
    const pos = base.clone().addScaledVector(dir, trickIdx);
    pos.y = 0.002 + trickIdx * 0.0046 + k * 0.0011;
    const yaw = SEAT_ROT[seat] + (trickIdx % 2 ? 0.16 : -0.08) + (k - 1.5) * 0.018;
    return { parent: this.stage.tableLayer, pos, quat: flatDown(yaw), scale: 0.7 };
  }

  kittySlot(i: number, faceUp: boolean): Slot {
    const pos = new THREE.Vector3(-0.2 + i * 0.133, 0.003, -0.02);
    return { parent: this.stage.tableLayer, pos, quat: faceUp ? flatUp(0) : flatDown(0), scale: 1 };
  }

  buriedSlot(seat: number, i: number): Slot {
    const spots: Record<number, [number, number]> = { 0: [0.56, 0.05], 1: [0.28, -0.56], 3: [-0.3, 0.44] };
    const [x, z] = spots[seat] ?? [0.3, -0.56];
    const pos = new THREE.Vector3(x + i * 0.004, 0.003 + i * 0.0011, z);
    return { parent: this.stage.tableLayer, pos, quat: flatDown(SEAT_ROT[seat] + 0.6 + i * 0.05), scale: 0.62 };
  }

  /** Açık eşin kartları: masada renklere göre dizili, yüzü açık */
  dummySlots(seat: number, cards: Card[]): Map<Card, Slot> {
    const out = new Map<Card, Slot>();
    const sorted = sortHand(cards, this.trump, true);
    const suits: number[] = [];
    for (const c of sorted) if (!suits.includes(suitOf(c))) suits.push(suitOf(c));
    // Karşıdaki açık el uzakta kaldığı için biraz daha büyük serilir
    const scale = seat === 2 ? 0.92 : 0.78;
    suits.forEach((s, col) => {
      const inSuit = sorted.filter((c) => suitOf(c) === s);
      inSuit.forEach((c, k) => {
        let pos: THREE.Vector3;
        if (seat === 2) {
          const x = (col - (suits.length - 1) / 2) * 0.135;
          pos = new THREE.Vector3(x, 0.003 + k * 0.0012, -0.57 + k * 0.05);
        } else {
          const z = (col - (suits.length - 1) / 2) * 0.155;
          const x0 = seat === 1 ? 0.38 : -0.64;
          pos = new THREE.Vector3(x0 + k * 0.03, 0.003 + k * 0.0012, z);
        }
        out.set(c, { parent: this.stage.tableLayer, pos, quat: flatUp(0), scale });
      });
    });
    return out;
  }

  // ─── Animasyon ──────────────────────────────────────────────────────────

  place(v: CardView, s: Slot) {
    s.parent.add(v.group);
    v.group.position.copy(s.pos);
    v.group.quaternion.copy(s.quat);
    v.group.scale.setScalar(s.scale);
  }

  moveTo(v: CardView, s: Slot, duration: number, opts: { arc?: number; delay?: number; ease?: Ease } = {}): Promise<void> {
    if (v.group.parent !== s.parent) s.parent.attach(v.group);
    const p0 = v.group.position.clone();
    const q0 = v.group.quaternion.clone();
    const s0 = v.group.scale.x;
    const arc = opts.arc ?? 0;
    const upDir = s.parent === this.stage.handAnchor ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0);
    return this.stage.tweens.add(
      duration,
      (t) => {
        v.group.position.lerpVectors(p0, s.pos, t);
        if (arc) v.group.position.addScaledVector(upDir, Math.sin(Math.PI * t) * arc);
        v.group.quaternion.slerpQuaternions(q0, s.quat, t);
        v.group.scale.setScalar(s0 + (s.scale - s0) * t);
      },
      opts.ease ?? easings.outCubic,
      v,
      opts.delay ?? 0,
    );
  }

  /** Tüm kartları desteye toplar (anında) */
  resetToDeck(_dealer: number) {
    for (const v of this.views) {
      v.zone = 'deck';
      v.seat = -1;
      v.lift = 0;
      v.hover = 0;
      v.selected = false;
      v.setDim(false);
      v.setGlow(false);
      v.setShadow(true);
      v.group.visible = true;
    }
    this.handOrder = [];
    this.dummySeat = -1;
  }

  async gatherToDeck(dealer: number) {
    const ps: Promise<void>[] = [];
    this.views.forEach((v, i) => {
      v.setGlow(false);
      v.setDim(false);
      v.selected = false;
      v.lift = 0;
      v.setShadow(true);
      v.group.visible = true;
      ps.push(this.moveTo(v, this.deckSlot(dealer, i), this.dur(0.45), { delay: (i % 13) * 0.01, arc: 0.05 }));
    });
    await Promise.all(ps);
    this.resetToDeck(dealer);
  }

  /** Karıştırma animasyonu: destenin iki yarısı yer değiştirir */
  async shuffleAnim(dealer: number) {
    const base = seatToWorld(dealer, new THREE.Vector3(0.3, 0, 0.36));
    const side = seatToWorld(dealer, new THREE.Vector3(1, 0, 0)).normalize();
    for (let round = 0; round < 2; round++) {
      const ps: Promise<void>[] = [];
      this.views.forEach((v, i) => {
        const left = i % 2 === 0;
        const off = side.clone().multiplyScalar(left ? -0.075 : 0.075);
        const pos = base.clone().add(off);
        pos.y = 0.004 + Math.floor(i / 2) * 0.0009;
        ps.push(this.moveTo(v, { parent: this.stage.tableLayer, pos, quat: flatDown(SEAT_ROT[dealer] + (left ? 0.1 : -0.1)), scale: 1 }, this.dur(0.18)));
      });
      await Promise.all(ps);
      const ps2: Promise<void>[] = [];
      const order = this.views.map((_, i) => i).sort(() => Math.random() - 0.5);
      order.forEach((idx, j) => {
        ps2.push(this.moveTo(this.views[idx], this.deckSlot(dealer, j), this.dur(0.2), { delay: j * 0.002 }));
      });
      await Promise.all(ps2);
    }
  }

  /** İnsan elini yeniden diz */
  layoutHand(duration = 0.3, cards?: Card[]) {
    if (cards) this.handOrder = sortHand(cards, this.trump, this.sortBySuit);
    const n = this.handOrder.length;
    this.handOrder.forEach((c, i) => {
      const v = this.views[c];
      v.zone = 'hand';
      v.seat = 0;
      v.setShadow(false);
      void this.moveTo(v, this.handSlot(i, n, v), duration);
    });
  }

  resort(trump: Suit | -1) {
    this.trump = trump;
    this.handOrder = sortHand(this.handOrder, trump, this.sortBySuit);
    this.layoutHand(this.dur(0.35));
  }

  layoutOpp(seat: number, cards: Card[], duration = 0.3) {
    const n = cards.length;
    cards.forEach((c, i) => {
      const v = this.views[c];
      v.zone = 'hand';
      v.seat = seat;
      v.setShadow(true);
      void this.moveTo(v, this.oppHandSlot(seat, i, n), duration);
    });
  }

  layoutDummy(seat: number, cards: Card[], duration = 0.4) {
    this.dummySeat = seat;
    const slots = this.dummySlots(seat, cards);
    for (const [c, s] of slots) {
      const v = this.views[c];
      v.zone = 'dummy';
      v.seat = seat;
      v.setShadow(true);
      void this.moveTo(v, s, duration, { arc: 0.03 });
    }
  }

  handMeshes(): THREE.Object3D[] {
    const out: THREE.Object3D[] = [];
    for (const c of this.handOrder) out.push(this.views[c].front);
    return out;
  }

  /** Hover/seçim kaldırma animasyonu için elin yerleşimini hızlıca güncelle */
  refreshLift() {
    const n = this.handOrder.length;
    this.handOrder.forEach((c, i) => {
      const v = this.views[c];
      const target = this.handSlot(i, n, v);
      void this.moveTo(v, target, 0.12, { ease: easings.outCubic });
    });
  }

  worldPos(v: CardView): THREE.Vector3 {
    return v.group.getWorldPosition(tmpV).clone();
  }

  worldQuat(v: CardView): THREE.Quaternion {
    return v.group.getWorldQuaternion(tmpQ).clone();
  }
}

/** Köşeleri yuvarlatılmış kart düzlemi, UV 0..1 */
function cardGeometry(w: number, h: number, r: number): THREE.BufferGeometry {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  const geo = new THREE.ShapeGeometry(s, 6);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(i, (pos.getX(i) - x) / w, (pos.getY(i) - y) / h);
  }
  uv.needsUpdate = true;
  return geo;
}
