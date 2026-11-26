import * as THREE from "three";
import { IronRig, MatOpts, XForm, finGeo } from "./builders";

/* ------------------------------------------------------------------ */
/*  NANOBOT WEAPONS – Mark 85                                          */
/*  Every weapon part is a subdivided mesh. A vertex shader blends it  */
/*  into a wobbling liquid-metal blob (uLiquid = 1) and back to the    */
/*  solid weapon (uLiquid = 0). Particles ("nanobots") stream between  */
/*  the armor and the mount point while it morphs.                     */
/*  A weapon can have several mounts: hands, chest, shoulders, feet.   */
/* ------------------------------------------------------------------ */

export interface NanoUniforms {
  uLiquid: { value: number };
  uTime: { value: number };
}

function nanoMat(u: NanoUniforms, color: number, o: MatOpts = {}) {
  const mat = new THREE.MeshStandardMaterial({
    color,
    metalness: o.metal ?? 0.7,
    roughness: o.rough ?? 0.3,
    emissive: o.emissive ?? 0,
    emissiveIntensity: o.ei ?? 1,
  });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uLiquid = u.uLiquid;
    shader.uniforms.uTime = u.uTime;
    const header = `
      uniform float uLiquid;
      uniform float uTime;
      float nanoK(vec3 p){
        float l = max(length(p), 0.001);
        float lag = clamp(l / 1.8, 0.0, 1.0);
        return smoothstep(0.0, 1.0, clamp(uLiquid * 1.5 - lag * 0.5, 0.0, 1.0));
      }
    `;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\n" + header)
      .replace(
        "#include <beginnormal_vertex>",
        `#include <beginnormal_vertex>
         objectNormal = normalize(mix(objectNormal, normalize(position), nanoK(position)));`
      )
      .replace(
        "#include <begin_vertex>",
        `float k_ = nanoK(position);
         float wob_ = sin(position.x*9.0 + uTime*9.0) * sin(position.y*7.0 + uTime*7.0 + 1.3) * sin(position.z*8.0 + uTime*8.0 + 2.1);
         vec3 sph_ = normalize(position + vec3(0.0001)) * 0.3 * (1.0 + 0.32 * wob_);
         vec3 transformed = mix(position, sph_, k_);`
      );
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform float uLiquid;")
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
         diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.78, 0.84, 0.95), uLiquid * 0.85);`
      )
      .replace(
        "#include <roughnessmap_fragment>",
        `#include <roughnessmap_fragment>
         roughnessFactor = mix(roughnessFactor, 0.06, uLiquid);`
      )
      .replace(
        "#include <metalnessmap_fragment>",
        `#include <metalnessmap_fragment>
         metalnessFactor = mix(metalnessFactor, 1.0, uLiquid);`
      )
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
         totalEmissiveRadiance += vec3(0.1, 0.5, 0.75) * uLiquid * 0.7;`
      );
  };
  return mat;
}

function nanoBox(
  g: THREE.Group,
  u: NanoUniforms,
  w: number,
  h: number,
  d: number,
  color: number,
  x: number,
  y: number,
  z: number,
  o: MatOpts = {}
) {
  const seg = (v: number) => Math.max(1, Math.min(16, Math.round(v * 9)));
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d, seg(w), seg(h), seg(d)), nanoMat(u, color, o));
  m.position.set(x, y, z);
  m.frustumCulled = false;
  g.add(m);
  return m;
}

/** any geometry as a nano part */
function nanoGeo(
  g: THREE.Group,
  u: NanoUniforms,
  geo: THREE.BufferGeometry,
  color: number,
  x: number,
  y: number,
  z: number,
  o: MatOpts & XForm = {}
) {
  const m = new THREE.Mesh(geo, nanoMat(u, color, o));
  m.position.set(x, y, z);
  m.rotation.set(o.rx ?? 0, o.ry ?? 0, o.rz ?? 0);
  m.scale.set(o.sx ?? 1, o.sy ?? 1, o.sz ?? 1);
  m.frustumCulled = false;
  g.add(m);
  return m;
}

/** curved crescent blade running along -Y, curving toward +Z, flat across X */
function crescentGeo(len: number, bulge: number, width: number, depth: number) {
  const N = 24;
  const outer: Array<[number, number]> = [];
  const inner: Array<[number, number]> = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const y = -t * len;
    const spine = -bulge * t * t; // polygon-x == -world z after rotateY
    const w = width * (Math.pow(1 - t, 0.6) * 0.92 + 0.08 * (1 - t)) + 0.012;
    outer.push([spine - w * 0.62, y]);
    inner.push([spine + w * 0.38, y]);
  }
  const pts = [...outer, ...inner.reverse()];
  const s = new THREE.Shape();
  pts.forEach(([x, y], i) => (i === 0 ? s.moveTo(x, y) : s.lineTo(x, y)));
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false });
  geo.translate(0, 0, -depth / 2);
  geo.rotateY(Math.PI / 2);
  return geo;
}

export type MountKey = "R" | "L" | "C" | "SR" | "SL" | "FR" | "FL";

export interface Mount {
  key: MountKey;
  group: THREE.Group;
}

export interface WeaponDef {
  id: number;
  /** primary group (first mount) */
  group: THREE.Group;
  mounts: Mount[];
  u: NanoUniforms;
  /** which hand the arm-pose logic should use while morphing */
  hand: "R" | "L";
  muzzle: THREE.Object3D;
  /** additional emitters (zero cannons, foot beams, second pod …) */
  extraMuzzles: THREE.Object3D[];
  /** energy-shield disc (opacity animated by the game) */
  glow: THREE.Mesh | null;
  /** infinity stones on the nano gauntlet */
  stones: THREE.Mesh[];
}

export const WEAPON_COUNT = 11;

const RED = 0xb3141f;
const DRED = 0x7d0c14;
const GOLD = 0xf0b030;
const CYAN = 0x9defff;
const CYAN_E = 0x44d8ff;
const ICE = 0xdff6ff;
const EMI = { emissive: CYAN_E, ei: 3.5, metal: 0 } as const;

function makeWeapon(id: number): WeaponDef {
  const u: NanoUniforms = { uLiquid: { value: 0 }, uTime: { value: 0 } };
  const mounts: Mount[] = [];
  const newGroup = (key: MountKey) => {
    const g = new THREE.Group();
    g.visible = false;
    mounts.push({ key, group: g });
    return g;
  };
  const extraMuzzles: THREE.Object3D[] = [];
  let glow: THREE.Mesh | null = null;
  const stones: THREE.Mesh[] = [];
  const g = newGroup(id === 9 || id === 10 ? "L" : id === 2 ? "C" : id === 8 ? "SR" : "R");
  const muzzle = new THREE.Object3D();
  g.add(muzzle);
  let hand: "R" | "L" = "R";

  if (id === 0) {
    /* ---- REPULSOR BLASTER (extends along -Y = forward when arm is raised) ---- */
    nanoBox(g, u, 0.26, 0.5, 0.26, RED, 0, -0.3, 0);
    nanoBox(g, u, 0.3, 0.12, 0.3, GOLD, 0, -0.12, 0);
    nanoBox(g, u, 0.16, 0.45, 0.16, GOLD, 0, -0.72, 0);
    nanoBox(g, u, 0.24, 0.07, 0.24, CYAN, 0, -0.98, 0, EMI);
    nanoBox(g, u, 0.06, 0.3, 0.34, RED, 0, -0.5, 0);
    muzzle.position.set(0, -1.1, 0);
  } else if (id === 1) {
    /* ---- LIGHTNING REFOCUS – palm focusing rings (fins on the back do the absorbing) ---- */
    nanoGeo(g, u, new THREE.TorusGeometry(0.2, 0.045, 8, 22), GOLD, 0, -0.22, 0, { rx: Math.PI / 2 });
    nanoGeo(g, u, new THREE.TorusGeometry(0.29, 0.04, 8, 24), RED, 0, -0.5, 0, { rx: Math.PI / 2 });
    nanoGeo(g, u, new THREE.TorusGeometry(0.17, 0.035, 8, 22), CYAN, 0, -0.78, 0, { rx: Math.PI / 2, ...EMI });
    nanoGeo(g, u, new THREE.SphereGeometry(0.13, 14, 10), CYAN, 0, -0.42, 0, EMI);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      nanoBox(g, u, 0.05, 0.62, 0.05, GOLD, Math.cos(a) * 0.25, -0.5, Math.sin(a) * 0.25);
    }
    muzzle.position.set(0, -0.9, 0);
  } else if (id === 2) {
    /* ---- UNI-BEAM (chest lens) + FOOT UNI-BEAMS ---- */
    nanoGeo(g, u, new THREE.TorusGeometry(0.19, 0.04, 8, 24), GOLD, 0, 0, 0.03);
    nanoGeo(g, u, new THREE.TorusGeometry(0.12, 0.03, 8, 20), CYAN, 0, 0, 0.07, EMI);
    nanoGeo(g, u, new THREE.SphereGeometry(0.08, 12, 10), 0xffffff, 0, 0, 0.06, { emissive: 0xffffff, ei: 4, metal: 0, sz: 0.5 });
    for (let i = 0; i < 3; i++) {
      const a = Math.PI / 2 + (i / 3) * Math.PI * 2;
      nanoBox(g, u, 0.045, 0.045, 0.24, RED, Math.cos(a) * 0.2, Math.sin(a) * 0.2, 0.13);
    }
    muzzle.position.set(0, 0, 0.3);
    for (const key of ["FR", "FL"] as const) {
      const f = newGroup(key);
      nanoGeo(f, u, new THREE.TorusGeometry(0.13, 0.035, 8, 20), GOLD, 0, -0.02, 0, { rx: Math.PI / 2 });
      nanoGeo(f, u, new THREE.CylinderGeometry(0.07, 0.1, 0.09, 12), RED, 0, -0.05, 0);
      nanoGeo(f, u, new THREE.CylinderGeometry(0.06, 0.06, 0.03, 12), CYAN, 0, -0.1, 0, EMI);
      const m = new THREE.Object3D();
      m.position.set(0, -0.1, 0);
      f.add(m);
      extraMuzzles.push(m);
    }
  } else if (id === 3) {
    /* ---- NANO CANNON (arm) + ZERO CANNONS (shoulders) ---- */
    nanoBox(g, u, 0.42, 0.8, 0.42, DRED, 0, -0.45, 0);
    nanoBox(g, u, 0.5, 0.14, 0.5, GOLD, 0, -0.1, 0);
    nanoBox(g, u, 0.28, 0.7, 0.28, GOLD, 0, -1.1, 0);
    nanoBox(g, u, 0.4, 0.1, 0.4, 0xffb060, 0, -1.48, 0, { emissive: 0xff8a2a, ei: 3.5, metal: 0 });
    nanoBox(g, u, 0.08, 0.6, 0.6, RED, 0.24, -0.6, 0);
    nanoBox(g, u, 0.08, 0.6, 0.6, RED, -0.24, -0.6, 0);
    muzzle.position.set(0, -1.6, 0);
    for (const key of ["SR", "SL"] as const) {
      const p = newGroup(key);
      p.rotation.x = -0.3;
      nanoBox(p, u, 0.26, 0.22, 0.34, DRED, 0, 0, 0);
      nanoBox(p, u, 0.17, 0.17, 0.5, RED, 0, 0.0, 0.38);
      nanoGeo(p, u, new THREE.TorusGeometry(0.11, 0.03, 8, 16), GOLD, 0, 0, 0.58);
      nanoGeo(p, u, new THREE.CylinderGeometry(0.06, 0.06, 0.03, 12), 0xffb060, 0, 0, 0.64, { rx: Math.PI / 2, emissive: 0xff8a2a, ei: 3.5, metal: 0 });
      nanoBox(p, u, 0.04, 0.28, 0.3, GOLD, 0, 0.0, 0.2);
      const m = new THREE.Object3D();
      m.position.set(0, 0, 0.7);
      p.add(m);
      extraMuzzles.push(m);
    }
  } else if (id === 4) {
    /* ---- ENERGY DISPLACER SENTRY emitter ---- */
    nanoGeo(g, u, new THREE.SphereGeometry(0.17, 16, 12), RED, 0, -0.26, 0);
    nanoGeo(g, u, new THREE.TorusGeometry(0.24, 0.04, 8, 22), GOLD, 0, -0.26, 0, { rx: Math.PI / 2 });
    nanoGeo(g, u, new THREE.TorusGeometry(0.24, 0.03, 8, 22), CYAN, 0, -0.26, 0, { rz: Math.PI / 2, ...EMI });
    nanoGeo(g, u, new THREE.SphereGeometry(0.09, 12, 10), CYAN, 0, -0.26, 0, EMI);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      nanoBox(g, u, 0.05, 0.14, 0.05, GOLD, Math.cos(a) * 0.2, -0.1, Math.sin(a) * 0.2);
    }
    muzzle.position.set(0, -0.55, 0);
  } else if (id === 5) {
    /* ---- ENERGY BLADE (crescent) + NANO HAND BLADE ---- */
    nanoBox(g, u, 0.12, 0.3, 0.12, RED, 0, -0.05, 0);
    nanoBox(g, u, 0.62, 0.08, 0.16, GOLD, 0, -0.24, 0);
    nanoGeo(g, u, crescentGeo(2.0, 0.75, 0.36, 0.06), ICE, 0, -0.28, 0, { metal: 0.95, rough: 0.12, emissive: CYAN_E, ei: 0.9 });
    nanoGeo(g, u, crescentGeo(1.9, 0.75, 0.1, 0.09), CYAN, 0, -0.3, 0.02, EMI);
    muzzle.position.set(0, -2.0, 0.5);
    const h = newGroup("L");
    nanoBox(h, u, 0.2, 0.08, 0.2, GOLD, 0, 0.0, 0);
    nanoGeo(h, u, finGeo(0.85, 0.16, 0.045), ICE, 0, -0.04, 0, { rx: Math.PI, metal: 0.95, rough: 0.12, emissive: CYAN_E, ei: 0.9 });
    nanoGeo(h, u, finGeo(0.7, 0.05, 0.06), CYAN, 0, -0.08, 0, { rx: Math.PI, ...EMI });
  } else if (id === 6) {
    /* ---- NANO KATAR (both hands) ---- */
    for (let n = 0; n < 2; n++) {
      const k = n === 0 ? g : newGroup("L");
      nanoBox(k, u, 0.32, 0.055, 0.07, GOLD, 0, -0.1, 0);
      nanoBox(k, u, 0.045, 0.34, 0.07, RED, 0.15, -0.0, 0);
      nanoBox(k, u, 0.045, 0.34, 0.07, RED, -0.15, -0.0, 0);
      nanoGeo(k, u, new THREE.ConeGeometry(0.13, 0.95, 4, 8), ICE, 0, -0.6, 0, { rx: Math.PI, sz: 0.3, metal: 0.95, rough: 0.12, emissive: CYAN_E, ei: 0.8 });
      nanoGeo(k, u, new THREE.ConeGeometry(0.05, 1.0, 4, 8), CYAN, 0, -0.62, 0, { rx: Math.PI, sz: 0.5, ...EMI });
    }
    muzzle.position.set(0, -1.1, 0);
  } else if (id === 7) {
    /* ---- POWER HAMMER + BATTERING RAM ---- */
    nanoGeo(g, u, new THREE.CylinderGeometry(0.055, 0.055, 1.15, 10, 6), GOLD, 0, -0.6, 0);
    nanoBox(g, u, 0.15, 0.1, 0.15, RED, 0, -0.1, 0);
    nanoBox(g, u, 0.8, 0.46, 0.46, RED, 0, -1.22, 0);
    nanoBox(g, u, 0.1, 0.52, 0.52, GOLD, 0.4, -1.22, 0);
    nanoBox(g, u, 0.1, 0.52, 0.52, GOLD, -0.4, -1.22, 0);
    nanoBox(g, u, 0.5, 0.3, 0.03, CYAN, 0, -1.22, 0.25, EMI);
    nanoBox(g, u, 0.5, 0.3, 0.03, CYAN, 0, -1.22, -0.25, EMI);
    nanoGeo(g, u, new THREE.CylinderGeometry(0.15, 0.2, 0.4, 12, 3), GOLD, 0, -1.68, 0);
    nanoGeo(g, u, new THREE.CylinderGeometry(0.1, 0.1, 0.04, 12), CYAN, 0, -1.9, 0, EMI);
    muzzle.position.set(0, -1.4, 0);
  } else if (id === 8) {
    /* ---- MICRO-MISSILE pods (both shoulders) ---- */
    for (const key of ["SR", "SL"] as const) {
      const p = key === "SR" ? g : newGroup("SL");
      p.rotation.x = -0.55;
      nanoBox(p, u, 0.32, 0.22, 0.46, DRED, 0, 0, 0.1);
      nanoBox(p, u, 0.34, 0.05, 0.4, GOLD, 0, 0.13, 0.1);
      for (let r = 0; r < 2; r++) {
        for (let c = 0; c < 3; c++) {
          const x = (c - 1) * 0.09;
          const y = (r - 0.5) * 0.09;
          nanoGeo(p, u, new THREE.CylinderGeometry(0.04, 0.04, 0.12, 8), 0x15161a, x, y, 0.33, { rx: Math.PI / 2 });
          nanoGeo(p, u, new THREE.ConeGeometry(0.032, 0.09, 8), 0xffffff, x, y, 0.36, { rx: Math.PI / 2, emissive: 0xff4a2a, ei: 1.2, metal: 0.2 });
        }
      }
      if (key === "SL") {
        const m = new THREE.Object3D();
        m.position.set(0, 0, 0.4);
        p.add(m);
        extraMuzzles.push(m);
      }
    }
    muzzle.position.set(0, 0, 0.4);
  } else if (id === 9) {
    /* ---- ENERGY SHIELD on a NANO SHIELD plate (left hand) ---- */
    hand = "L";
    nanoGeo(g, u, new THREE.CylinderGeometry(1.08, 1.08, 0.08, 6), GOLD, 0, -0.75, 0);
    nanoGeo(g, u, new THREE.CylinderGeometry(0.95, 0.95, 0.13, 6), RED, 0, -0.75, 0);
    nanoGeo(g, u, new THREE.CylinderGeometry(0.55, 0.55, 0.16, 6), GOLD, 0, -0.78, 0);
    nanoGeo(g, u, new THREE.CylinderGeometry(0.3, 0.3, 0.18, 6), CYAN, 0, -0.8, 0, EMI);
    nanoBox(g, u, 1.5, 0.15, 0.09, GOLD, 0, -0.79, 0);
    nanoBox(g, u, 0.09, 0.15, 1.5, GOLD, 0, -0.79, 0);
    muzzle.position.set(0, -0.9, 0);
    glow = new THREE.Mesh(
      new THREE.CylinderGeometry(1.28, 1.28, 0.03, 6),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(0.4, 1.3, 2.2), transparent: true, opacity: 0.15, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
    );
    glow.position.set(0, -0.98, 0);
    glow.frustumCulled = false;
    g.add(glow);
  } else {
    /* ---- NANO GAUNTLET (Infinity Gauntlet holster) ---- */
    hand = "L";
    nanoBox(g, u, 0.3, 0.34, 0.3, GOLD, 0, 0.06, 0);
    nanoBox(g, u, 0.34, 0.06, 0.34, RED, 0, 0.24, 0);
    nanoBox(g, u, 0.36, 0.4, 0.36, RED, 0, -0.16, 0);
    nanoBox(g, u, 0.38, 0.07, 0.38, GOLD, 0, -0.02, 0);
    for (let i = 0; i < 4; i++) nanoBox(g, u, 0.075, 0.2, 0.09, GOLD, -0.13 + i * 0.087, -0.42, 0.1);
    nanoBox(g, u, 0.2, 0.2, 0.1, GOLD, 0.24, -0.2, 0); // thumb
    nanoBox(g, u, 0.34, 0.06, 0.36, GOLD, 0, -0.3, 0.1);
    const colors = [0x3aa0ff, 0xff3030, 0xb04aff, 0xff9a1a, 0x30ff6a, 0xffe93a];
    colors.forEach((c, i) => {
      const x = (i % 3 - 1) * 0.11;
      const y = -0.1 - Math.floor(i / 3) * 0.14;
      nanoBox(g, u, 0.1, 0.1, 0.03, GOLD, x, y, 0.2);
      stones.push(nanoGeo(g, u, new THREE.SphereGeometry(0.045, 12, 10), c, x, y, 0.225, { emissive: c, ei: 0.6, metal: 0 }));
    });
    muzzle.position.set(0, -0.5, 0);
  }
  return { id, group: g, mounts, u, hand, muzzle, extraMuzzles, glow, stones };
}

const easeOutCubic = (x: number) => 1 - Math.pow(1 - x, 3);
const easeInCubic = (x: number) => x * x * x;
const easeInOut = (x: number) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);
const easeOutBack = (x: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
};

const N = 170;
const OUT_T = 0.32;
const IN_T = 1.0;

export class NanoSystem {
  weapons: WeaponDef[];
  current = 0;
  pending = 0;
  phase: "idle" | "out" | "in" = "idle";
  t = 0;
  private rig: IronRig;
  private inst: THREE.InstancedMesh;
  private offs: THREE.Vector3[] = [];
  private delay: number[] = [];
  private seed: number[] = [];
  private dummy = new THREE.Object3D();
  private chest = new THREE.Vector3();
  private hand = new THREE.Vector3();
  private p = new THREE.Vector3();
  private q = new THREE.Vector3();
  private fromHand = false;

  constructor(rig: IronRig, scene: THREE.Scene) {
    this.rig = rig;
    this.weapons = Array.from({ length: WEAPON_COUNT }, (_, i) => makeWeapon(i));

    const geo = new THREE.BoxGeometry(0.075, 0.075, 0.075);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.inst = new THREE.InstancedMesh(geo, mat, N);
    this.inst.frustumCulled = false;
    const palette = [new THREE.Color(1.6, 0.2, 0.2), new THREE.Color(2.0, 1.5, 0.4), new THREE.Color(0.8, 1.8, 2.4), new THREE.Color(1.6, 1.7, 1.9)];
    for (let i = 0; i < N; i++) {
      this.offs.push(new THREE.Vector3((Math.random() - 0.5) * 0.7, (Math.random() - 0.3) * 0.9, (Math.random() - 0.5) * 0.5));
      this.delay.push(Math.random() * 0.4);
      this.seed.push(Math.random() * Math.PI * 2);
      this.inst.setColorAt(i, palette[i % palette.length]);
      this.dummy.scale.setScalar(0);
      this.dummy.updateMatrix();
      this.inst.setMatrixAt(i, this.dummy.matrix);
    }
    scene.add(this.inst);

    // initial weapon: repulsor, fully formed
    this.attach(0);
    this.setVisible(this.weapons[0], true);
  }

  get ready() {
    return this.phase === "idle";
  }

  get weapon() {
    return this.weapons[this.current];
  }

  setVisible(w: WeaponDef, v: boolean) {
    for (const m of w.mounts) m.group.visible = v;
  }

  private setScale(w: WeaponDef, s: number) {
    for (const m of w.mounts) m.group.scale.setScalar(s);
  }

  /** hide / show the weapon that is currently formed (used by the suit removal animation) */
  setHidden(hide: boolean) {
    if (hide) this.setVisible(this.weapon, false);
    else if (this.ready) this.setVisible(this.weapon, true);
  }

  /** hard reset back to the repulsor */
  resetTo(i: number) {
    this.phase = "idle";
    this.t = 0;
    for (const w of this.weapons) {
      this.setVisible(w, false);
      w.u.uLiquid.value = 0;
      this.setScale(w, 1);
    }
    this.current = i;
    this.pending = i;
    this.attach(i);
    this.setVisible(this.weapons[i], true);
  }

  private parentFor(key: MountKey): THREE.Object3D {
    const r = this.rig;
    switch (key) {
      case "R":
        return r.handR;
      case "L":
        return r.handL;
      case "C":
        return r.mountC;
      case "SR":
        return r.mountSR;
      case "SL":
        return r.mountSL;
      case "FR":
        return r.mountFR;
      default:
        return r.mountFL;
    }
  }

  private attach(i: number) {
    for (const m of this.weapons[i].mounts) this.parentFor(m.key).add(m.group);
  }

  /** returns true if a morph was started */
  switchTo(i: number) {
    if (i === this.current && this.phase === "idle") return false;
    if (this.phase === "idle") {
      this.pending = i;
      this.phase = "out";
      this.t = 0;
      this.fromHand = true;
      return true;
    }
    this.pending = i;
    return false;
  }

  update(dt: number, time: number) {
    for (const w of this.weapons) w.u.uTime.value = time;
    const cur = this.weapons[this.current];

    if (this.phase === "out") {
      this.t += dt;
      const k = Math.min(1, this.t / OUT_T);
      cur.u.uLiquid.value = easeInCubic(k);
      this.setScale(cur, 1 - 0.5 * k);
      if (k >= 1) {
        this.setVisible(cur, false);
        cur.u.uLiquid.value = 0;
        this.setScale(cur, 1);
        this.current = this.pending;
        this.attach(this.current);
        const nw = this.weapons[this.current];
        this.setVisible(nw, true);
        nw.u.uLiquid.value = 1;
        this.setScale(nw, 0.35);
        this.phase = "in";
        this.t = 0;
        this.fromHand = false;
      }
    } else if (this.phase === "in") {
      this.t += dt;
      const k = Math.min(1, this.t / IN_T);
      cur.u.uLiquid.value = 1 - easeOutCubic(Math.max(0, (k - 0.25) / 0.75));
      this.setScale(cur, 0.35 + 0.65 * easeOutBack(Math.min(1, k * 1.1)));
      if (this.pending !== this.current && k > 0.6) {
        // a new request came in: dissolve right away
        this.phase = "out";
        this.t = 0;
        this.fromHand = true;
      }
      if (k >= 1) {
        cur.u.uLiquid.value = 0;
        this.setScale(cur, 1);
        this.phase = "idle";
      }
    }

    this.updateParticles();
  }

  private updateParticles() {
    const active = this.phase !== "idle";
    if (!active) {
      if (this.inst.visible) {
        this.inst.visible = false;
      }
      return;
    }
    this.inst.visible = true;
    this.rig.root.updateMatrixWorld(true);
    this.chest.set(0, 0.45, 0);
    this.rig.body.localToWorld(this.chest);
    const w = this.weapons[this.current];
    // mount (parent of group) world pos – for "out" it's the old weapon's mount
    w.group.parent!.getWorldPosition(this.hand);

    const dur = this.phase === "out" ? OUT_T : IN_T * 0.75;
    for (let i = 0; i < N; i++) {
      const u = (this.t - (this.phase === "out" ? this.delay[i] * 0.3 : this.delay[i])) / (this.phase === "out" ? dur * 0.7 : 0.5);
      if (u <= 0 || u >= 1) {
        this.dummy.scale.setScalar(0);
      } else {
        const e = easeInOut(u);
        const a = this.fromHand ? this.hand : this.chest;
        const b = this.fromHand ? this.chest : this.hand;
        this.q.copy(this.offs[i]);
        this.rig.body.localToWorld(this.q);
        // start point = a, but spread around the torso when starting from chest
        if (!this.fromHand) {
          this.p.copy(this.q);
        } else {
          this.p.copy(a);
        }
        const end = this.fromHand ? this.q : b;
        this.p.lerp(end, e);
        const sw = Math.sin(Math.PI * u) * 0.45;
        const ph = this.seed[i] + u * 9;
        this.p.x += Math.sin(ph) * sw;
        this.p.y += Math.cos(ph * 1.3) * sw;
        this.p.z += Math.sin(ph * 0.7) * sw;
        this.dummy.position.copy(this.p);
        this.dummy.scale.setScalar(0.6 + Math.sin(Math.PI * u) * 1.1);
        this.dummy.rotation.set(ph, ph * 0.7, 0);
      }
      this.dummy.updateMatrix();
      this.inst.setMatrixAt(i, this.dummy.matrix);
    }
    this.inst.instanceMatrix.needsUpdate = true;
  }

  dispose() {
    this.inst.removeFromParent();
    this.inst.geometry.dispose();
    (this.inst.material as THREE.Material).dispose();
  }
}
