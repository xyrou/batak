import * as THREE from 'three';

const V2 = (x: number, y: number) => new THREE.Vector2(x, y);

/** İnce belli çay bardağı + tabağı + kaşık */
export function teaGlass(): THREE.Group {
  const g = new THREE.Group();
  const s = 1.45;
  // Tabak
  const saucerProfile = [V2(0, 0), V2(0.045, 0), V2(0.058, 0.004), V2(0.066, 0.011), V2(0.064, 0.012), V2(0.054, 0.007), V2(0.02, 0.005), V2(0, 0.005)];
  const saucer = new THREE.Mesh(
    new THREE.LatheGeometry(saucerProfile.map((v) => v.multiplyScalar(s)), 40),
    new THREE.MeshStandardMaterial({ color: '#f4f1ea', roughness: 0.25, metalness: 0.0 }),
  );
  saucer.castShadow = true;
  saucer.receiveShadow = true;
  g.add(saucer);
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(0.0655 * s, 0.0012 * s, 6, 48),
    new THREE.MeshStandardMaterial({ color: '#b8913a', roughness: 0.3, metalness: 0.8 }),
  );
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.0115 * s;
  g.add(rim);

  // Bardak (lale formu)
  const glassProfile = [
    V2(0, 0.006), V2(0.02, 0.006), V2(0.022, 0.009), V2(0.021, 0.02), V2(0.017, 0.042),
    V2(0.0175, 0.055), V2(0.022, 0.075), V2(0.026, 0.095), V2(0.027, 0.104),
  ];
  const glass = new THREE.Mesh(
    new THREE.LatheGeometry(glassProfile.map((v) => v.clone().multiplyScalar(s)), 40),
    new THREE.MeshStandardMaterial({
      color: '#ffffff', roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.22,
      side: THREE.DoubleSide, depthWrite: false,
    }),
  );
  glass.renderOrder = 3;
  g.add(glass);
  // Çay
  const teaProfile = [V2(0, 0.012), V2(0.019, 0.012), V2(0.0195, 0.02), V2(0.0158, 0.042), V2(0.0163, 0.055), V2(0.0205, 0.075), V2(0.0235, 0.088), V2(0, 0.088)];
  const tea = new THREE.Mesh(
    new THREE.LatheGeometry(teaProfile.map((v) => v.clone().multiplyScalar(s)), 32),
    new THREE.MeshStandardMaterial({
      color: '#9a2c0a', roughness: 0.15, metalness: 0, transparent: true, opacity: 0.88,
      emissive: '#4a1002', emissiveIntensity: 0.6,
    }),
  );
  tea.renderOrder = 2;
  g.add(tea);
  // Kaşık
  const spoon = new THREE.Group();
  const handle = new THREE.Mesh(
    new THREE.BoxGeometry(0.075 * s, 0.0015, 0.005 * s),
    new THREE.MeshStandardMaterial({ color: '#d8d8d8', roughness: 0.2, metalness: 0.95 }),
  );
  handle.position.x = 0.0375 * s;
  spoon.add(handle);
  const bowl = new THREE.Mesh(
    new THREE.SphereGeometry(0.009 * s, 12, 8),
    handle.material,
  );
  bowl.scale.set(1.4, 0.25, 1);
  spoon.add(bowl);
  spoon.position.set(0.02 * s, 0.009 * s, 0.03 * s);
  spoon.rotation.y = -0.5;
  spoon.rotation.z = 0.05;
  g.add(spoon);
  return g;
}

/** Kehribar tespih */
export function tespih(): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: '#c46a17', roughness: 0.25, metalness: 0.05, emissive: '#3a1400', emissiveIntensity: 0.35,
  });
  const n = 33;
  const bead = new THREE.SphereGeometry(0.0075, 12, 10);
  const inst = new THREE.InstancedMesh(bead, mat, n);
  const m = new THREE.Matrix4();
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    // gevşekçe bırakılmış, hafif dalgalı halka
    const rx = 0.085 + Math.sin(t * 3) * 0.008;
    const rz = 0.05 + Math.cos(t * 2) * 0.01;
    m.makeTranslation(Math.cos(t) * rx, 0.0075, Math.sin(t) * rz);
    inst.setMatrixAt(i, m);
  }
  inst.castShadow = true;
  g.add(inst);
  // İmame ve püskül
  const imame = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.0065, 0.03, 12), mat);
  imame.rotation.z = Math.PI / 2;
  imame.position.set(0.1, 0.0065, 0);
  imame.castShadow = true;
  g.add(imame);
  const tassel = new THREE.Mesh(
    new THREE.ConeGeometry(0.008, 0.04, 10),
    new THREE.MeshStandardMaterial({ color: '#7a1020', roughness: 0.9 }),
  );
  tassel.rotation.z = -Math.PI / 2;
  tassel.position.set(0.135, 0.006, 0);
  tassel.castShadow = true;
  g.add(tassel);
  return g;
}

/** Yazboz defteri (üst yüzü canvas) ve kalem */
export function notepad(tex: THREE.Texture): THREE.Group {
  const g = new THREE.Group();
  const w = 0.2;
  const d = 0.27;
  const paper = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 });
  const side = new THREE.MeshStandardMaterial({ color: '#e8e0cc', roughness: 0.95 });
  const pad = new THREE.Mesh(new THREE.BoxGeometry(w, 0.008, d), [side, side, paper, side, side, side]);
  pad.position.y = 0.004;
  pad.castShadow = true;
  pad.receiveShadow = true;
  g.add(pad);
  const spiral = new THREE.Mesh(
    new THREE.BoxGeometry(w, 0.01, 0.014),
    new THREE.MeshStandardMaterial({ color: '#7a1826', roughness: 0.6 }),
  );
  spiral.position.set(0, 0.005, -d / 2 + 0.007);
  g.add(spiral);
  // Kalem
  const pencil = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0045, 0.0045, 0.16, 6),
    new THREE.MeshStandardMaterial({ color: '#e0a21a', roughness: 0.5 }),
  );
  body.rotation.z = Math.PI / 2;
  pencil.add(body);
  const tip = new THREE.Mesh(
    new THREE.ConeGeometry(0.0045, 0.02, 6),
    new THREE.MeshStandardMaterial({ color: '#e8c9a0', roughness: 0.8 }),
  );
  tip.rotation.z = Math.PI / 2;
  tip.position.x = 0.09;
  pencil.add(tip);
  const lead = new THREE.Mesh(
    new THREE.ConeGeometry(0.0015, 0.006, 6),
    new THREE.MeshStandardMaterial({ color: '#222', roughness: 0.5 }),
  );
  lead.rotation.z = Math.PI / 2;
  lead.position.x = 0.1015;
  pencil.add(lead);
  const eraser = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0047, 0.0047, 0.012, 10),
    new THREE.MeshStandardMaterial({ color: '#d46a7a', roughness: 0.8 }),
  );
  eraser.rotation.z = Math.PI / 2;
  eraser.position.x = -0.086;
  pencil.add(eraser);
  pencil.traverse((o) => ((o as THREE.Mesh).castShadow = true));
  pencil.position.set(0.02, 0.013, 0.05);
  pencil.rotation.y = 0.7;
  g.add(pencil);
  return g;
}

/** Ahşap sandalye */
export function chair(woodMat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const add = (geo: THREE.BufferGeometry, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(geo, woodMat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
    return m;
  };
  const seatH = 0.46;
  add(new THREE.BoxGeometry(0.44, 0.03, 0.42), 0, seatH, 0);
  const leg = new THREE.CylinderGeometry(0.018, 0.015, seatH, 8);
  for (const [x, z] of [[-0.19, -0.18], [0.19, -0.18], [-0.19, 0.18], [0.19, 0.18]]) add(leg, x, seatH / 2, z);
  const post = new THREE.CylinderGeometry(0.018, 0.018, 0.5, 8);
  add(post, -0.19, seatH + 0.25, 0.19);
  add(post, 0.19, seatH + 0.25, 0.19);
  add(new THREE.BoxGeometry(0.42, 0.07, 0.025), 0, seatH + 0.46, 0.19);
  add(new THREE.BoxGeometry(0.42, 0.04, 0.02), 0, seatH + 0.3, 0.19);
  const rung = new THREE.CylinderGeometry(0.01, 0.01, 0.38, 6);
  const r1 = add(rung, 0, 0.15, -0.18);
  r1.rotation.z = Math.PI / 2;
  const r2 = add(rung, 0, 0.15, 0.18);
  r2.rotation.z = Math.PI / 2;
  // Hasır oturak
  const straw = new THREE.Mesh(
    new THREE.BoxGeometry(0.38, 0.012, 0.36),
    new THREE.MeshStandardMaterial({ color: '#b8904f', roughness: 1 }),
  );
  straw.position.set(0, seatH + 0.02, 0);
  straw.receiveShadow = true;
  g.add(straw);
  return g;
}

/** Tavanda sarkan emaye yeşil lamba; içinde ışık kaynağı yok (dışarıdan eklenir) */
export function hangingLamp(): { group: THREE.Group; bulb: THREE.Mesh } {
  const g = new THREE.Group();
  const shadeProfile = [V2(0.02, 0.2), V2(0.05, 0.19), V2(0.12, 0.1), V2(0.2, 0.01), V2(0.205, 0.0)];
  const outer = new THREE.Mesh(
    new THREE.LatheGeometry(shadeProfile, 40),
    new THREE.MeshStandardMaterial({ color: '#1f4a2f', roughness: 0.35, metalness: 0.3, side: THREE.FrontSide }),
  );
  g.add(outer);
  const inner = new THREE.Mesh(
    new THREE.LatheGeometry(shadeProfile.map((v) => new THREE.Vector2(v.x - 0.002, v.y)), 40),
    new THREE.MeshStandardMaterial({ color: '#fff4dc', roughness: 0.6, emissive: '#ffcf8a', emissiveIntensity: 0.35, side: THREE.BackSide }),
  );
  g.add(inner);
  const cord = new THREE.Mesh(
    new THREE.CylinderGeometry(0.005, 0.005, 2, 6),
    new THREE.MeshStandardMaterial({ color: '#111', roughness: 0.8 }),
  );
  cord.position.y = 1.2;
  g.add(cord);
  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.035, 16, 12),
    new THREE.MeshStandardMaterial({ color: '#fff3d6', emissive: '#ffd79a', emissiveIntensity: 4 }),
  );
  bulb.position.y = 0.06;
  g.add(bulb);
  return { group: g, bulb };
}

/** Çaydanlık (demlik üstte) */
export function caydanlik(): THREE.Group {
  const g = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: '#c9c9c9', roughness: 0.25, metalness: 0.9 });
  const bottom = new THREE.Mesh(
    new THREE.LatheGeometry([V2(0, 0), V2(0.1, 0), V2(0.12, 0.05), V2(0.11, 0.14), V2(0.07, 0.17), V2(0, 0.17)], 32),
    metal,
  );
  g.add(bottom);
  const top = new THREE.Mesh(
    new THREE.LatheGeometry([V2(0, 0.17), V2(0.06, 0.17), V2(0.075, 0.22), V2(0.065, 0.27), V2(0.02, 0.29), V2(0, 0.3)], 32),
    new THREE.MeshStandardMaterial({ color: '#f1efe8', roughness: 0.3 }),
  );
  g.add(top);
  const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.015, 0.12, 8), metal);
  spout.position.set(0.12, 0.12, 0);
  spout.rotation.z = -0.9;
  g.add(spout);
  g.traverse((o) => ((o as THREE.Mesh).castShadow = true));
  return g;
}

/** Tavla kutusu (açık) */
export function tavla(tex: THREE.Texture, woodMat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const board = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.03, 0.375),
    [woodMat, woodMat, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 }), woodMat, woodMat, woodMat],
  );
  board.position.y = 0.015;
  board.castShadow = true;
  board.receiveShadow = true;
  g.add(board);
  const pul = new THREE.CylinderGeometry(0.018, 0.018, 0.008, 20);
  const white = new THREE.MeshStandardMaterial({ color: '#efe6d2', roughness: 0.4 });
  const black = new THREE.MeshStandardMaterial({ color: '#2a1a12', roughness: 0.4 });
  const spots: [number, number, number, boolean][] = [
    [-0.21, -0.15, 5, true], [0.21, -0.15, 2, false], [-0.05, 0.15, 3, true], [0.08, 0.15, 5, false],
    [-0.21, 0.15, 5, false], [0.21, 0.15, 2, true], [-0.05, -0.15, 3, false], [0.08, -0.15, 5, true],
  ];
  for (const [x, z, n, w] of spots) {
    for (let i = 0; i < n; i++) {
      const p = new THREE.Mesh(pul, w ? white : black);
      p.position.set(x, 0.034, z + (z < 0 ? 1 : -1) * i * 0.036);
      p.castShadow = true;
      g.add(p);
    }
  }
  return g;
}
