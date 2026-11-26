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
  armorRoot: THREE.Group;
  tonyRoot: THREE.Group;
  wreckage: THREE.Group;
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

  /* ---------------- legs ---------------- */
  const flames: THREE.Mesh[] = [];
  const flameGeo = new THREE.ConeGeometry(0.11, 0.8, 8);
  flameGeo.rotateX(Math.PI);
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
    const f = new THREE.Mesh(
      flameGeo,
      new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.4, 0.5), transparent: true, opacity: 0.9 })
    );
    f.position.set(0, -0.92, 0.05);
    f.visible = false;
    knee.add(f);
    flames.push(f);
    return { hip, knee, foot };
  };
  const lR = makeLeg(-1);
  const lL = makeLeg(1);

  // Tony Stark pilot model, revealed only when the armor is almost completely gone.
  const tonyRoot = new THREE.Group();
  tonyRoot.visible = false;
  root.add(tonyRoot);
  const skin = new THREE.MeshStandardMaterial({ color: 0xc88762, roughness: 0.82 });
  const hair = new THREE.MeshStandardMaterial({ color: 0x241a18, roughness: 0.9 });
  const shirt = new THREE.MeshStandardMaterial({ color: 0x252b35, roughness: 0.88 });
  const pants = new THREE.MeshStandardMaterial({ color: 0x171b23, roughness: 0.9 });
  const shoes = new THREE.MeshStandardMaterial({ color: 0x101318, roughness: 0.92 });
  const beard = new THREE.MeshStandardMaterial({ color: 0x342522, roughness: 1 });
  const eye = new THREE.MeshStandardMaterial({ color: 0x17191d, roughness: 0.8 });
  const addTonyMesh = (geo: THREE.BufferGeometry, mat: THREE.Material, pos: [number,number,number], scale?: [number,number,number], rotZ = 0) => {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(...pos);
    if (scale) mesh.scale.set(...scale);
    mesh.rotation.z = rotZ;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    tonyRoot.add(mesh);
    return mesh;
  };
  addTonyMesh(new THREE.BoxGeometry(0.56,0.68,0.31), shirt, [0,1.52,0]);
  addTonyMesh(new THREE.BoxGeometry(0.5,0.25,0.3), pants, [0,1.05,0]);
  addTonyMesh(new THREE.BoxGeometry(0.52,0.035,0.32), shoes, [0,1.16,0]);
  for (const side of [-1,1]) {
    addTonyMesh(new THREE.CylinderGeometry(0.105,0.12,0.52,10), shirt, [side*0.39,1.52,0], [1,1,1], side*-0.12);
    addTonyMesh(new THREE.CylinderGeometry(0.085,0.095,0.42,10), skin, [side*0.45,1.12,0.015], [1,1,1], side*-0.08);
    addTonyMesh(new THREE.SphereGeometry(0.09,12,10), skin, [side*0.45,0.89,0.02], [1,0.8,0.8]);
    addTonyMesh(new THREE.BoxGeometry(0.22,0.62,0.25), pants, [side*0.15,0.67,0]);
    addTonyMesh(new THREE.BoxGeometry(0.24,0.13,0.38), shoes, [side*0.15,0.12,0.07]);
  }
  addTonyMesh(new THREE.CylinderGeometry(0.075,0.08,0.16,12), skin, [0,1.91,0]);
  addTonyMesh(new THREE.SphereGeometry(0.18,18,14), skin, [0,2.17,0.015], [0.92,1.12,0.9]);
  addTonyMesh(new THREE.SphereGeometry(0.185,16,12), hair, [0,2.29,-0.015], [1,0.62,0.95]);
  addTonyMesh(new THREE.SphereGeometry(0.125,14,10), beard, [0,2.055,0.12], [1,0.5,0.35]);
  for (const side of [-1,1]) {
    addTonyMesh(new THREE.SphereGeometry(0.018,8,8), eye, [side*0.065,2.2,0.171]);
    addTonyMesh(new THREE.SphereGeometry(0.035,8,8), skin, [side*0.18,2.16,0]);
  }

  // A few detached red/gold armor fragments remain around Tony for the destroyed-suit reveal.
  const wreckage = new THREE.Group();
  wreckage.visible = false;
  root.add(wreckage);
  const redShard = new THREE.MeshStandardMaterial({ color: RED, metalness: 0.55, roughness: 0.35 });
  const goldShard = new THREE.MeshStandardMaterial({ color: GOLD, metalness: 0.55, roughness: 0.35 });
  const addShard = (size: [number,number,number], pos: [number,number,number], rot: [number,number,number], mat: THREE.Material) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), mat);
    mesh.position.set(...pos);
    mesh.rotation.set(...rot);
    mesh.castShadow = true;
    wreckage.add(mesh);
  };
  addShard([0.34,0.12,0.22],[-0.52,1.91,0.02],[0.2,0.1,-0.35],goldShard);
  addShard([0.34,0.12,0.22],[0.52,1.91,0.02],[-0.2,-0.1,0.35],goldShard);
  addShard([0.24,0.1,0.16],[-0.37,1.5,0.2],[0.3,0.2,0.55],redShard);
  addShard([0.24,0.1,0.16],[0.37,1.48,0.2],[-0.3,-0.2,-0.55],redShard);
  addShard([0.22,0.1,0.2],[-0.2,0.43,0.02],[0.2,0.3,-0.2],redShard);
  addShard([0.22,0.1,0.2],[0.2,0.4,0.02],[-0.2,-0.3,0.2],goldShard);

  return {
    root,
    armorRoot,
    tonyRoot,
    wreckage,
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
/*  THANOS – bald purple Titan, dark vest, gold yoke, Infinity Gauntlet */
/* ------------------------------------------------------------------ */

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
  mats: FlashMat[];
}

export const THANOS_SCALE = 2.6;

export function buildThanos(): ThanosRig {
  const SKIN = 0x865aae;
  const SKIN2 = 0x6f4796;
  const SKIN_D = 0x4e2f6e;
  const VEST = 0x1b1a2a;
  const VEST2 = 0x2a2840;
  const TG = 0xd4a037;
  const BELT = 0x6b4a26;
  const PANTS = 0x5b4a39;
  const BOOT = 0x43362a;
  const GAUNT = 0xb78a30;
  const P = { metal: 0.05, rough: 0.72 }; // skin
  const M = { metal: 0.65, rough: 0.35 }; // gold armor
  const C = { metal: 0.05, rough: 0.9 }; // cloth / leather

  const root = new THREE.Group();
  const body = pivot(root, 0, 1.0, 0);

  /* ---------------- pelvis / belt / vest ---------------- */
  box(root, 0.9, 0.28, 0.56, PANTS, 0, 1.0, 0, C);
  box(body, 1.14, 0.15, 0.66, BELT, 0, 0.1, 0, C); // wide leather belt
  box(body, 0.36, 0.17, 0.06, TG, 0, 0.1, 0.34, M); // buckle
  box(body, 0.2, 0.09, 0.07, VEST, 0, 0.1, 0.34, C);
  box(body, 1.14, 0.78, 0.64, VEST, 0, 0.52, 0, C); // sleeveless vest
  box(body, 0.04, 0.6, 0.05, VEST2, 0, 0.5, 0.33, C); // vest seam
  box(body, 0.34, 0.5, 0.05, VEST2, 0.3, 0.52, 0.33, C);
  box(body, 0.34, 0.5, 0.05, VEST2, -0.3, 0.52, 0.33, C);
  // gold yoke (broad collar plate across the upper chest)
  boxR(body, 0.98, 0.17, 0.68, TG, 0, 0.93, 0, { rx: 0.05 }, M);
  box(body, 0.54, 0.22, 0.07, TG, 0, 0.77, 0.34, M);
  boxR(body, 0.34, 0.1, 0.64, TG, 0.5, 0.9, 0, { rz: -0.3 }, M);
  boxR(body, 0.34, 0.1, 0.64, TG, -0.5, 0.9, 0, { rz: 0.3 }, M);
  box(body, 0.28, 0.12, 0.08, VEST, 0, 0.93, 0.35, C);
  box(body, 0.92, 0.4, 0.06, VEST2, 0, 0.55, -0.34, C); // back panel
  // neck
  box(body, 0.34, 0.3, 0.34, SKIN2, 0, 1.12, 0, P);

  /* ---------------- head ---------------- */
  const head = pivot(body, 0, 1.38, 0);
  part(head, new THREE.SphereGeometry(0.29, 22, 16), SKIN, 0, 0.05, -0.01, { ...P, sx: 1.0, sy: 1.12, sz: 1.02 }); // bald skull
  box(head, 0.4, 0.24, 0.36, SKIN2, 0, -0.27, 0.07, P); // heavy jaw
  box(head, 0.28, 0.12, 0.12, SKIN2, 0, -0.36, 0.2, P); // big chin
  box(head, 0.026, 0.09, 0.03, SKIN_D, 0, -0.35, 0.265, P); // chin cleft
  box(head, 0.52, 0.1, 0.14, SKIN2, 0, 0.12, 0.2, P); // heavy brow ridge
  for (const dy of [0.2, 0.25, 0.3]) box(head, 0.3 - (dy - 0.2) * 0.8, 0.018, 0.03, SKIN_D, 0, dy, 0.265, P); // forehead furrows
  box(head, 0.11, 0.045, 0.04, 0xf3e6b8, 0.13, 0.05, 0.245, { emissive: 0xffd24a, ei: 1.4, metal: 0 });
  box(head, 0.11, 0.045, 0.04, 0xf3e6b8, -0.13, 0.05, 0.245, { emissive: 0xffd24a, ei: 1.4, metal: 0 });
  boxR(head, 0.12, 0.03, 0.05, SKIN_D, 0.14, 0.1, 0.262, { rz: 0.3 }, P); // angry brows
  boxR(head, 0.12, 0.03, 0.05, SKIN_D, -0.14, 0.1, 0.262, { rz: -0.3 }, P);
  box(head, 0.1, 0.16, 0.11, SKIN2, 0, -0.03, 0.27, P); // nose
  box(head, 0.2, 0.02, 0.04, SKIN_D, 0, -0.18, 0.255, P); // grimace
  box(head, 0.15, 0.11, 0.1, SKIN2, 0.17, -0.07, 0.2, P); // cheekbones
  box(head, 0.15, 0.11, 0.1, SKIN2, -0.17, -0.07, 0.2, P);
  box(head, 0.06, 0.15, 0.1, SKIN2, 0.29, 0.0, 0.0, P); // ears
  box(head, 0.06, 0.15, 0.1, SKIN2, -0.29, 0.0, 0.0, P);

  /* ---------------- arms (bare, huge muscle) ---------------- */
  const makeArm = (side: number) => {
    const sh = pivot(body, side * 0.82, 0.93, 0);
    part(sh, new THREE.SphereGeometry(0.32, 16, 12), SKIN, 0, 0.02, 0, { ...P, sx: 1.05, sy: 0.95 }); // deltoid
    part(sh, new THREE.CapsuleGeometry(0.21, 0.4, 4, 12), SKIN, 0, -0.36, 0, { ...P, sx: 1.05, sz: 1.0 }); // bicep
    box(sh, 0.04, 0.4, 0.06, SKIN_D, side * 0.2, -0.36, 0.06, P); // vein shading
    const el = pivot(sh, 0, -0.66, 0);
    part(el, new THREE.CapsuleGeometry(0.19, 0.34, 4, 12), SKIN2, 0, -0.3, 0, { ...P, sx: 1.0 });
    const hand = pivot(el, 0, -0.64, 0);
    box(hand, 0.34, 0.3, 0.34, SKIN2, 0, -0.1, 0, P);
    for (let i = 0; i < 4; i++) box(hand, 0.07, 0.1, 0.08, SKIN2, -0.12 + i * 0.08, -0.29, 0.1, P); // fingers
    return { sh, el, hand };
  };
  const aR = makeArm(-1);
  const aL = makeArm(1);

  /* ---------------- Infinity Gauntlet (on the +x arm) ---------------- */
  box(aL.el, 0.5, 0.5, 0.5, GAUNT, 0, -0.62, 0, M); // forearm guard
  box(aL.el, 0.56, 0.08, 0.56, TG, 0, -0.38, 0, M); // flared cuff
  box(aL.el, 0.54, 0.05, 0.54, TG, 0, -0.84, 0, M);
  box(aL.el, 0.14, 0.34, 0.06, TG, 0, -0.62, 0.27, M);
  box(aL.hand, 0.5, 0.4, 0.5, GAUNT, 0, -0.1, 0, M); // gauntlet hand
  box(aL.hand, 0.46, 0.06, 0.46, TG, 0, 0.08, 0, M);
  for (let i = 0; i < 4; i++) box(aL.hand, 0.09, 0.14, 0.1, GAUNT, -0.15 + i * 0.1, -0.34, 0.12, M); // gauntlet fingers
  const stoneColors = [0x3aa0ff, 0xff3030, 0xb04aff, 0xff9a1a, 0x30ff6a, 0xffe93a];
  const stones: THREE.Mesh[] = [];
  stoneColors.forEach((c, i) => {
    const gx = 0.27;
    const gy = -0.04 - Math.floor(i / 3) * 0.15;
    const gz = -0.15 + (i % 3) * 0.15;
    box(aL.hand, 0.05, 0.13, 0.13, TG, gx - 0.02, gy, gz, M); // bezel
    const s = part(aL.hand, new THREE.SphereGeometry(0.055, 12, 10), c, gx + 0.015, gy, gz, { emissive: c, ei: 3.5, metal: 0 });
    stones.push(s);
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
    // gold knee guard with a dark triangle emblem
    box(knee, 0.34, 0.26, 0.1, TG, 0, 0.02, 0.23, M);
    part(knee, polyGeo([[-0.09, 0.07], [0.09, 0.07], [0, -0.08]], 0.04), 0x2a2218, 0, 0.02, 0.29, C);
    // tall boot
    box(knee, 0.42, 0.34, 0.44, BOOT, 0, -0.32, 0, C);
    box(knee, 0.3, 0.1, 0.1, TG, 0, -0.2, 0.24, M);
    box(knee, 0.44, 0.14, 0.64, BOOT, 0, -0.5, 0.1, C);
    return { hip, knee };
  };
  const lR = makeLeg(-1);
  const lL = makeLeg(1);

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
    mats: collectMats(root),
  };
}
