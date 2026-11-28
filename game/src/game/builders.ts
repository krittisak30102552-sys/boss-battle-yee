import * as THREE from "three";

/* ------------------------------------------------------------------ */
/*  Tiny helpers – every character is a pile of simple primitives.     */
/* ------------------------------------------------------------------ */

export interface MatOpts {
  emissive?: number;
  ei?: number;
  metal?: number;
  rough?: number;
}

export function stdMat(color: number, o: MatOpts = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    metalness: o.metal ?? 0.55,
    roughness: o.rough ?? 0.4,
    emissive: o.emissive ?? 0x000000,
    emissiveIntensity: o.ei ?? 1,
  });
}

export function box(
  parent: THREE.Object3D,
  w: number,
  h: number,
  d: number,
  color: number,
  x = 0,
  y = 0,
  z = 0,
  o: MatOpts = {}
) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), stdMat(color, o));
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = false;
  parent.add(m);
  return m;
}

export interface XForm {
  rx?: number;
  ry?: number;
  rz?: number;
  sx?: number;
  sy?: number;
  sz?: number;
}

/** any geometry, with optional rotation / scale */
export function part(
  parent: THREE.Object3D,
  geo: THREE.BufferGeometry,
  color: number,
  x = 0,
  y = 0,
  z = 0,
  o: MatOpts & XForm = {}
) {
  const m = new THREE.Mesh(geo, stdMat(color, o));
  m.position.set(x, y, z);
  m.rotation.set(o.rx ?? 0, o.ry ?? 0, o.rz ?? 0);
  m.scale.set(o.sx ?? 1, o.sy ?? 1, o.sz ?? 1);
  m.castShadow = true;
  m.receiveShadow = false;
  parent.add(m);
  return m;
}

export function boxR(
  parent: THREE.Object3D,
  w: number,
  h: number,
  d: number,
  color: number,
  x: number,
  y: number,
  z: number,
  rot: XForm,
  o: MatOpts = {}
) {
  const m = box(parent, w, h, d, color, x, y, z, o);
  m.rotation.set(rot.rx ?? 0, rot.ry ?? 0, rot.rz ?? 0);
  return m;
}

export function pivot(parent: THREE.Object3D, x = 0, y = 0, z = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}

/** flat extruded polygon (points in the XY plane, extruded along Z, centred on Z) */
export function polyGeo(pts: Array<[number, number]>, depth: number) {
  const s = new THREE.Shape();
  pts.forEach(([x, y], i) => (i === 0 ? s.moveTo(x, y) : s.lineTo(x, y)));
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false });
  g.translate(0, 0, -depth / 2);
  return g;
}

/** pointed fin / blade panel standing along +Y */
export function finGeo(len: number, w: number, depth: number) {
  return polyGeo(
    [
      [-w * 0.5, 0],
      [w * 0.5, 0],
      [w * 0.42, len * 0.62],
      [w * 0.12, len * 0.94],
      [-w * 0.02, len],
      [-w * 0.42, len * 0.7],
    ],
    depth
  );
}

/* flash support (hit feedback) */
export interface FlashMat {
  mat: THREE.MeshStandardMaterial;
  flashable: boolean;
}

export function collectMats(root: THREE.Object3D): FlashMat[] {
  const out: FlashMat[] = [];
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && m.material instanceof THREE.MeshStandardMaterial) {
      out.push({ mat: m.material, flashable: m.material.emissive.getHex() === 0 });
    }
  });
  return out;
}

const tmpC = new THREE.Color();
export function setFlash(mats: FlashMat[], v: number, r: number, g: number, b: number) {
  for (const f of mats) {
    if (!f.flashable) continue;
    f.mat.emissive.copy(tmpC.setRGB(r * v, g * v, b * v));
  }
}

/* ------------------------------------------------------------------ */
/*  IRON MAN – MARK 85 (LXXXV) – nanotech armor from Avengers: Endgame */
/*   red   : chest, forearms, hips, shins                              */
/*   gold  : face, shoulders, upper arms, abdomen, thighs              */
/*   silver: exposed joints / structure between the plates             */
/* ------------------------------------------------------------------ */

export interface WingFin {
  pivot: THREE.Group;
  side: number; // +1 / -1
  open: number; // z-rotation when fully deployed (rad)
  fold: number; // z-rotation when folded (rad)
  len: number;
}

export interface IronRig {
  root: THREE.Group;
  body: THREE.Group;
  head: THREE.Group;
  chest: THREE.Mesh;
  shR: THREE.Group;
  elR: THREE.Group;
  handR: THREE.Group;
  shL: THREE.Group;
  elL: THREE.Group;
  handL: THREE.Group;
  hipR: THREE.Group;
  kneeR: THREE.Group;
  hipL: THREE.Group;
  kneeL: THREE.Group;
  flames: THREE.Mesh[];
  handFlames: THREE.Mesh[];
  backThrusters: THREE.Mesh[];
  mats: FlashMat[];
  /* nano weapon mount points */
  mountC: THREE.Group; // chest (arc reactor) – uni-beam
  mountBack: THREE.Group; // back frame – Nano Lightning Refocuser fins
  mountSR: THREE.Group; // right shoulder – zero cannon / micro-missiles
  mountSL: THREE.Group; // left shoulder
  mountFR: THREE.Group; // right foot – foot uni-beam
  mountFL: THREE.Group; // left foot
  /* Nano Lightning Refocuser */
  wings: WingFin[];
  wingGlow: THREE.Mesh[];
  reactorGlow: THREE.Mesh;
  damageStages: THREE.Group[];
}

export const RED = 0xd01c28;
const DARKRED = 0x6a0910;
export const GOLD = 0xf6c04a;
const SILVER = 0x9aa3ad;
const GUN = 0x2a2e36;
const EYE = 0xe6fbff;
void DARKRED;

export function buildIronMan(): IronRig {
  const root = new THREE.Group();
  const armorRoot = new THREE.Group();
  root.add(armorRoot);
  const body = pivot(armorRoot, 0, 1.0, 0);
  const R = { metal: 0.38, rough: 0.34 }; // candy red
  const G = { metal: 0.42, rough: 0.32 }; // gold
  const S = { metal: 0.6, rough: 0.4 }; // silver

  /* ---------------- pelvis ---------------- */
  box(armorRoot, 0.62, 0.2, 0.38, RED, 0, 0.99, 0, R);
  box(armorRoot, 0.66, 0.045, 0.4, GOLD, 0, 1.1, 0, G);
  box(armorRoot, 0.2, 0.17, 0.05, GOLD, 0, 0.97, 0.2, G);
  boxR(armorRoot, 0.1, 0.2, 0.34, RED, 0.34, 0.97, 0, { rz: -0.2 }, R);
  boxR(armorRoot, 0.1, 0.2, 0.34, RED, -0.34, 0.97, 0, { rz: 0.2 }, R);

  /* ---------------- abdomen: gold slats over a dark core ---------------- */
  box(body, 0.36, 0.34, 0.26, GUN, 0, 0.14, 0, S);
  for (let i = 0; i < 3; i++) {
    box(body, 0.47 - i * 0.03, 0.08, 0.33 - i * 0.02, GOLD, 0, 0.03 + i * 0.105, 0.02, G);
  }

  /* ---------------- chest: layered red plates ---------------- */
  box(body, 0.74, 0.5, 0.42, RED, 0, 0.57, 0, R);
  boxR(body, 0.62, 0.12, 0.4, RED, 0, 0.31, 0.015, { rx: 0.1 }, R);
  // pectoral plates (angled)
  boxR(body, 0.33, 0.3, 0.12, RED, 0.2, 0.64, 0.22, { rx: -0.14, rz: -0.06 }, R);
  boxR(body, 0.33, 0.3, 0.12, RED, -0.2, 0.64, 0.22, { rx: -0.14, rz: 0.06 }, R);
  // lower layered chest plates
  boxR(body, 0.5, 0.1, 0.1, RED, 0, 0.42, 0.22, { rx: 0.12 }, R);
  // gold trim lines flowing from the reactor
  boxR(body, 0.3, 0.028, 0.035, GOLD, 0.2, 0.47, 0.265, { rz: 0.5 }, G);
  boxR(body, 0.3, 0.028, 0.035, GOLD, -0.2, 0.47, 0.265, { rz: -0.5 }, G);
  box(body, 0.026, 0.22, 0.035, GOLD, 0.355, 0.62, 0.22, G);
  box(body, 0.026, 0.22, 0.035, GOLD, -0.355, 0.62, 0.22, G);
  // side ribs
  box(body, 0.06, 0.36, 0.34, GOLD, 0.385, 0.5, 0, G);
  box(body, 0.06, 0.36, 0.34, GOLD, -0.385, 0.5, 0, G);
  // collar yoke + trapezius
  box(body, 0.6, 0.07, 0.44, GOLD, 0, 0.84, 0, G);
  boxR(body, 0.22, 0.08, 0.36, GOLD, 0.3, 0.87, 0, { rz: -0.35 }, G);
  boxR(body, 0.22, 0.08, 0.36, GOLD, -0.3, 0.87, 0, { rz: 0.35 }, G);

  // triangular arc reactor (point-down) in a silver frame
  const frame = part(body, polyGeo([[-0.135, 0.105], [0.135, 0.105], [0, -0.135]], 0.02), SILVER, 0, 0.555, 0.238, { metal: 0.85, rough: 0.3 });
  frame.castShadow = false;
  const chest = part(body, polyGeo([[-0.088, 0.068], [0.088, 0.068], [0, -0.088]], 0.04), 0xaaf4ff, 0, 0.555, 0.252, {
    emissive: 0x55ddff,
    ei: 4,
    metal: 0,
  });
  chest.castShadow = false;
  const reactorGlow = part(body, new THREE.CircleGeometry(0.05, 18), 0xffffff, 0, 0.552, 0.276, { emissive: 0xffffff, ei: 3, metal: 0 });
  reactorGlow.castShadow = false;
  // Progressive cosmetic battle damage: paint scuffs, fractures, then missing armor panels.
  const damageStages: THREE.Group[] = [];
  const lightDamage = new THREE.Group();
  body.add(lightDamage);
  const scratchDark = 0x29242a;
  const bareMetal = 0xb7c0c8;
  const paintDust = 0x8b3438;
  const scratch = (parent: THREE.Object3D, x: number, y: number, z: number, w: number, rz: number, color = scratchDark) => {
    const mark = boxR(parent, w, 0.012, 0.009, color, x, y, z, { rz }, { metal: 0.2, rough: 0.95 });
    mark.castShadow = false;
  };
  [
    [0.16,0.69,0.296,0.16,-0.55],[-0.18,0.53,0.296,0.12,0.7],
    [0.25,0.72,0.205,0.19,-0.8],[-0.25,0.72,0.205,0.14,0.8],
    [0.02,0.39,0.25,0.13,-0.25],[-0.31,0.62,0.25,0.11,0.35],
    [0.38,0.54,0.19,0.12,-0.9],[-0.39,0.48,0.19,0.15,0.65],
    [0.08,0.82,0.21,0.09,0.4],[-0.08,0.82,0.21,0.12,-0.5],
    [0.2,0.58,0.296,0.08,0.9],[-0.05,0.65,0.298,0.07,-0.7],
  ].forEach(([x,y,z,w,rz]) => scratch(lightDamage,x,y,z,w,rz));
  scratch(lightDamage,0.17,0.685,0.302,0.095,-0.55,bareMetal);
  scratch(lightDamage,-0.19,0.525,0.302,0.07,0.7,bareMetal);
  scratch(lightDamage,0.26,0.715,0.212,0.11,-0.8,paintDust);
  lightDamage.visible = false;

  const crackedDamage = new THREE.Group();
  body.add(crackedDamage);
  const crack = (pts: Array<[number,number]>, z: number) => {
    const mesh = part(crackedDamage, polyGeo(pts, 0.012), 0x17191d, 0, 0, z, { metal: 0.25, rough: 0.95 });
    mesh.castShadow = false;
  };
  crack([[0.02,0.78],[0.07,0.72],[0.045,0.68],[0.11,0.63],[0.08,0.58],[0.14,0.53],[0.1,0.49]],0.303);
  crack([[-0.22,0.77],[-0.17,0.71],[-0.2,0.67],[-0.12,0.62],[-0.15,0.57]],0.303);
  crack([[0.3,0.76],[0.25,0.7],[0.29,0.66],[0.22,0.61],[0.25,0.57]],0.23);
  crack([[-0.31,0.58],[-0.26,0.55],[-0.29,0.5],[-0.21,0.46]],0.23);
  scratch(crackedDamage,0.075,0.69,0.311,0.12,-0.9,bareMetal);
  scratch(crackedDamage,-0.17,0.69,0.311,0.09,0.8,bareMetal);
  crackedDamage.visible = false;

  const severeDamage = new THREE.Group();
  body.add(severeDamage);
  const hole = part(severeDamage, polyGeo([[-0.13,0.13],[0.02,0.18],[0.12,0.1],[0.1,-0.02],[0.02,-0.1],[-0.1,-0.06]],0.018), 0x171b22, -0.22, 0.57, 0.305, { metal: 0.35, rough: 0.9 });
  hole.castShadow = false;
  const inner = part(severeDamage, polyGeo([[-0.07,0.08],[0.02,0.1],[0.07,0.02],[0.01,-0.06],[-0.06,-0.03]],0.02), 0x89949e, -0.22, 0.57, 0.318, { metal: 0.8, rough: 0.45 });
  inner.castShadow = false;
  const hole2 = part(severeDamage, polyGeo([[-0.09,0.1],[0.08,0.12],[0.12,0.02],[0.04,-0.09],[-0.08,-0.05]],0.018), 0x171b22, 0.25, 0.69, 0.22, { metal: 0.35, rough: 0.9 });
  hole2.castShadow = false;
  const inner2 = part(severeDamage, polyGeo([[-0.05,0.06],[0.05,0.07],[0.07,0],[-0.02,-0.05]],0.02), 0x89949e, 0.25, 0.69, 0.233, { metal: 0.8, rough: 0.45 });
  inner2.castShadow = false;
  const shard1 = part(severeDamage, polyGeo([[0,0.08],[0.13,0.02],[0.08,-0.1],[-0.02,-0.03]],0.045), RED, 0.42, 0.57, 0.22, { rz: -0.45, metal: 0.45, rough: 0.38 });
  const shard2 = part(severeDamage, polyGeo([[0,0.06],[0.1,0.02],[0.03,-0.08],[-0.04,-0.02]],0.04), GOLD, -0.48, 0.73, 0.18, { rz: 0.6, metal: 0.45, rough: 0.38 });
  shard1.castShadow = shard2.castShadow = false;
  severeDamage.visible = false;
  damageStages.push(lightDamage, crackedDamage, severeDamage);

  /* ---------------- back plating + nano frame ---------------- */
  box(body, 0.52, 0.5, 0.1, GOLD, 0, 0.54, -0.26, G);
  box(body, 0.4, 0.32, 0.06, RED, 0, 0.62, -0.33, R);
  box(body, 0.26, 0.2, 0.1, GUN, 0, 0.66, -0.39, S); // nano storage frame
  box(body, 0.05, 0.16, 0.05, 0x9defff, 0, 0.66, -0.45, { emissive: 0x55ddff, ei: 2.5, metal: 0 });
  const mountBack = pivot(body, 0, 0.62, -0.42);
  const mountC = pivot(body, 0, 0.555, 0.27);
  const mountSR = pivot(body, -0.56, 1.0, -0.06);
  const mountSL = pivot(body, 0.56, 1.0, -0.06);

  /* ---------------- Nano Lightning Refocuser (back fins) ---------------- */
  const wings: WingFin[] = [];
  const wingGlow: THREE.Mesh[] = [];
  const finDefs = [
    { len: 1.45, w: 0.22, open: 0.72, fold: 0.07, y: 0.1, x: 0.16 },
    { len: 1.1, w: 0.19, open: 1.18, fold: 0.15, y: 0.02, x: 0.2 },
    { len: 0.82, w: 0.16, open: 1.72, fold: 0.23, y: -0.06, x: 0.24 },
  ];
  for (const side of [-1, 1]) {
    for (const f of finDefs) {
      const p = pivot(mountBack, side * f.x, f.y, 0);
      part(p, finGeo(f.len, f.w, 0.035), RED, 0, 0, 0, R);
      part(p, finGeo(f.len * 0.9, f.w * 0.42, 0.045), GOLD, 0, f.len * 0.03, 0, G);
      const glow = part(p, finGeo(f.len * 0.78, f.w * 0.2, 0.05), 0xdff9ff, 0, f.len * 0.08, 0, { emissive: 0x55ddff, ei: 1.6, metal: 0 });
      glow.castShadow = false;
      wingGlow.push(glow);
      box(p, f.w * 0.9, 0.03, 0.05, SILVER, 0, f.len * 0.3, 0, S);
      wings.push({ pivot: p, side, open: f.open, fold: f.fold, len: f.len });
    }
  }

  /* ---------------- helmet ---------------- */
  const head = pivot(body, 0, 0.98, 0);
  part(head, new THREE.CylinderGeometry(0.07, 0.09, 0.16, 10), SILVER, 0, -0.2, 0, S);
  part(head, new THREE.SphereGeometry(0.19, 20, 16), RED, 0, 0.05, -0.025, { ...R, sx: 0.95, sy: 1.08, sz: 1.1 }); // crown
  box(head, 0.26, 0.31, 0.07, GOLD, 0, -0.02, 0.15, G); // faceplate
  box(head, 0.19, 0.1, 0.09, GOLD, 0, -0.17, 0.13, G); // chin
  box(head, 0.28, 0.07, 0.08, GOLD, 0, 0.14, 0.14, G); // forehead band
  box(head, 0.05, 0.14, 0.05, GOLD, 0, 0.0, 0.2, G); // nose ridge
  box(head, 0.045, 0.22, 0.2, GOLD, 0.145, -0.04, 0.05, G); // cheek plates
  box(head, 0.045, 0.22, 0.2, GOLD, -0.145, -0.04, 0.05, G);
  boxR(head, 0.09, 0.03, 0.025, EYE, 0.07, 0.045, 0.192, { rz: -0.2 }, { emissive: 0x7fe6ff, ei: 5, metal: 0 });
  boxR(head, 0.09, 0.03, 0.025, EYE, -0.07, 0.045, 0.192, { rz: 0.2 }, { emissive: 0x7fe6ff, ei: 5, metal: 0 });
  box(head, 0.1, 0.014, 0.025, GUN, 0, -0.1, 0.192, S); // mouth slit

  const flames: THREE.Mesh[] = [];
  const handFlames: THREE.Mesh[] = [];
  const mkFlameGeo = (r: number, len: number) => {
    const g = new THREE.ConeGeometry(r, len, 10, 1, true);
    g.rotateX(Math.PI);
    g.translate(0, -len / 2, 0);
    return g;
  };
  const flameOuterGeo = mkFlameGeo(0.14, 0.95);
  const flameInnerGeo = mkFlameGeo(0.07, 0.62);
  const palmOuterGeo = mkFlameGeo(0.09, 0.6);
  const palmInnerGeo = mkFlameGeo(0.045, 0.38);
  const flameMat = (r: number, g: number, b: number, op: number) =>
    new THREE.MeshBasicMaterial({ color: new THREE.Color(r, g, b), transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const addFlame = (parent: THREE.Object3D, x: number, y: number, z: number, hand: boolean) => {
    const o = new THREE.Mesh(hand ? palmOuterGeo : flameOuterGeo, flameMat(2.4, 1.1, 0.3, 0.75));
    const n = new THREE.Mesh(hand ? palmInnerGeo : flameInnerGeo, flameMat(1.6, 2.4, 3.0, 0.95));
    n.userData.inner = true;
    for (const m of [o, n]) {
      m.position.set(x, y, z);
      m.visible = false;
      m.frustumCulled = false;
      parent.add(m);
      flames.push(m);
      if (hand) handFlames.push(m);
    }
  };

  /* ---------------- arms ---------------- */
  const makeArm = (side: number) => {
    const sh = pivot(body, side * 0.54, 0.74, 0);
    // gold shoulder: cap + pauldron + red inner plate
    part(sh, new THREE.SphereGeometry(0.17, 14, 10), GOLD, 0, 0.0, 0, { ...G, sx: 1.2, sy: 0.9 });
    boxR(sh, 0.34, 0.09, 0.36, GOLD, side * 0.04, 0.1, 0, { rz: -side * 0.28 }, G);
    boxR(sh, 0.2, 0.06, 0.24, RED, side * 0.04, 0.16, 0, { rz: -side * 0.28 }, R);
    // upper arm: gold core, red side plates
    box(sh, 0.19, 0.4, 0.19, GOLD, 0, -0.22, 0, G);
    box(sh, 0.05, 0.3, 0.17, RED, side * 0.115, -0.22, 0, R);
    box(sh, 0.05, 0.3, 0.17, RED, -side * 0.115, -0.22, 0, R);
    part(sh, new THREE.SphereGeometry(0.085, 10, 8), SILVER, 0, -0.43, 0, S);
    const el = pivot(sh, 0, -0.44, 0);
    // forearm: red, flared, gold cuff + front strip
    box(el, 0.23, 0.2, 0.23, RED, 0, -0.12, 0, R);
    box(el, 0.19, 0.3, 0.2, RED, 0, -0.28, 0, R);
    box(el, 0.09, 0.26, 0.045, GOLD, 0, -0.26, 0.115, G);
    box(el, 0.215, 0.05, 0.215, GOLD, 0, -0.4, 0, G);
    box(el, 0.05, 0.22, 0.16, GOLD, side * 0.12, -0.17, -0.03, G);
    const hand = pivot(el, 0, -0.46, 0);
    box(hand, 0.15, 0.16, 0.16, RED, 0, -0.05, 0, R);
    box(hand, 0.13, 0.07, 0.04, SILVER, 0, -0.14, 0.07, S); // fingers
    part(hand, new THREE.CylinderGeometry(0.045, 0.045, 0.02, 14), 0xaaf4ff, 0, -0.14, 0, { emissive: 0x55ddff, ei: 3, metal: 0 }); // palm repulsor
    return { sh, el, hand };
  };
  const aR = makeArm(-1); // character's right = screen right when seen from behind
  const aL = makeArm(1);
  // palm repulsor-thrusters (visible while flying)
  addFlame(aR.hand, 0, -0.14, 0, true);
  addFlame(aL.hand, 0, -0.14, 0, true);

  /* ---------------- back thruster pods + helmet fins ---------------- */
  const backThrusters: THREE.Mesh[] = [];
  for (const sx of [-1, 1]) {
    part(body, new THREE.CylinderGeometry(0.06, 0.075, 0.2, 10), GUN, sx * 0.16, 0.32, -0.34, S);
    const g = part(body, new THREE.CylinderGeometry(0.045, 0.045, 0.02, 10), 0x9defff, sx * 0.16, 0.21, -0.34, { emissive: 0x55ddff, ei: 3, metal: 0 });
    g.castShadow = false;
    backThrusters.push(g);
    boxR(head, 0.03, 0.14, 0.13, GOLD, sx * 0.19, 0.0, -0.02, { rz: -sx * 0.15 }, G); // ear fin
  }

  /* ---------------- legs ---------------- */
  const makeLeg = (side: number) => {
    const hip = pivot(armorRoot, side * 0.2, 1.0, 0);
    part(hip, new THREE.SphereGeometry(0.1, 10, 8), SILVER, 0, -0.02, 0, S);
    // thigh: gold with a red outer plate
    box(hip, 0.26, 0.5, 0.28, GOLD, 0, -0.27, 0, G);
    box(hip, 0.04, 0.32, 0.2, RED, side * 0.15, -0.26, 0, R);
    box(hip, 0.18, 0.06, 0.3, RED, 0, -0.08, 0, R);
    const knee = pivot(hip, 0, -0.52, 0);
    part(knee, new THREE.SphereGeometry(0.09, 10, 8), SILVER, 0, 0, 0, S);
    boxR(knee, 0.22, 0.15, 0.14, RED, 0, 0.02, 0.14, { rx: -0.2 }, R); // kneecap
    // shin: red, gold front strip + gold calf
    box(knee, 0.24, 0.42, 0.26, RED, 0, -0.24, 0, R);
    box(knee, 0.11, 0.3, 0.045, GOLD, 0, -0.24, 0.15, G);
    box(knee, 0.2, 0.28, 0.06, GOLD, 0, -0.26, -0.15, G);
    // boot
    box(knee, 0.26, 0.1, 0.44, RED, 0, -0.46, 0.08, R);
    box(knee, 0.2, 0.06, 0.14, GOLD, 0, -0.43, 0.24, G);
    const foot = pivot(knee, 0, -0.92, 0.05);
    addFlame(knee, 0, -0.9, 0.05, false);
    // sole thruster glow
    const sole = box(knee, 0.16, 0.03, 0.2, 0xaaf4ff, 0, -0.9, 0.08, { emissive: 0x55ddff, ei: 3, metal: 0 });
    sole.castShadow = false;
    return { hip, knee, foot };
  };
  const lR = makeLeg(-1);
  const lL = makeLeg(1);

  return {
    root,
    body,
    head,
    chest,
    shR: aR.sh,
    elR: aR.el,
    handR: aR.hand,
    shL: aL.sh,
    elL: aL.el,
    handL: aL.hand,
    hipR: lR.hip,
    kneeR: lR.knee,
    hipL: lL.hip,
    kneeL: lL.knee,
    flames,
    handFlames,
    backThrusters,
    mats: collectMats(armorRoot),
    mountC,
    mountBack,
    mountSR,
    mountSL,
    mountFR: lR.foot,
    mountFL: lL.foot,
    wings,
    wingGlow,
    reactorGlow,
    damageStages,
  };
}

/* ------------------------------------------------------------------ */
/*  THANOS – 3 skins: Mad Titan / Titan Warlord / Void Tyrant          */
/* ------------------------------------------------------------------ */

export type ThanosSkin = "titan" | "warlord" | "void";

export interface ThanosSkinInfo {
  id: ThanosSkin;
  name: string;
  th: string;
  desc: string;
  color: string;
  aura: number;
}

export const THANOS_SKINS: ThanosSkinInfo[] = [
  { id: "titan", name: "MAD TITAN", th: "ไททันคลั่ง", desc: "ธานอสแบบดั้งเดิม — ผิวม่วง เสื้อกั๊กดำ สายคาดทอง", color: "#a06ad0", aura: 0xb070ff },
  { id: "warlord", name: "TITAN WARLORD", th: "จอมสงครามไททัน", desc: "เกราะศึกสีเหล็กน้ำเงิน ไหล่เหล็กแหลม ผ้าคลุมสงคราม", color: "#6f8fc8", aura: 0xffd060 },
  { id: "void", name: "VOID TYRANT", th: "จอมทรราชแห่งความว่างเปล่า", desc: "เกราะออบซิเดียน เส้นเลือดเรืองแดง มงกุฎเขา ผ้าคลุมเปลวเพลิง", color: "#ff3a2a", aura: 0xff3020 },
];

export interface ClothSeg {
  pivot: THREE.Group;
  base: number;
  amp: number;
  phase: number;
}

export interface ThanosRig {
  root: THREE.Group;
  body: THREE.Group;
  head: THREE.Group;
  shR: THREE.Group; // punching arm
  elR: THREE.Group;
  handR: THREE.Group;
  shL: THREE.Group; // gauntlet arm
  elL: THREE.Group;
  handL: THREE.Group;
  muzzle: THREE.Object3D;
  hipR: THREE.Group;
  kneeR: THREE.Group;
  hipL: THREE.Group;
  kneeL: THREE.Group;
  stones: THREE.Mesh[];
  halos: THREE.Mesh[];
  eyes: THREE.Mesh[];
  cloth: ClothSeg[];
  veins: THREE.Mesh[];
  skin: ThanosSkin;
  mats: FlashMat[];
}

export const THANOS_SCALE = 2.6;

const PAL: Record<ThanosSkin, Record<string, number>> = {
  titan: { skin: 0x865aae, skin2: 0x6f4796, skinD: 0x4e2f6e, armor: 0x1b1a2a, armor2: 0x2a2840, trim: 0xd4a037, belt: 0x6b4a26, pants: 0x5b4a39, boot: 0x43362a, gaunt: 0xb78a30, eye: 0xffd24a, cloth: 0x5a1620 },
  warlord: { skin: 0x8a62b2, skin2: 0x724a9a, skinD: 0x4e2f6e, armor: 0x3a4766, armor2: 0x55668a, trim: 0xe3b84c, belt: 0x20263a, pants: 0x2b3040, boot: 0x232736, gaunt: 0xc79a3a, eye: 0xffe08a, cloth: 0x2a3550 },
  void: { skin: 0x4c3669, skin2: 0x3b2a55, skinD: 0x1f1430, armor: 0x0f0c16, armor2: 0x1e1927, trim: 0x9c1424, belt: 0x15111c, pants: 0x16121e, boot: 0x0e0c14, gaunt: 0x2a1d30, eye: 0xff3a2a, cloth: 0x3a0710 },
};

export function buildThanos(skin: ThanosSkin = "titan"): ThanosRig {
  const c = PAL[skin];
  const SKIN = c.skin, SKIN2 = c.skin2, SKIN_D = c.skinD;
  const ARM = c.armor, ARM2 = c.armor2, TG = c.trim, BELT = c.belt, PANTS = c.pants, BOOT = c.boot, GAUNT = c.gaunt;
  const heavy = skin !== "titan";
  const isVoid = skin === "void";
  const P = { metal: 0.05, rough: 0.72 }; // skin
  const M = { metal: 0.7, rough: 0.3 }; // metal / gold
  const A = isVoid ? { metal: 0.85, rough: 0.28 } : { metal: heavy ? 0.78 : 0.15, rough: heavy ? 0.32 : 0.8 }; // armor / vest
  const C = { metal: 0.05, rough: 0.9 }; // cloth / leather
  const GLOW = (col: number, ei = 2.6) => ({ emissive: col, ei, metal: 0 });

  const root = new THREE.Group();
  const body = pivot(root, 0, 1.0, 0);
  const veins: THREE.Mesh[] = [];
  const vein = (parent: THREE.Object3D, w: number, h: number, d: number, x: number, y: number, z: number, rz = 0) => {
    const m = boxR(parent, w, h, d, 0xff3a1a, x, y, z, { rz }, GLOW(0xff2a10, 3));
    m.castShadow = false;
    veins.push(m);
    return m;
  };

  /* ---------------- pelvis / belt ---------------- */
  box(root, 0.9, 0.28, 0.56, PANTS, 0, 1.0, 0, C);
  box(body, 1.14, 0.15, 0.66, BELT, 0, 0.1, 0, C);
  box(body, 0.36, 0.17, 0.06, TG, 0, 0.1, 0.34, M);
  box(body, 0.2, 0.09, 0.07, ARM, 0, 0.1, 0.34, A);
  for (const sx of [-1, 1]) {
    box(body, 0.1, 0.12, 0.06, TG, sx * 0.45, 0.1, 0.34, M); // belt studs
    box(body, 0.1, 0.12, 0.06, TG, sx * 0.25, 0.1, 0.34, M);
  }

  /* ---------------- torso ---------------- */
  // skin chest / abs underneath (visible between plates)
  box(body, 1.0, 0.6, 0.56, SKIN2, 0, 0.45, 0, P);
  part(body, new THREE.SphereGeometry(0.3, 14, 10), SKIN, 0.26, 0.66, 0.2, { ...P, sx: 1.05, sy: 0.82, sz: 0.62 }); // pecs
  part(body, new THREE.SphereGeometry(0.3, 14, 10), SKIN, -0.26, 0.66, 0.2, { ...P, sx: 1.05, sy: 0.82, sz: 0.62 });
  for (let i = 0; i < 3; i++) {
    box(body, 0.2, 0.1, 0.05, SKIN, 0.12, 0.4 - i * 0.12 + 0.12, 0.29, P); // abs
    box(body, 0.2, 0.1, 0.05, SKIN, -0.12, 0.4 - i * 0.12 + 0.12, 0.29, P);
  }

  if (!heavy) {
    // sleeveless vest + gold yoke (classic)
    box(body, 1.14, 0.78, 0.64, ARM, 0, 0.52, 0, A);
    box(body, 0.04, 0.6, 0.05, ARM2, 0, 0.5, 0.33, A);
    box(body, 0.34, 0.5, 0.05, ARM2, 0.3, 0.52, 0.33, A);
    box(body, 0.34, 0.5, 0.05, ARM2, -0.3, 0.52, 0.33, A);
    boxR(body, 0.98, 0.17, 0.68, TG, 0, 0.93, 0, { rx: 0.05 }, M);
    box(body, 0.54, 0.22, 0.07, TG, 0, 0.77, 0.34, M);
    boxR(body, 0.34, 0.1, 0.64, TG, 0.5, 0.9, 0, { rz: -0.3 }, M);
    boxR(body, 0.34, 0.1, 0.64, TG, -0.5, 0.9, 0, { rz: 0.3 }, M);
    box(body, 0.28, 0.12, 0.08, ARM, 0, 0.93, 0.35, A);
    box(body, 0.92, 0.4, 0.06, ARM2, 0, 0.55, -0.34, A);
    // gold rivets
    for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) box(body, 0.05, 0.05, 0.03, TG, sx * (0.12 + i * 0.16), 0.93, 0.36, M);
  } else {
    // full battle plate
    box(body, 1.12, 0.66, 0.62, ARM, 0, 0.56, 0, A);
    boxR(body, 0.5, 0.52, 0.14, ARM2, 0.27, 0.62, 0.3, { rx: -0.12, rz: -0.08 }, A);
    boxR(body, 0.5, 0.52, 0.14, ARM2, -0.27, 0.62, 0.3, { rx: -0.12, rz: 0.08 }, A);
    box(body, 0.1, 0.62, 0.15, TG, 0, 0.6, 0.33, M); // sternum ridge
    // segmented abdomen bands
    for (let i = 0; i < 3; i++) box(body, 0.84 - i * 0.06, 0.09, 0.5, i === 1 ? TG : ARM2, 0, 0.32 - i * 0.12, 0.04, M);
    box(body, 1.0, 0.14, 0.7, TG, 0, 0.93, 0, M); // gorget
    boxR(body, 0.4, 0.12, 0.7, ARM2, 0.52, 0.9, 0, { rz: -0.35 }, A);
    boxR(body, 0.4, 0.12, 0.7, ARM2, -0.52, 0.9, 0, { rz: 0.35 }, A);
    box(body, 0.96, 0.5, 0.08, ARM2, 0, 0.52, -0.34, A); // back plate
    if (isVoid) {
      // glowing sigil
      const sig = part(body, polyGeo([[-0.17, 0.14], [0.17, 0.14], [0, -0.17]], 0.03), 0xff3a1a, 0, 0.64, 0.41, GLOW(0xff2a10, 3.5));
      sig.castShadow = false;
      veins.push(sig);
      vein(body, 0.03, 0.4, 0.03, 0.5, 0.5, 0.34);
      vein(body, 0.03, 0.4, 0.03, -0.5, 0.5, 0.34);
      vein(body, 0.5, 0.025, 0.03, 0.0, 0.2, 0.37);
    } else {
      // gold chest emblem
      const emb = part(body, polyGeo([[-0.14, 0.12], [0.14, 0.12], [0, -0.14]], 0.03), TG, 0, 0.64, 0.41, M);
      emb.castShadow = false;
    }
    // tassets (skirt plates) hanging off the belt
    for (const sx of [-1, 1]) {
      for (let i = 0; i < 3; i++) boxR(root, 0.22, 0.32, 0.06, i === 1 ? TG : ARM2, sx * (0.17 + i * 0.17), 0.82, 0.31 + i * 0.01, { rz: sx * 0.06 * i }, M);
    }
  }
  box(body, 0.34, 0.3, 0.34, SKIN2, 0, 1.12, 0, P); // neck
  box(body, 0.05, 0.22, 0.05, SKIN_D, 0.13, 1.1, 0.14, P); // neck tendons
  box(body, 0.05, 0.22, 0.05, SKIN_D, -0.13, 1.1, 0.14, P);

  /* ---------------- head ---------------- */
  const head = pivot(body, 0, 1.38, 0);
  part(head, new THREE.SphereGeometry(0.29, 24, 18), SKIN, 0, 0.05, -0.01, { ...P, sx: 1.0, sy: 1.12, sz: 1.02 });
  box(head, 0.4, 0.24, 0.36, SKIN2, 0, -0.27, 0.07, P); // heavy jaw
  box(head, 0.28, 0.12, 0.12, SKIN2, 0, -0.36, 0.2, P); // chin
  box(head, 0.026, 0.09, 0.03, SKIN_D, 0, -0.35, 0.265, P); // chin cleft
  boxR(head, 0.1, 0.2, 0.14, SKIN2, 0.2, -0.22, 0.06, { rz: -0.3 }, P); // jaw wings
  boxR(head, 0.1, 0.2, 0.14, SKIN2, -0.2, -0.22, 0.06, { rz: 0.3 }, P);
  box(head, 0.52, 0.1, 0.14, SKIN2, 0, 0.12, 0.2, P); // brow ridge
  for (const dy of [0.2, 0.25, 0.3]) box(head, 0.3 - (dy - 0.2) * 0.8, 0.018, 0.03, SKIN_D, 0, dy, 0.265, P);
  const eyeCol = c.eye;
  const eyes: THREE.Mesh[] = [];
  for (const sx of [1, -1]) {
    const e = box(head, 0.11, 0.045, 0.04, 0xfff0c0, sx * 0.13, 0.05, 0.245, { emissive: eyeCol, ei: isVoid ? 4 : 1.6, metal: 0 });
    e.castShadow = false;
    e.userData.base = eyeCol;
    eyes.push(e);
    boxR(head, 0.12, 0.03, 0.05, SKIN_D, sx * 0.14, 0.1, 0.262, { rz: sx * 0.3 }, P); // angry brows
    box(head, 0.15, 0.11, 0.1, SKIN2, sx * 0.17, -0.07, 0.2, P); // cheekbones
    box(head, 0.06, 0.15, 0.1, SKIN2, sx * 0.29, 0.0, 0.0, P); // ears
    box(head, 0.025, 0.07, 0.03, SKIN_D, sx * 0.17, -0.02, 0.255, P); // face scar lines
  }
  box(head, 0.1, 0.16, 0.11, SKIN2, 0, -0.03, 0.27, P); // nose
  box(head, 0.2, 0.02, 0.04, SKIN_D, 0, -0.18, 0.255, P); // grimace
  if (heavy) {
    box(head, 0.62, 0.05, 0.3, TG, 0, 0.27, 0.12, M).rotation.x = -0.1; // brow band
    const gem = box(head, 0.06, 0.08, 0.04, isVoid ? 0xff2a10 : 0x7ad0ff, 0, 0.27, 0.28, GLOW(isVoid ? 0xff2a10 : 0x40b8ff, 3));
    gem.castShadow = false;
    if (isVoid) veins.push(gem);
    // cheek guards
    box(head, 0.05, 0.2, 0.2, ARM2, 0.31, -0.1, 0.05, A);
    box(head, 0.05, 0.2, 0.2, ARM2, -0.31, -0.1, 0.05, A);
  }
  if (isVoid) {
    // crown of horns
    for (let i = 0; i < 7; i++) {
      const a = -1.15 + i * 0.383;
      const h = i === 3 ? 0.55 : i % 2 ? 0.34 : 0.42;
      part(head, new THREE.ConeGeometry(0.045, h, 6), ARM, Math.sin(a) * 0.3, 0.3 + (i === 3 ? 0.08 : 0), -0.05 - Math.cos(a) * 0.04, { ...A, rx: -0.35, rz: -a * 0.45 });
    }
    box(head, 0.62, 0.05, 0.5, ARM, 0, 0.25, -0.02, A);
    vein(head, 0.02, 0.2, 0.02, 0, 0.18, 0.28);
    vein(head, 0.02, 0.1, 0.02, 0.12, -0.12, 0.27, 0.3);
    vein(head, 0.02, 0.1, 0.02, -0.12, -0.12, 0.27, -0.3);
  }

  /* ---------------- arms ---------------- */
  const makeArm = (side: number) => {
    const sh = pivot(body, side * 0.82, 0.93, 0);
    part(sh, new THREE.SphereGeometry(0.32, 16, 12), SKIN, 0, 0.02, 0, { ...P, sx: 1.05, sy: 0.95 }); // deltoid
    part(sh, new THREE.CapsuleGeometry(0.21, 0.4, 4, 12), SKIN, 0, -0.36, 0, { ...P, sx: 1.05, sz: 1.0 }); // bicep
    part(sh, new THREE.SphereGeometry(0.12, 10, 8), SKIN2, 0, -0.3, 0.12, { ...P, sx: 1.2, sy: 1.5, sz: 0.8 }); // bicep peak
    box(sh, 0.04, 0.4, 0.06, SKIN_D, side * 0.2, -0.36, 0.06, P); // vein shading
    const el = pivot(sh, 0, -0.66, 0);
    part(el, new THREE.CapsuleGeometry(0.19, 0.34, 4, 12), SKIN2, 0, -0.3, 0, { ...P, sx: 1.0 });
    part(el, new THREE.SphereGeometry(0.2, 12, 10), SKIN2, 0, -0.1, 0, { ...P, sx: 1.05 }); // forearm bulk
    const hand = pivot(el, 0, -0.64, 0);
    box(hand, 0.34, 0.3, 0.34, SKIN2, 0, -0.1, 0, P);
    for (let i = 0; i < 4; i++) box(hand, 0.07, 0.12, 0.08, SKIN2, -0.12 + i * 0.08, -0.3, 0.1, P); // fingers
    box(hand, 0.08, 0.1, 0.08, SKIN2, side * 0.2, -0.16, 0.06, P); // thumb
    if (heavy) {
      // spiked pauldron + bracer
      part(sh, new THREE.SphereGeometry(0.42, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), ARM2, side * 0.04, 0.1, 0, { ...A, sx: 1.15, sy: 0.85, sz: 1.05 });
      box(sh, 0.64, 0.06, 0.66, TG, side * 0.04, 0.08, 0, M).rotation.z = -side * 0.12;
      for (let i = 0; i < 3; i++) {
        part(sh, new THREE.ConeGeometry(0.07, isVoid ? 0.5 : 0.34, 6), isVoid ? ARM : TG, side * (0.14 + i * 0.1), 0.42 - i * 0.08, 0.0, { ...M, rz: -side * (0.35 + i * 0.35) });
      }
      box(el, 0.34, 0.34, 0.34, ARM2, 0, -0.38, 0, A);
      box(el, 0.38, 0.06, 0.38, TG, 0, -0.2, 0, M);
      box(el, 0.38, 0.06, 0.38, TG, 0, -0.56, 0, M);
      if (isVoid) {
        vein(sh, 0.025, 0.5, 0.025, side * 0.19, -0.35, 0.12);
        vein(el, 0.025, 0.4, 0.025, side * 0.1, -0.3, 0.2);
      }
    } else {
      boxR(el, 0.36, 0.1, 0.36, TG, 0, -0.5, 0, { rz: 0 }, M); // leather wrist wrap
    }
    return { sh, el, hand };
  };
  const aR = makeArm(-1);
  const aL = makeArm(1);

  /* ---------------- Infinity Gauntlet (on the +x arm) ---------------- */
  box(aL.el, 0.5, 0.5, 0.5, GAUNT, 0, -0.62, 0, M);
  box(aL.el, 0.56, 0.08, 0.56, TG, 0, -0.38, 0, M);
  box(aL.el, 0.54, 0.05, 0.54, TG, 0, -0.84, 0, M);
  box(aL.el, 0.14, 0.34, 0.06, TG, 0, -0.62, 0.27, M);
  for (const sx of [-1, 1]) boxR(aL.el, 0.06, 0.4, 0.4, TG, sx * 0.27, -0.62, 0, { rz: sx * 0.12 }, M);
  box(aL.hand, 0.5, 0.4, 0.5, GAUNT, 0, -0.1, 0, M);
  box(aL.hand, 0.46, 0.06, 0.46, TG, 0, 0.08, 0, M);
  for (let i = 0; i < 4; i++) {
    box(aL.hand, 0.09, 0.14, 0.1, GAUNT, -0.15 + i * 0.1, -0.34, 0.12, M);
    box(aL.hand, 0.09, 0.05, 0.11, TG, -0.15 + i * 0.1, -0.42, 0.12, M); // knuckle tips
  }
  const stoneColors = [0x3aa0ff, 0xff3030, 0xb04aff, 0xff9a1a, 0x30ff6a, 0xffe93a];
  const stones: THREE.Mesh[] = [];
  const halos: THREE.Mesh[] = [];
  stoneColors.forEach((col, i) => {
    const gx = 0.27;
    const gy = -0.04 - Math.floor(i / 3) * 0.15;
    const gz = -0.15 + (i % 3) * 0.15;
    box(aL.hand, 0.05, 0.13, 0.13, TG, gx - 0.02, gy, gz, M);
    const s = part(aL.hand, new THREE.SphereGeometry(0.055, 14, 10), col, gx + 0.015, gy, gz, { emissive: col, ei: 3.5, metal: 0 });
    stones.push(s);
    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 12, 8),
      new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    halo.position.set(gx + 0.03, gy, gz);
    aL.hand.add(halo);
    halos.push(halo);
  });
  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, -0.4, 0);
  aL.hand.add(muzzle);

  /* ---------------- legs ---------------- */
  const makeLeg = (side: number) => {
    const hip = pivot(root, side * 0.3, 1.0, 0);
    box(hip, 0.42, 0.58, 0.44, PANTS, 0, -0.28, 0, C);
    const knee = pivot(hip, 0, -0.56, 0);
    box(knee, 0.38, 0.46, 0.4, PANTS, 0, -0.22, 0, C);
    box(knee, 0.34, 0.26, 0.1, TG, 0, 0.02, 0.23, M); // knee guard
    part(knee, polyGeo([[-0.09, 0.07], [0.09, 0.07], [0, -0.08]], 0.04), 0x2a2218, 0, 0.02, 0.29, C);
    box(knee, 0.42, 0.34, 0.44, BOOT, 0, -0.32, 0, C); // tall boot
    box(knee, 0.3, 0.1, 0.1, TG, 0, -0.2, 0.24, M);
    box(knee, 0.44, 0.14, 0.64, BOOT, 0, -0.5, 0.1, C);
    box(knee, 0.46, 0.05, 0.66, TG, 0, -0.43, 0.1, M); // boot sole trim
    if (heavy) {
      box(knee, 0.4, 0.42, 0.12, ARM2, 0, -0.3, 0.24, A); // greave
      part(knee, new THREE.ConeGeometry(0.06, 0.3, 6), isVoid ? ARM : TG, 0, 0.04, 0.36, { ...M, rx: Math.PI / 2 }); // knee spike
      box(hip, 0.48, 0.12, 0.5, ARM2, 0, -0.06, 0, A); // thigh plate
      if (isVoid) vein(knee, 0.025, 0.3, 0.02, 0, -0.3, 0.31);
    }
    return { hip, knee };
  };
  const lR = makeLeg(-1);
  const lL = makeLeg(1);

  /* ---------------- cloth (animated by the game) ---------------- */
  const cloth: ClothSeg[] = [];
  const clothMat = (w: number, h: number, parent: THREE.Object3D, col: number, o: MatOpts = {}) => {
    const m = box(parent, w, h, 0.035, col, 0, -h / 2, 0, { metal: 0.02, rough: 0.95, ...o });
    return m;
  };
  const chain = (parent: THREE.Object3D, x: number, y: number, z: number, widths: number[], h: number, col: number, base: number, amp: number, o: MatOpts = {}) => {
    let par: THREE.Object3D = parent;
    widths.forEach((w, i) => {
      const pv = pivot(par, i === 0 ? x : 0, i === 0 ? y : -h + 0.02, i === 0 ? z : 0.0);
      clothMat(w, h, pv, col, o);
      cloth.push({ pivot: pv, base, amp: amp * (1 + i * 0.35), phase: i * 0.7 + x * 3 });
      par = pv;
    });
  };
  if (!heavy) {
    // belt tabards (front + back)
    chain(root, 0, 1.0, 0.32, [0.46, 0.42, 0.34], 0.26, c.cloth, -0.05, 0.06);
    chain(root, 0, 1.0, -0.32, [0.52, 0.46, 0.38], 0.28, c.cloth, 0.08, 0.07);
  } else if (skin === "warlord") {
    // war-cape from the pauldrons
    chain(body, 0, 0.98, -0.36, [1.2, 1.28, 1.34, 1.3], 0.5, c.cloth, 0.1, 0.07);
    chain(root, 0, 1.0, 0.33, [0.4, 0.34], 0.3, c.cloth, -0.05, 0.05);
  } else {
    // void: long flame cape with glowing hem
    chain(body, 0, 0.98, -0.36, [1.2, 1.3, 1.36, 1.3, 1.1], 0.5, c.cloth, 0.1, 0.09);
    const hem = cloth[cloth.length - 1].pivot;
    const hemGlow = box(hem, 1.1, 0.05, 0.05, 0xff4a1a, 0, -0.5, 0, GLOW(0xff3a10, 3.5));
    hemGlow.castShadow = false;
    veins.push(hemGlow);
    chain(root, 0, 1.0, 0.33, [0.4, 0.34], 0.3, c.cloth, -0.05, 0.05);
  }

  return {
    root,
    body,
    head,
    shR: aR.sh,
    elR: aR.el,
    handR: aR.hand,
    shL: aL.sh,
    elL: aL.el,
    handL: aL.hand,
    muzzle,
    hipR: lR.hip,
    kneeR: lR.knee,
    hipL: lL.hip,
    kneeL: lL.knee,
    stones,
    halos,
    eyes,
    cloth,
    veins,
    skin,
    mats: collectMats(root),
  };
}

/* ------------------------------------------------------------------ */
/*  ULTRON PRIME – hovering drone commander                            */
/* ------------------------------------------------------------------ */

export interface UltronRig {
  root: THREE.Group;
  core: THREE.Mesh;
  eyes: THREE.Mesh[];
  rings: THREE.Mesh[];
  flame: THREE.Mesh;
  fins: THREE.Group[];
  armR: THREE.Group;
  armL: THREE.Group;
  muzzles: THREE.Mesh[];
  mats: FlashMat[];
}

export function buildUltron(): UltronRig {
  const METAL = 0xa7b2c0;
  const DARK = 0x1c2430;
  const STEEL = 0x66737f;
  const RED = 0xff2a3c;
  const MT = { metal: 0.92, rough: 0.22 };
  const DK = { metal: 0.8, rough: 0.35 };
  const GL = (ei = 3.5) => ({ emissive: RED, ei, metal: 0 });
  const root = new THREE.Group();

  // torso: tapered chest block, waist, hover pod
  part(root, new THREE.CylinderGeometry(0.62, 0.38, 1.1, 8), METAL, 0, 0.05, 0, { ...MT, sz: 0.62 });
  box(root, 0.8, 0.3, 0.46, STEEL, 0, 0.5, 0.02, MT); // upper chest plate
  boxR(root, 0.42, 0.52, 0.12, METAL, 0.22, 0.2, 0.28, { rx: -0.12, rz: -0.1 }, MT);
  boxR(root, 0.42, 0.52, 0.12, METAL, -0.22, 0.2, 0.28, { rx: -0.12, rz: 0.1 }, MT);
  const core = part(root, new THREE.SphereGeometry(0.17, 18, 14), RED, 0, 0.2, 0.34, { ...GL(5), sz: 0.5 });
  core.castShadow = false;
  const coreRing = part(root, new THREE.TorusGeometry(0.22, 0.03, 8, 20), STEEL, 0, 0.2, 0.33, MT);
  coreRing.castShadow = false;
  for (let i = 0; i < 5; i++) box(root, 0.5 - i * 0.05, 0.04, 0.3, DARK, 0, -0.18 - i * 0.1, 0.02, DK); // waist segments
  part(root, new THREE.ConeGeometry(0.34, 0.9, 10), DARK, 0, -1.0, 0, { ...DK, rx: Math.PI }); // hover pod
  for (let i = 0; i < 3; i++) part(root, new THREE.TorusGeometry(0.2 + i * 0.05, 0.025, 6, 16), RED, 0, -0.78 - i * 0.2, 0, { ...GL(2.5), rx: Math.PI / 2 });
  const flameGeo = new THREE.ConeGeometry(0.28, 1.4, 12, 1, true);
  flameGeo.rotateX(Math.PI);
  const flame = new THREE.Mesh(flameGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 0.5, 0.35), transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  flame.position.set(0, -2.2, 0);
  root.add(flame);

  // neck + head
  part(root, new THREE.CylinderGeometry(0.1, 0.14, 0.2, 8), DARK, 0, 0.75, 0, DK);
  const head = pivot(root, 0, 1.0, 0.02);
  part(head, new THREE.SphereGeometry(0.34, 20, 14), METAL, 0, 0, -0.02, { ...MT, sx: 0.88, sy: 1.12, sz: 1.0 });
  box(head, 0.4, 0.34, 0.12, STEEL, 0, -0.02, 0.28, MT); // faceplate
  box(head, 0.3, 0.18, 0.14, DARK, 0, -0.14, 0.3, DK); // jaw
  for (let i = 0; i < 4; i++) box(head, 0.2, 0.012, 0.03, RED, 0, -0.1 - i * 0.04, 0.375, GL(2)); // mouth vents
  const eyes: THREE.Mesh[] = [];
  for (const sx of [-1, 1]) {
    const e = boxR(head, 0.15, 0.04, 0.03, RED, sx * 0.1, 0.06, 0.352, { rz: -sx * 0.25 }, GL(6));
    e.castShadow = false;
    eyes.push(e);
    boxR(head, 0.04, 0.22, 0.3, DARK, sx * 0.31, 0.0, 0.0, { rz: -sx * 0.1 }, DK); // ear vents
  }
  const crest = part(head, polyGeo([[-0.04, 0], [0.04, 0], [0.02, 0.35], [-0.04, 0.55]], 0.05), METAL, 0, 0.3, -0.12, { ...MT, rx: -0.4 });
  crest.castShadow = true;
  for (const sx of [-1, 1]) {
    boxR(head, 0.04, 0.4, 0.05, STEEL, sx * 0.17, 0.3, -0.12, { rz: -sx * 0.18, rx: -0.35 }, MT);
  }

  // shoulders + arms
  const mkArm = (side: number) => {
    const sh = pivot(root, side * 0.82, 0.5, 0);
    part(sh, new THREE.SphereGeometry(0.28, 14, 10), METAL, 0, 0, 0, MT);
    for (let i = 0; i < 3; i++) part(sh, new THREE.ConeGeometry(0.06, 0.36, 6), STEEL, side * (0.1 + i * 0.07), 0.24 - i * 0.04, 0, { ...MT, rz: -side * (0.5 + i * 0.4) });
    box(sh, 0.22, 0.62, 0.24, DARK, 0, -0.4, 0, DK);
    part(sh, new THREE.SphereGeometry(0.13, 10, 8), STEEL, 0, -0.76, 0, MT);
    const el = pivot(sh, 0, -0.78, 0);
    box(el, 0.26, 0.55, 0.28, METAL, 0, -0.3, 0.0, MT);
    box(el, 0.3, 0.1, 0.32, DARK, 0, -0.06, 0, DK);
    const muzzle = part(el, new THREE.CylinderGeometry(0.075, 0.09, 0.3, 10), RED, 0, -0.66, 0, { ...GL(3.5), rx: 0 });
    for (let i = 0; i < 3; i++) box(el, 0.03, 0.2, 0.05, STEEL, -0.1 + i * 0.1, -0.7, 0.14, MT); // fingers
    return { sh, el, muzzle };
  };
  const aR = mkArm(-1);
  const aL = mkArm(1);
  aR.sh.rotation.x = -0.9; // arms ready
  aL.sh.rotation.x = -0.9;
  aR.el.rotation.x = -0.4;
  aL.el.rotation.x = -0.4;
  aR.sh.rotation.z = -0.25;
  aL.sh.rotation.z = 0.25;

  // blade fins fanned behind the torso
  const fins: THREE.Group[] = [];
  for (let i = 0; i < 6; i++) {
    const side = i < 3 ? -1 : 1;
    const k = i % 3;
    const g = pivot(root, side * 0.3, 0.45 - k * 0.12, -0.34);
    g.rotation.z = -side * (0.5 + k * 0.45);
    g.rotation.x = -0.25;
    part(g, finGeo(1.5 - k * 0.2, 0.2, 0.04), DARK, 0, 0, 0, DK);
    part(g, finGeo(1.3 - k * 0.2, 0.05, 0.05), RED, 0, 0.1, 0, GL(2.6)).castShadow = false;
    fins.push(g);
  }

  // orbiting halo rings
  const rings: THREE.Mesh[] = [];
  for (let i = 0; i < 2; i++) {
    const r = part(root, new THREE.TorusGeometry(1.45 + i * 0.3, 0.025, 6, 48), RED, 0, 0.3, -0.1, { ...GL(1.6), rx: Math.PI / 2 + i * 0.5, rz: i * 0.8 });
    r.castShadow = false;
    rings.push(r);
  }

  return { root, core, eyes, rings, flame, fins, armR: aR.sh, armL: aL.sh, muzzles: [aR.muzzle, aL.muzzle], mats: collectMats(root) };
}
