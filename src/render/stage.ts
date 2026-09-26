import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Tweens } from './tween';
import {
  clockTexture, feltTexture, paintingTexture, plasterTexture, tavlaTexture, wainscotTexture, woodTexture,
} from './textures';
import { caydanlik, chair, hangingLamp, notepad, teaGlass, tespih, tavla } from './props';

export type Quality = 'low' | 'medium' | 'high';
export type CameraView = 'seat' | 'top' | 'low';

const FELT = 1.5;
const TABLE_H = 0.76;

interface Orbit {
  yaw: number;
  pitch: number;
  dist: number;
}

const VIEWS: Record<CameraView, Orbit> = {
  seat: { yaw: 0, pitch: 0.66, dist: 1.62 },
  top: { yaw: 0, pitch: 1.32, dist: 1.85 },
  low: { yaw: 0, pitch: 0.42, dist: 1.5 },
};

export class Stage {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  tweens = new Tweens();
  /** Kameraya bağlı, oyuncunun elindeki kartların taşıyıcısı */
  handAnchor = new THREE.Group();
  /** Masa üstündeki kartlar */
  tableLayer = new THREE.Group();
  target = new THREE.Vector3(0, 0, 0.03);
  orbit: Orbit = { ...VIEWS.seat };
  orbitGoal: Orbit = { ...VIEWS.seat };
  view: CameraView = 'seat';
  quality: Quality = 'medium';
  lampLight!: THREE.SpotLight;
  notepadTex!: THREE.CanvasTexture;
  notepadCanvas!: HTMLCanvasElement;
  private frameCbs: ((dt: number) => void)[] = [];
  private last = performance.now();
  private dragging = false;
  private dragStart = { x: 0, y: 0, yaw: 0, pitch: 0 };
  private background: THREE.Object3D[] = [];
  private flicker = 0;

  constructor(container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.95;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.className = 'stage-canvas';

    this.camera = new THREE.PerspectiveCamera(42, 1, 0.05, 40);
    this.scene.add(this.camera);
    this.camera.add(this.handAnchor);
    this.scene.add(this.tableLayer);
    this.scene.background = new THREE.Color('#120a06');
    this.scene.fog = new THREE.Fog('#120a06', 5, 12);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.1;

    this.buildLights();
    this.buildTable();
    this.buildRoom();
    this.bindControls();
    window.addEventListener('resize', () => this.resize());
    this.resize();
  }

  // ─── Işıklar ────────────────────────────────────────────────────────────
  private buildLights() {
    const hemi = new THREE.HemisphereLight('#ffd9ae', '#24160c', 0.22);
    this.scene.add(hemi);

    const spot = new THREE.SpotLight('#ffd49a', 30, 6, 0.82, 0.75, 1.6);
    spot.position.set(0, 1.3, 0.05);
    spot.target.position.set(0, 0, 0.05);
    spot.castShadow = true;
    spot.shadow.mapSize.set(1024, 1024);
    spot.shadow.bias = -0.0004;
    spot.shadow.normalBias = 0.01;
    spot.shadow.camera.near = 0.3;
    spot.shadow.camera.far = 3;
    spot.shadow.radius = 4;
    this.scene.add(spot, spot.target);
    this.lampLight = spot;

    const { group: lamp } = hangingLamp();
    lamp.position.set(0, 1.36, 0.05);
    this.scene.add(lamp);

    // Oda dolgu ışıkları (duvar aplikleri)
    for (const [x, z] of [[-2.2, -3.05], [2.2, -3.05], [-3.45, 0.2]]) {
      const p = new THREE.PointLight('#ffb070', 3.2, 5, 1.6);
      p.position.set(x, 1.15, z);
      this.scene.add(p);
      const glow = new THREE.Mesh(
        new THREE.SphereGeometry(0.06, 12, 8),
        new THREE.MeshStandardMaterial({ color: '#fff0d0', emissive: '#ffb86a', emissiveIntensity: 3 }),
      );
      glow.position.copy(p.position);
      this.scene.add(glow);
    }
  }

  // ─── Masa ───────────────────────────────────────────────────────────────
  private buildTable() {
    const { map, bump } = feltTexture();
    const felt = new THREE.Mesh(
      new THREE.PlaneGeometry(FELT, FELT),
      new THREE.MeshStandardMaterial({ map, bumpMap: bump, bumpScale: 0.6, roughness: 0.96, metalness: 0 }),
    );
    felt.rotation.x = -Math.PI / 2;
    felt.receiveShadow = true;
    this.scene.add(felt);

    const railWood = woodTexture('#4a2a14', '#1e0f06', 1024, 256, 3);
    railWood.repeat.set(2, 1);
    const railMat = new THREE.MeshStandardMaterial({ map: railWood, roughness: 0.32, metalness: 0.05 });
    const outer = 1.84;
    const shape = roundedRect(outer, outer, 0.1);
    shape.holes.push(roundedRect(FELT, FELT, 0.02) as unknown as THREE.Path);
    const railGeo = new THREE.ExtrudeGeometry(shape, {
      depth: 0.03, bevelEnabled: true, bevelThickness: 0.014, bevelSize: 0.014, bevelSegments: 4, curveSegments: 10,
    });
    railGeo.rotateX(-Math.PI / 2);
    railGeo.translate(0, -0.012, 0);
    normalizeUV(railGeo, 1.2);
    const rail = new THREE.Mesh(railGeo, railMat);
    rail.castShadow = true;
    rail.receiveShadow = true;
    this.scene.add(rail);

    const apronWood = woodTexture('#3a2010', '#170a03', 512, 256, 5);
    const apronMat = new THREE.MeshStandardMaterial({ map: apronWood, roughness: 0.5 });
    const apron = new THREE.Mesh(new THREE.BoxGeometry(outer - 0.04, 0.12, outer - 0.04), apronMat);
    apron.position.y = -0.075;
    apron.receiveShadow = true;
    this.scene.add(apron);

    const legProfile = [
      [0.0, 0], [0.045, 0], [0.05, 0.03], [0.035, 0.08], [0.03, 0.3], [0.042, 0.42], [0.03, 0.5], [0.04, 0.6], [0.045, 0.63], [0, 0.63],
    ].map(([r, y]) => new THREE.Vector2(r, y));
    const legGeo = new THREE.LatheGeometry(legProfile, 16);
    for (const [x, z] of [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]]) {
      const leg = new THREE.Mesh(legGeo, apronMat);
      leg.position.set(x, -TABLE_H, z);
      leg.castShadow = true;
      this.scene.add(leg);
    }

    // Masa üstü eşyalar
    const glassSpots: [number, number][] = [[0.64, 0.64], [0.64, -0.64], [-0.64, -0.64], [-0.64, 0.64]];
    glassSpots.forEach(([x, z], i) => {
      const g = teaGlass();
      g.position.set(x, 0, z);
      g.rotation.y = i * 1.3;
      this.scene.add(g);
    });
    const t = tespih();
    t.position.set(0.4, 0, -0.63);
    t.rotation.y = 0.6;
    this.scene.add(t);

    this.notepadCanvas = document.createElement('canvas');
    this.notepadCanvas.width = 512;
    this.notepadCanvas.height = 690;
    this.notepadTex = new THREE.CanvasTexture(this.notepadCanvas);
    this.notepadTex.colorSpace = THREE.SRGBColorSpace;
    this.notepadTex.anisotropy = 8;
    const pad = notepad(this.notepadTex);
    pad.position.set(0.5, 0, 0.44);
    pad.rotation.y = -0.22;
    this.scene.add(pad);

    // Sandalyeler
    const chairMat = new THREE.MeshStandardMaterial({ map: woodTexture('#5a3118', '#2a1407', 256, 256, 8), roughness: 0.55 });
    const chairs: [number, number, number][] = [[0, -1.12, Math.PI], [1.12, 0, Math.PI / 2], [-1.12, 0, -Math.PI / 2]];
    for (const [x, z, ry] of chairs) {
      const c = chair(chairMat);
      c.position.set(x, -TABLE_H, z);
      c.rotation.y = ry;
      this.scene.add(c);
    }
  }

  // ─── Oda ────────────────────────────────────────────────────────────────
  private buildRoom() {
    const W = 7.4;
    const D = 7.0;
    const H = 3.1;
    const floorY = -TABLE_H;
    const floorTex = woodTexture('#4a2c16', '#1e0e05', 1024, 1024, 13, 8);
    floorTex.repeat.set(3, 3);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(W, D),
      new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.7 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, floorY, -0.5);
    floor.receiveShadow = true;
    this.scene.add(floor);

    const plaster = plasterTexture();
    const wains = wainscotTexture();
    const wainH = 1.05;
    const makeWall = (w: number, pos: THREE.Vector3, ry: number) => {
      const g = new THREE.Group();
      const pl = plaster.clone();
      pl.repeat.set(w / 2.5, 1);
      pl.needsUpdate = true;
      const upper = new THREE.Mesh(new THREE.PlaneGeometry(w, H - wainH), new THREE.MeshStandardMaterial({ map: pl, roughness: 0.95 }));
      upper.position.y = wainH + (H - wainH) / 2;
      upper.receiveShadow = true;
      g.add(upper);
      const wt = wains.clone();
      wt.repeat.set(w / 2.2, 1);
      wt.needsUpdate = true;
      const lower = new THREE.Mesh(new THREE.PlaneGeometry(w, wainH), new THREE.MeshStandardMaterial({ map: wt, roughness: 0.6 }));
      lower.position.y = wainH / 2;
      g.add(lower);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(w, 0.05, 0.06), new THREE.MeshStandardMaterial({ color: '#2c180b', roughness: 0.5 }));
      cap.position.set(0, wainH, 0.03);
      g.add(cap);
      g.position.copy(pos);
      g.position.y = floorY;
      g.rotation.y = ry;
      this.scene.add(g);
      return g;
    };
    const back = makeWall(W, new THREE.Vector3(0, 0, -3.2), 0);
    makeWall(D, new THREE.Vector3(-W / 2, 0, -0.5), Math.PI / 2);
    makeWall(D, new THREE.Vector3(W / 2, 0, -0.5), -Math.PI / 2);
    makeWall(W, new THREE.Vector3(0, 0, 3.0), Math.PI);

    const ceil = new THREE.Mesh(
      new THREE.PlaneGeometry(W, D),
      new THREE.MeshStandardMaterial({ map: woodTexture('#2a170b', '#110803', 512, 512, 17, 6), roughness: 0.8 }),
    );
    ceil.rotation.x = Math.PI / 2;
    ceil.position.set(0, floorY + H, -0.5);
    this.scene.add(ceil);

    // Tablolar ve saat (arka duvar)
    const frameMat = new THREE.MeshStandardMaterial({ color: '#8a6428', roughness: 0.35, metalness: 0.6 });
    const addFrame = (tex: THREE.Texture, x: number, y: number, w: number, h: number) => {
      const fr = new THREE.Mesh(new THREE.BoxGeometry(w + 0.08, h + 0.08, 0.04), frameMat);
      fr.position.set(x, y, 0.02);
      back.add(fr);
      const pic = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 }));
      pic.position.set(x, y, 0.045);
      back.add(pic);
    };
    addFrame(paintingTexture('bosphorus'), -1.3, 1.85, 0.9, 0.62);
    addFrame(paintingTexture('still'), 1.35, 1.8, 0.66, 0.5);
    const clock = new THREE.Mesh(new THREE.CircleGeometry(0.2, 40), new THREE.MeshStandardMaterial({ map: clockTexture(), roughness: 0.5 }));
    clock.position.set(0.1, 2.25, 0.03);
    back.add(clock);
    const clockRim = new THREE.Mesh(new THREE.TorusGeometry(0.205, 0.018, 8, 40), frameMat);
    clockRim.position.set(0.1, 2.25, 0.03);
    back.add(clockRim);

    // Pencere (sol duvar) — gece
    const winTex = (() => {
      const c = document.createElement('canvas');
      c.width = 256;
      c.height = 320;
      const g = c.getContext('2d')!;
      const gr = g.createLinearGradient(0, 0, 0, 320);
      gr.addColorStop(0, '#0b1830');
      gr.addColorStop(1, '#1c2c48');
      g.fillStyle = gr;
      g.fillRect(0, 0, 256, 320);
      g.fillStyle = 'rgba(255,220,150,0.8)';
      for (let i = 0; i < 26; i++) g.fillRect(Math.random() * 256, 180 + Math.random() * 140, 3, 5);
      g.fillStyle = '#3b2414';
      g.fillRect(124, 0, 8, 320);
      g.fillRect(0, 150, 256, 8);
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    })();
    const win = new THREE.Mesh(
      new THREE.PlaneGeometry(1.0, 1.25),
      new THREE.MeshStandardMaterial({ map: winTex, emissive: '#ffffff', emissiveMap: winTex, emissiveIntensity: 0.5, roughness: 0.2 }),
    );
    win.position.set(-W / 2 + 0.02, floorY + 1.75, -1.4);
    win.rotation.y = Math.PI / 2;
    this.scene.add(win);
    const winFrame = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.37, 1.12), new THREE.MeshStandardMaterial({ color: '#3b2414', roughness: 0.6 }));
    winFrame.position.set(-W / 2 + 0.01, floorY + 1.75, -1.4);
    this.scene.add(winFrame);

    // Arka plan masaları
    const bgWood = new THREE.MeshStandardMaterial({ map: woodTexture('#4a2a14', '#1e0f06', 512, 512, 23), roughness: 0.45 });
    const bgFelt = new THREE.MeshStandardMaterial({ color: '#1d5a36', roughness: 0.95 });
    const chairMat = new THREE.MeshStandardMaterial({ map: woodTexture('#5a3118', '#2a1407', 256, 256, 9), roughness: 0.55 });
    const bgTables: [number, number, number, boolean][] = [[-2.3, -1.9, 0.35, true], [2.4, -2.0, -0.25, false]];
    for (const [x, z, ry, withTavla] of bgTables) {
      const g = new THREE.Group();
      const top = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.05, 1.0), bgWood);
      top.position.y = -0.025;
      top.castShadow = true;
      top.receiveShadow = true;
      g.add(top);
      const f = new THREE.Mesh(new THREE.PlaneGeometry(0.86, 0.86), bgFelt);
      f.rotation.x = -Math.PI / 2;
      f.position.y = 0.001;
      f.receiveShadow = true;
      g.add(f);
      const leg = new THREE.CylinderGeometry(0.035, 0.03, TABLE_H - 0.05, 10);
      for (const [lx, lz] of [[-0.42, -0.42], [0.42, -0.42], [-0.42, 0.42], [0.42, 0.42]]) {
        const l = new THREE.Mesh(leg, bgWood);
        l.position.set(lx, -(TABLE_H + 0.05) / 2, lz);
        g.add(l);
      }
      for (const [cx, cz, cr] of [[0, -0.75, Math.PI], [0, 0.75, 0], [0.75, 0, Math.PI / 2]] as [number, number, number][]) {
        const c = chair(chairMat);
        c.position.set(cx, -TABLE_H, cz);
        c.rotation.y = cr;
        g.add(c);
      }
      if (withTavla) {
        const tv = tavla(tavlaTexture(), bgWood);
        tv.rotation.y = 0.2;
        g.add(tv);
      } else {
        const gl = teaGlass();
        gl.position.set(0.2, 0, 0.1);
        g.add(gl);
        const gl2 = teaGlass();
        gl2.position.set(-0.25, 0, -0.2);
        g.add(gl2);
      }
      const { group: lamp } = hangingLamp();
      lamp.position.set(0, 1.4, 0);
      g.add(lamp);
      const pl = new THREE.PointLight('#ffc98a', 2.2, 3.5, 1.5);
      pl.position.set(0, 1.3, 0);
      g.add(pl);
      g.position.set(x, 0, z);
      g.rotation.y = ry;
      this.scene.add(g);
      this.background.push(g);
    }

    // Çay ocağı tezgahı
    const counter = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.0, 0.55), new THREE.MeshStandardMaterial({ map: wains, roughness: 0.6 }));
    body.position.y = 0.5;
    body.castShadow = true;
    counter.add(body);
    const ctop = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.05, 0.62), new THREE.MeshStandardMaterial({ color: '#d8d0c0', roughness: 0.3 }));
    ctop.position.y = 1.02;
    counter.add(ctop);
    const cay = caydanlik();
    cay.position.set(-0.3, 1.045, 0);
    counter.add(cay);
    for (let i = 0; i < 5; i++) {
      const gl = teaGlass();
      gl.position.set(0.15 + i * 0.12, 1.045, (i % 2) * 0.1 - 0.05);
      gl.scale.setScalar(0.8);
      counter.add(gl);
    }
    counter.position.set(2.6, floorY, -2.75);
    this.scene.add(counter);
    this.background.push(counter);
  }

  // ─── Kamera kontrolleri ─────────────────────────────────────────────────
  private bindControls() {
    const el = this.renderer.domElement;
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    el.addEventListener('pointerdown', (e) => {
      if (e.button !== 2) return;
      this.dragging = true;
      this.dragStart = { x: e.clientX, y: e.clientY, yaw: this.orbitGoal.yaw, pitch: this.orbitGoal.pitch };
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener('pointermove', (e) => {
      if (!this.dragging) return;
      const dx = (e.clientX - this.dragStart.x) / window.innerWidth;
      const dy = (e.clientY - this.dragStart.y) / window.innerHeight;
      this.orbitGoal.yaw = clamp(this.dragStart.yaw - dx * 2.2, -0.75, 0.75);
      this.orbitGoal.pitch = clamp(this.dragStart.pitch + dy * 1.6, 0.3, 1.4);
    });
    const end = () => (this.dragging = false);
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        this.orbitGoal.dist = clamp(this.orbitGoal.dist * (1 + Math.sign(e.deltaY) * 0.08), 1.1, 2.8);
      },
      { passive: false },
    );
  }

  setView(v: CameraView) {
    this.view = v;
    this.orbitGoal = { ...VIEWS[v] };
  }

  cycleView() {
    const order: CameraView[] = ['seat', 'top', 'low'];
    this.setView(order[(order.indexOf(this.view) + 1) % order.length]);
  }

  // ─── Kalite ─────────────────────────────────────────────────────────────
  setQuality(q: Quality) {
    this.quality = q;
    const dpr = window.devicePixelRatio || 1;
    this.renderer.setPixelRatio(q === 'low' ? Math.min(dpr, 1) : q === 'medium' ? Math.min(dpr, 1.5) : Math.min(dpr, 2));
    this.renderer.shadowMap.enabled = q !== 'low';
    const size = q === 'high' ? 2048 : 1024;
    if (this.lampLight.shadow.mapSize.x !== size) {
      this.lampLight.shadow.mapSize.set(size, size);
      this.lampLight.shadow.map?.dispose();
      (this.lampLight.shadow as { map: THREE.WebGLRenderTarget | null }).map = null;
    }
    for (const b of this.background) b.visible = q !== 'low';
    this.scene.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.Material | undefined;
      if (m) m.needsUpdate = true;
    });
    this.resize();
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h);
    const aspect = w / h;
    this.camera.aspect = aspect;
    // Dar ekranlarda masayı sığdırmak için görüş açısı ve mesafe uyarlanır
    this.camera.fov = aspect < 1 ? 58 : aspect < 1.4 ? 48 : 42;
    this.camera.updateProjectionMatrix();
  }

  /** Portre ekranda kamerayı geri çek */
  private distScale(): number {
    const a = this.camera.aspect;
    if (a >= 1.4) return 1;
    if (a >= 1) return 1.12;
    return Math.min(1.9, 1.15 / a);
  }

  onFrame(cb: (dt: number) => void) {
    this.frameCbs.push(cb);
  }

  start() {
    const frame = () => {
      const now = performance.now();
      const dt = Math.min(0.1, (now - this.last) / 1000);
      this.last = now;
      this.update(dt);
      this.renderer.render(this.scene, this.camera);
    };
    const loop = () => {
      requestAnimationFrame(loop);
      frame();
    };
    loop();
    // rAF kısıldığında (arka plan, gizli pencere) oyun akışı yine de ilerlesin
    window.setInterval(() => {
      if (performance.now() - this.last > 150) frame();
    }, 100);
  }

  private update(dt: number) {
    this.tweens.tick(dt);
    const k = 1 - Math.pow(0.001, dt);
    this.orbit.yaw += (this.orbitGoal.yaw - this.orbit.yaw) * k;
    this.orbit.pitch += (this.orbitGoal.pitch - this.orbit.pitch) * k;
    this.orbit.dist += (this.orbitGoal.dist - this.orbit.dist) * k;
    const d = this.orbit.dist * this.distScale();
    const cp = Math.cos(this.orbit.pitch);
    this.camera.position.set(
      this.target.x + Math.sin(this.orbit.yaw) * cp * d,
      this.target.y + Math.sin(this.orbit.pitch) * d,
      this.target.z + Math.cos(this.orbit.yaw) * cp * d,
    );
    this.camera.lookAt(this.target);
    // Lamba hafif titreşimi
    this.flicker += dt;
    this.lampLight.intensity = 30 + Math.sin(this.flicker * 7.3) * 0.25 + Math.sin(this.flicker * 13.1) * 0.15;
    for (const cb of this.frameCbs) cb(dt);
  }

  /** Kameranın önündeki bir derinlikte görünen yarı genişlik/yükseklik */
  visibleHalfSize(depth: number): { w: number; h: number } {
    const h = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * depth;
    return { w: h * this.camera.aspect, h };
  }
}

function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}

function roundedRect(w: number, h: number, r: number): THREE.Shape {
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
  return s;
}

/** Ekstrüzyon UV'lerini dünya ölçeğine göre ayarlar (ahşap damarı için) */
function normalizeUV(geo: THREE.BufferGeometry, scale: number) {
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const y = pos.getY(i);
    const alongX = Math.abs(z) > Math.abs(x);
    uv.setXY(i, (alongX ? x : z) * scale + 0.5, (alongX ? y : y) * scale * 4 + (alongX ? z : x) * 0.3);
  }
  uv.needsUpdate = true;
}
