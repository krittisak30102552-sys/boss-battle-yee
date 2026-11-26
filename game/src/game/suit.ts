import * as THREE from "three";
import { IronRig, setFlash } from "./builders";
import { sfx } from "./audio";

/* ------------------------------------------------------------------ */
/*  SUIT SYSTEM                                                        */
/*  Cinematic armor removal / re-assembly:                             */
/*   remove : unlock glow → plates release top→bottom and drift out    */
/*            around Tony → hover → plates snap back (feet → helmet)   */
/*            into an empty suit → thrusters ignite → suit flies off   */
/*   put on : suit flies in while opening → plates wrap around Tony    */
/*            (boots first, helmet last) → chest flash                 */
/* ------------------------------------------------------------------ */

const easeOutCubic = (x: number) => 1 - Math.pow(1 - x, 3);
const easeInOutCubic = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const smooth = (x: number) => x * x * (3 - 2 * x);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const damp = (a: number, b: number, k: number, dt: number) => a + (b - a) * (1 - Math.exp(-k * dt));
const TAU = Math.PI * 2;
const angDiff = (a: number, b: number) => {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
};
const hash = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/* ---------------- Tony Stark (the man inside) ---------------- */

export interface TonyRig {
  root: THREE.Group;
  body: THREE.Group;
  head: THREE.Group;
  shR: THREE.Group;
  elR: THREE.Group;
  shL: THREE.Group;
  elL: THREE.Group;
  hipR: THREE.Group;
  kneeR: THREE.Group;
  hipL: THREE.Group;
  kneeL: THREE.Group;
  reactor: THREE.Mesh;
}

function buildTony(): TonyRig {
  const skin = new THREE.MeshStandardMaterial({ color: 0xd9a98a, roughness: 0.75 });
  const hair = new THREE.MeshStandardMaterial({ color: 0x2b1c15, roughness: 0.9 });
  const shirt = new THREE.MeshStandardMaterial({ color: 0x1b1d25, roughness: 0.88 });
  const pants = new THREE.MeshStandardMaterial({ color: 0x2c3442, roughness: 0.9 });
  const shoe = new THREE.MeshStandardMaterial({ color: 0x15161a, roughness: 0.7 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1a1210, roughness: 0.9 });

  const root = new THREE.Group();
  const add = (p: THREE.Object3D, geo: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, y, z);
    mesh.scale.set(sx, sy, sz);
    mesh.castShadow = true;
    p.add(mesh);
    return mesh;
  };
  const piv = (p: THREE.Object3D, x: number, y: number, z: number) => {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    p.add(g);
    return g;
  };

  const body = piv(root, 0, 1.0, 0);
  // torso: black tee
  add(body, new THREE.CylinderGeometry(0.33, 0.27, 0.72, 16), shirt, 0, 0.38, 0, 1, 1, 0.62);
  add(body, new THREE.SphereGeometry(0.16, 12, 10), shirt, -0.36, 0.7, 0, 1, 1, 1);
  add(body, new THREE.SphereGeometry(0.16, 12, 10), shirt, 0.36, 0.7, 0, 1, 1, 1);
  add(body, new THREE.CylinderGeometry(0.075, 0.085, 0.14, 10), skin, 0, 0.8, 0);
  // arc reactor
  const reactor = add(
    body,
    new THREE.CylinderGeometry(0.06, 0.06, 0.03, 20),
    new THREE.MeshStandardMaterial({ color: 0xcffaff, emissive: 0x55ddff, emissiveIntensity: 4, roughness: 0.2 }),
    0,
    0.55,
    0.185
  );
  reactor.rotation.x = Math.PI / 2;
  reactor.castShadow = false;
  const ring = add(body, new THREE.TorusGeometry(0.075, 0.012, 8, 20), new THREE.MeshStandardMaterial({ color: 0x8a9099, metalness: 0.8, roughness: 0.3 }), 0, 0.55, 0.185);
  ring.castShadow = false;

  // head
  const head = piv(body, 0, 0.88, 0);
  add(head, new THREE.SphereGeometry(0.17, 20, 16), skin, 0, 0.12, 0, 0.94, 1.1, 1);
  add(head, new THREE.SphereGeometry(0.178, 18, 12, 0, TAU, 0, Math.PI * 0.55), hair, 0, 0.145, -0.012, 0.96, 1.1, 1.02);
  add(head, new THREE.BoxGeometry(0.12, 0.04, 0.03), hair, 0, 0.035, 0.155); // goatee
  add(head, new THREE.BoxGeometry(0.1, 0.014, 0.025), hair, 0, 0.078, 0.158); // mustache
  add(head, new THREE.BoxGeometry(0.03, 0.05, 0.03), hair, 0, 0.005, 0.15);
  for (const s of [-1, 1]) {
    add(head, new THREE.BoxGeometry(0.04, 0.02, 0.02), dark, s * 0.06, 0.15, 0.155); // eyes
    add(head, new THREE.BoxGeometry(0.06, 0.012, 0.02), hair, s * 0.06, 0.185, 0.155); // brows
  }

  // arms
  const makeArm = (side: number) => {
    const sh = piv(body, side * 0.43, 0.7, 0);
    add(sh, new THREE.CapsuleGeometry(0.075, 0.22, 4, 10), shirt, 0, -0.17, 0);
    const el = piv(sh, 0, -0.36, 0);
    add(el, new THREE.CapsuleGeometry(0.062, 0.26, 4, 10), skin, 0, -0.18, 0);
    add(el, new THREE.SphereGeometry(0.065, 10, 8), skin, 0, -0.4, 0, 1, 1.15, 0.8);
    return { sh, el };
  };
  const aR = makeArm(-1);
  const aL = makeArm(1);

  // legs
  const makeLeg = (side: number) => {
    const hip = piv(root, side * 0.12, 1.0, 0);
    add(hip, new THREE.CapsuleGeometry(0.095, 0.38, 4, 10), pants, 0, -0.27, 0);
    const knee = piv(hip, 0, -0.52, 0);
    add(knee, new THREE.CapsuleGeometry(0.078, 0.34, 4, 10), pants, 0, -0.24, 0);
    add(knee, new THREE.BoxGeometry(0.14, 0.1, 0.3), shoe, 0, -0.46, 0.06);
    return { hip, knee };
  };
  const lR = makeLeg(-1);
  const lL = makeLeg(1);

  root.visible = false;
  return { root, body, head, shR: aR.sh, elR: aR.el, shL: aL.sh, elL: aL.el, hipR: lR.hip, kneeR: lR.knee, hipL: lL.hip, kneeL: lL.knee, reactor };
}

/* ---------------- armor pieces ---------------- */

interface Piece {
  mesh: THREE.Mesh;
  base: THREE.Vector3;
  baseRot: THREE.Euler;
  baseScale: THREE.Vector3;
  off: THREE.Vector3; // exploded offset (suit-root axes)
  tumble: THREE.Vector3;
  order: number; // 0 = top of the suit … 1 = bottom
  seed: number;
  flashable: boolean;
  released: boolean;
  locked: boolean;
}

interface ArmorDebris {
  piece: Piece;
  parent: THREE.Object3D;
  velocity: THREE.Vector3;
  spin: THREE.Vector3;
  settled: boolean;
}

interface AssemblyParticle {
  target: THREE.Vector3;
  start: number;
  duration: number;
  radius: number;
  seed: number;
}

export interface SuitCtx {
  rig: IronRig;
  scene: THREE.Scene;
  spark: (p: THREE.Vector3, color: THREE.Color, count: number, speed: number) => void;
  player: () => { pos: THREE.Vector3; heading: number };
  bossPos: () => THREE.Vector3;
  setWeaponHidden: (hide: boolean) => void;
  onDonned: () => void;
}

type Mode = "none" | "remove" | "takeoff" | "approach" | "close";

// remove timeline
const R_UNLOCK = 0.4;
const R_SPREAD = 0.75;
const R_PEEL = 0.7;
const R_HOLD = 0.35;
const R_CSPREAD = 0.45;
const R_CLOSE = 0.45;
const R_TOTAL = R_UNLOCK + R_SPREAD + R_PEEL + R_HOLD + R_CSPREAD + R_CLOSE;
// put-on timeline
const P_OPEN = 0.7;
const P_CSPREAD = 0.6;
const P_CLOSE = 0.5;

export class SuitSystem {
  active = false; // true while Tony is out of the armor
  mode: Mode = "none";
  tony: TonyRig;
  /** 0..1 – used by the camera for a gentle cinematic push-in */
  cinematic = 0;
  private t = 0;
  private ctx: SuitCtx;
  private pieces: Piece[] = [];
  private debris: ArmorDebris[] = [];
  private assemblyMesh!: THREE.InstancedMesh;
  private assemblyParticles: AssemblyParticle[] = [];
  private assemblyDummy = new THREE.Object3D();
  private root: THREE.Group;
  private tmp = new THREE.Vector3();
  private tmp2 = new THREE.Vector3();
  private gesture = 0;
  private reactorBoost = 0;
  private summoning = false;
  private cyan = new THREE.Color(0.5, 1.8, 2.6);
  private gold = new THREE.Color(2.4, 1.6, 0.5);
  private white = new THREE.Color(2.4, 2.6, 2.8);

  constructor(ctx: SuitCtx) {
    this.ctx = ctx;
    this.root = ctx.rig.root;
    this.tony = buildTony();
    ctx.scene.add(this.tony.root);
    this.collectPieces();
    this.createAssemblyStream();
  }

  private createAssemblyStream() {
    const count = 160;
    const material = new THREE.MeshStandardMaterial({
      color: 0xd8f5ff,
      metalness: 0.98,
      roughness: 0.12,
      emissive: 0x174a61,
      emissiveIntensity: 0.7,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
    });
    this.assemblyMesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.035, 0), material, count);
    this.assemblyMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.assemblyMesh.frustumCulled = false;
    this.assemblyMesh.renderOrder = 5;
    this.assemblyMesh.visible = false;
    this.ctx.scene.add(this.assemblyMesh);

    this.root.updateMatrixWorld(true);
    const chest = new THREE.Vector3(0, 1.55, 0.2);
    const hidden = new THREE.Object3D();
    hidden.scale.setScalar(0);
    hidden.updateMatrix();
    this.assemblyParticles = Array.from({ length: count }, (_, i) => {
      const seed = hash(i + 701);
      const piece = this.pieces[Math.floor(hash(i + 401) * this.pieces.length)];
      const target = this.root.worldToLocal(piece.mesh.getWorldPosition(new THREE.Vector3())).clone();
      target.x += (hash(i + 801) - 0.5) * 0.08;
      target.y += (hash(i + 901) - 0.5) * 0.08;
      target.z += (hash(i + 1001) - 0.5) * 0.08;

      let start = clamp01(target.distanceTo(chest) / 2.4) * 0.42;
      if (target.y > 1.8) start = Math.max(start, 0.62 + seed * 0.06);
      else if (target.y > 1.1 && target.y < 1.75) start *= 0.45;

      this.assemblyMesh.setMatrixAt(i, hidden.matrix);
      return {
        target,
        start,
        duration: 0.28 + hash(i + 1101) * 0.12,
        radius: 0.012 + hash(i + 1201) * 0.022,
        seed,
      };
    });
  }

  private updateAssemblyStream(t: number, time: number) {
    this.root.updateMatrixWorld(true);
    this.tony.root.updateMatrixWorld(true);
    const origin = this.tony.reactor.getWorldPosition(this.tmp);

    this.assemblyParticles.forEach((particle, i) => {
      const elapsed = t - particle.start;
      const dummy = this.assemblyDummy;
      if (elapsed < 0 || elapsed > particle.duration) {
        dummy.position.set(0, -20, 0);
        dummy.scale.setScalar(0);
      } else {
        const progress = smooth(clamp01(elapsed / particle.duration));
        const target = this.root.localToWorld(particle.target.clone());
        dummy.position.copy(origin).lerp(target, progress);
        dummy.position.y += Math.sin(Math.PI * progress) * (0.12 + particle.radius * 3);
        const pulse = 0.78 + 0.22 * Math.sin(time * 28 + particle.seed * TAU);
        dummy.scale.setScalar(particle.radius * (0.45 + Math.sin(Math.PI * progress) * 0.75) * pulse);
        dummy.rotation.set(time + particle.seed * TAU, time * 1.7 + particle.seed * 3, time * 0.8);
      }
      dummy.updateMatrix();
      this.assemblyMesh.setMatrixAt(i, dummy.matrix);
    });
    this.assemblyMesh.instanceMatrix.needsUpdate = true;
    this.assemblyMesh.visible = true;
  }

  get companionReady() {
    return this.active && this.mode === "none";
  }

  /** every armor mesh gets an exploded-view position around the body */
  private collectPieces() {
    const rig = this.ctx.rig;
    this.root.updateMatrixWorld(true);
    const meshes: THREE.Mesh[] = [];
    this.root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && !rig.flames.includes(m)) meshes.push(m);
    });
    const worlds = meshes.map((m) => m.getWorldPosition(new THREE.Vector3()));
    let minY = Infinity;
    let maxY = -Infinity;
    for (const w of worlds) {
      minY = Math.min(minY, w.y);
      maxY = Math.max(maxY, w.y);
    }
    const center = new THREE.Vector3(0, 1.35, 0);
    meshes.forEach((m, i) => {
      const w = worlds[i];
      const h1 = hash(i + 1);
      const h2 = hash(i + 101);
      const h3 = hash(i + 202);
      const h4 = hash(i + 303);
      const rv = w.clone().sub(center);
      const side = rv.x !== 0 ? Math.sign(rv.x) : h1 > 0.5 ? 1 : -1;
      const d = new THREE.Vector3(rv.x, rv.y * 0.5, rv.z);
      if (Math.abs(rv.x) < 0.22) {
        // central pieces: front plates go forward-and-out, back plates swing out to the sides
        if (rv.z > 0.08) d.set(side * 0.35, d.y * 0.3, 1);
        else if (rv.z < -0.08) d.set(side * 1.0, 0.25, -0.15);
        else d.set(side * 1.0, 0.4, 0.2);
      }
      d.y += 0.12;
      if (d.z < -0.3) {
        d.z = -0.3;
        d.x += side * 0.7; // never fly straight into the camera
      }
      d.normalize();
      const dist = 0.7 + h2 * 0.55 + (w.y > 1.8 ? 0.25 : 0);
      const off = d.multiplyScalar(dist);
      off.y += 0.18 + h3 * 0.25 + (w.y - minY) * 0.12;
      this.pieces.push({
        mesh: m,
        base: m.position.clone(),
        baseRot: m.rotation.clone(),
        baseScale: m.scale.clone(),
        off,
        tumble: new THREE.Vector3((h2 - 0.5) * 1.0, (h3 - 0.5) * 1.2, (h4 - 0.5) * 0.8),
        order: 1 - clamp01((w.y - minY) / (maxY - minY)),
        seed: h4,
        flashable: (m.material as THREE.MeshStandardMaterial).emissive.getHex() === 0,
        released: false,
        locked: false,
      });
    });
  }

  /* ---------------- control ---------------- */

  toggle(): boolean {
    if (this.mode !== "none") return this.active;
    const { pos, heading } = this.ctx.player();
    for (const p of this.pieces) {
      p.released = false;
      p.locked = false;
    }
    this.t = 0;
    this.ctx.setWeaponHidden(true);
    this.root.visible = true;
    this.assemblyMesh.visible = false;
    if (!this.active) {
      this.active = true;
      this.mode = "remove";
      this.tony.root.visible = true;
      this.root.position.copy(pos);
      this.root.rotation.set(0, heading, 0);
      this.setFlames(false, 0);
      sfx.suitUnlock();
    } else {
      this.mode = "approach";
      this.tony.root.visible = true;
      sfx.whoosh();
    }
    return this.active;
  }

  /** Re-form the reserve Mark 50 from Tony's Arc Reactor using a nanotech stream. */
  summonForTony() {
    this.clearDebris();
    this.restorePieces();
    this.ctx.setWeaponHidden(true);
    this.assemblyMesh.visible = false;
    this.active = true;
    // Start the armor around Tony; never fly a complete suit in from off-screen.
    this.mode = "close";
    this.t = 0;
    this.summoning = true;
    const { pos, heading } = this.ctx.player();
    this.tony.root.visible = true;
    this.root.visible = true;
    this.root.position.copy(pos);
    this.root.rotation.set(0, heading, 0);
    this.setFlames(false, 0);
    for (const piece of this.pieces) {
      piece.released = false;
      piece.locked = false;
      // Keep every armor plate hidden at its final location. The cinematic grows
      // each surface out from Tony's chest; no plates hover or fly toward him.
      piece.mesh.position.copy(piece.base);
      piece.mesh.rotation.copy(piece.baseRot);
      piece.mesh.scale.set(0, 0, 0);
    }
    sfx.suitUnlock();
  }

  /** Break the armor apart around Tony and leave every plate on the ground. */
  breakApart() {
    if (this.active && this.mode === "none") return;
    this.root.updateMatrixWorld(true);
    this.debris = [];
    this.ctx.setWeaponHidden(true);
    this.assemblyMesh.visible = false;
    this.tony.root.visible = true;
    this.active = true;
    this.mode = "none";
    this.t = 0;
    this.setFlames(false, 0);

    for (const piece of this.pieces) {
      const parent = piece.mesh.parent;
      if (!parent) continue;
      const world = piece.mesh.getWorldPosition(new THREE.Vector3());
      const side = world.x - this.root.position.x;
      const front = world.z - this.root.position.z;
      const outward = new THREE.Vector3(side + (Math.random() - 0.5) * 0.9, 0, front + (Math.random() - 0.5) * 0.9);
      if (outward.lengthSq() < 0.01) outward.set(Math.random() - 0.5, 0, Math.random() - 0.5);
      outward.normalize();
      this.ctx.scene.attach(piece.mesh);
      this.debris.push({
        piece,
        parent,
        velocity: new THREE.Vector3(outward.x * (1.2 + Math.random() * 2.2), 2.2 + Math.random() * 3.8, outward.z * (1.2 + Math.random() * 2.2)),
        spin: new THREE.Vector3((Math.random() - 0.5) * 7, (Math.random() - 0.5) * 7, (Math.random() - 0.5) * 7),
        settled: false,
      });
    }
    this.root.visible = false;
    sfx.suitUnlock();
  }

  private updateDebris(dt: number) {
    for (const item of this.debris) {
      if (item.settled) continue;
      const mesh = item.piece.mesh;
      item.velocity.y -= 18 * dt;
      mesh.position.addScaledVector(item.velocity, dt);
      mesh.rotation.x += item.spin.x * dt;
      mesh.rotation.y += item.spin.y * dt;
      mesh.rotation.z += item.spin.z * dt;
      if (mesh.position.y <= 0.055) {
        mesh.position.y = 0.055;
        item.velocity.set(0, 0, 0);
        item.spin.set(0, 0, 0);
        item.settled = true;
      }
    }
  }

  private clearDebris() {
    for (const item of this.debris) {
      const { piece, parent } = item;
      parent.add(piece.mesh);
      piece.mesh.position.copy(piece.base);
      piece.mesh.rotation.copy(piece.baseRot);
      piece.mesh.scale.copy(piece.baseScale);
    }
    this.debris = [];
  }

  reset() {
    this.clearDebris();
    this.mode = "none";
    this.active = false;
    this.t = 0;
    this.cinematic = 0;
    this.summoning = false;
    this.assemblyMesh.visible = false;
    this.tony.root.visible = false;
    this.root.visible = true;
    this.root.rotation.set(0, 0, 0);
    this.restorePieces();
    this.setFlames(false, 0);
    this.ctx.setWeaponHidden(false);
  }

  private restorePieces() {
    for (const p of this.pieces) {
      p.mesh.position.copy(p.base);
      p.mesh.rotation.copy(p.baseRot);
      p.mesh.scale.copy(p.baseScale);
    }
    setFlash(this.ctx.rig.mats, 0, 1, 0, 0);
  }

  private setFlames(on: boolean, power: number) {
    for (const f of this.ctx.rig.flames) {
      f.visible = on;
      if (on) f.scale.set(0.8, (0.55 + 0.35 * power) * (0.85 + Math.sin(performance.now() * 0.05 + f.id) * 0.15), 0.8);
    }
  }

  /** all joints relax to a neutral standing pose so the exploded layout lines up */
  private neutralize(dt: number, k: number) {
    const r = this.ctx.rig;
    for (const g of [r.body, r.head, r.shR, r.elR, r.handR, r.shL, r.elL, r.handL, r.hipR, r.kneeR, r.hipL, r.kneeL]) {
      g.rotation.x = damp(g.rotation.x, 0, k, dt);
      g.rotation.y = damp(g.rotation.y, 0, k, dt);
      g.rotation.z = damp(g.rotation.z, 0, k, dt);
    }
  }

  private place(p: Piece, e: number, time: number, glow: number, shiver: number) {
    const m = p.mesh;
    const bob = Math.sin(time * 2.1 + p.seed * TAU) * 0.045 * e;
    const j = shiver * 0.012;
    m.position.set(
      p.base.x + p.off.x * e + Math.sin(time * 73 + p.seed * 50) * j,
      p.base.y + p.off.y * e + bob + Math.cos(time * 61 + p.seed * 37) * j,
      p.base.z + p.off.z * e + Math.sin(time * 67 + p.seed * 23) * j
    );
    const drift = Math.sin(time * 1.4 + p.seed * 9) * 0.07 * e;
    m.rotation.set(p.baseRot.x + p.tumble.x * e + drift, p.baseRot.y + p.tumble.y * e, p.baseRot.z + p.tumble.z * e - drift);
    if (p.flashable) (m.material as THREE.MeshStandardMaterial).emissive.setRGB(0.03 * glow, 0.2 * glow, 0.32 * glow);
  }

  private burst(p: Piece, color: THREE.Color, n: number, speed: number) {
    this.root.updateMatrixWorld(true);
    p.mesh.getWorldPosition(this.tmp2);
    this.ctx.spark(this.tmp2, color, n, speed);
  }

  /* ---------------- per-frame ---------------- */

  update(dt: number, time: number) {
    this.updateDebris(dt);
    // cinematic camera factor
    const cine = this.mode === "remove" || this.mode === "approach" || this.mode === "close";
    this.cinematic = damp(this.cinematic, cine ? 1 : 0, cine ? 3 : 2.2, dt);
    this.gesture = damp(this.gesture, this.mode === "remove" && this.t > 0.25 && this.t < R_UNLOCK + R_SPREAD + R_PEEL ? 1 : 0, 6, dt);
    this.reactorBoost = damp(this.reactorBoost, 0, 3, dt);

    // chest light
    const cm = this.ctx.rig.chest.material as THREE.MeshStandardMaterial;
    if (this.active || this.mode !== "none") cm.emissiveIntensity = 3.5 + Math.sin(time * 4) * 1.2 + this.reactorBoost * 6;
    (this.tony.reactor.material as THREE.MeshStandardMaterial).emissiveIntensity = 3.5 + Math.sin(time * 4) * 0.8 + this.reactorBoost * 4;

    if (this.mode === "none") {
      if (this.active) this.companion(dt, time);
      return;
    }
    this.root.updateMatrixWorld(true);
    this.t += dt;
    switch (this.mode) {
      case "remove":
        this.updateRemove(dt, time);
        break;
      case "takeoff":
        this.updateTakeoff(dt, time);
        break;
      case "approach":
        this.updateApproach(dt, time);
        break;
      case "close":
        this.updateClose(dt, time);
        break;
    }
  }

  private updateRemove(dt: number, time: number) {
    const t = this.t;
    this.neutralize(dt, 14);
    const unlock = clamp01(t / R_UNLOCK);
    if (t < dt * 1.5) this.reactorBoost = 1;

    for (const p of this.pieces) {
      const ps = R_UNLOCK + p.order * R_SPREAD;
      const cs = R_UNLOCK + R_SPREAD + R_PEEL + R_HOLD + (1 - p.order) * R_CSPREAD;
      const up = clamp01((t - ps) / R_PEEL);
      const uc = clamp01((t - cs) / R_CLOSE);
      const e = easeOutCubic(up) * (1 - easeInOutCubic(uc));

      if (up > 0 && !p.released) {
        p.released = true;
        this.burst(p, this.cyan, 3, 3);
        if (hash(p.seed * 77) > 0.55) sfx.clank();
      }
      if (uc >= 1 && !p.locked) {
        p.locked = true;
        this.burst(p, this.white, 2, 2);
        sfx.clank();
      }

      let glow = 0.2 * e * (1 - uc);
      if (t < R_UNLOCK) glow = 0.75 * smooth(unlock) * (0.75 + 0.25 * Math.sin(t * 55 + p.seed * 8));
      else {
        const pulse = up > 0 && up < 1 ? Math.sin(Math.PI * up) : 0;
        const pulse2 = uc > 0 && uc < 1 ? Math.sin(Math.PI * uc) : 0;
        glow = Math.max(glow, pulse * 0.95, pulse2 * 0.95, t > ps ? 0 : 0.75 * (1 - smooth(clamp01((t - R_UNLOCK) / 0.3))));
      }
      this.place(p, e, time, glow, t < ps ? unlock : 0);
    }

    // the empty suit powers on when it re-locks – the chest flares
    if (t > R_TOTAL - R_CLOSE - 0.05 && this.reactorBoost < 0.5 && t < R_TOTAL - 0.1) this.reactorBoost = Math.max(this.reactorBoost, 0.6);

    if (t >= R_TOTAL) {
      this.restorePieces();
      this.mode = "takeoff";
      this.t = 0;
      this.reactorBoost = 1;
      sfx.whoosh();
      this.ctx.setWeaponHidden(false);
    }
  }

  private orbitTarget(time: number, out: THREE.Vector3) {
    const b = this.ctx.bossPos();
    const orbit = time * 0.72;
    return out.set(b.x + Math.cos(orbit) * 7.5, 3.4 + Math.sin(time * 2.1) * 0.8, b.z + Math.sin(orbit) * 7.5);
  }

  private faceBoss(dt: number, k: number) {
    const b = this.ctx.bossPos();
    const want = Math.atan2(b.x - this.root.position.x, b.z - this.root.position.z);
    this.root.rotation.y += angDiff(this.root.rotation.y, want) * (1 - Math.exp(-k * dt));
  }

  private updateTakeoff(dt: number, time: number) {
    const u = clamp01(this.t / 1.2);
    const target = this.orbitTarget(time, this.tmp);
    // accelerate smoothly: slow rise first, then glide to the orbit point
    const k = 0.6 + 2.6 * smooth(clamp01(this.t / 0.9));
    this.root.position.x = damp(this.root.position.x, target.x, k, dt);
    this.root.position.z = damp(this.root.position.z, target.z, k, dt);
    this.root.position.y = damp(this.root.position.y, target.y, 0.9 + 2.2 * smooth(u), dt);
    this.faceBoss(dt, 5);
    this.root.rotation.x = damp(this.root.rotation.x, -0.1 * smooth(u), 5, dt);
    this.neutralize(dt, 10);
    this.setFlames(true, smooth(clamp01(this.t / 0.4)) * 1.2);
    if (this.t > 1.2) {
      this.mode = "none";
      this.t = 0;
    }
  }

  private companion(dt: number, time: number) {
    const r = this.root;
    const target = this.orbitTarget(time, this.tmp);
    r.position.x = damp(r.position.x, target.x, 2.6, dt);
    r.position.y = damp(r.position.y, target.y, 3.0, dt);
    r.position.z = damp(r.position.z, target.z, 2.6, dt);
    this.faceBoss(dt, 8);
    r.rotation.x = damp(r.rotation.x, -0.08, 5, dt);
    r.rotation.z = damp(r.rotation.z, 0, 5, dt);
    this.setFlames(true, 0.8);
  }

  private updateApproach(dt: number, time: number) {
    const t = this.t;
    const { pos, heading } = this.ctx.player();
    const r = this.root;
    this.neutralize(dt, 8);

    // fly toward Tony, accelerating smoothly
    const k = 1.3 + 4.5 * smooth(clamp01(t / 1.0));
    r.position.x = damp(r.position.x, pos.x, k, dt);
    r.position.y = damp(r.position.y, pos.y, k, dt);
    r.position.z = damp(r.position.z, pos.z, k, dt);
    r.rotation.y += angDiff(r.rotation.y, heading) * (1 - Math.exp(-4 * dt));
    r.rotation.x = damp(r.rotation.x, 0, 4, dt);

    // the suit opens up as it comes in
    for (const p of this.pieces) {
      const e = easeOutCubic(clamp01((t - p.order * 0.25) / P_OPEN));
      if (e > 0 && !p.released) {
        p.released = true;
        this.burst(p, this.cyan, 2, 2.5);
        if (hash(p.seed * 31) > 0.7) sfx.clank();
      }
      this.place(p, e, time, 0.5 * Math.sin(Math.PI * Math.min(1, e)) + 0.15 * e, 0);
    }

    const dist = Math.hypot(r.position.x - pos.x, r.position.y - pos.y, r.position.z - pos.z);
    const thr = clamp01(1 - dist / 6);
    this.setFlames(dist > 0.9, 0.4 + thr);
    if ((dist < 0.7 && t > 0.75) || t > 2.0) {
      this.mode = "close";
      this.t = 0;
      this.reactorBoost = 0.8;
      this.setFlames(false, 0);
      sfx.suitUnlock();
    }
  }

  private updateClose(dt: number, time: number) {
    const t = this.t;
    const { pos, heading } = this.ctx.player();
    const r = this.root;
    r.position.x = damp(r.position.x, pos.x, 14, dt);
    r.position.y = damp(r.position.y, pos.y, 14, dt);
    r.position.z = damp(r.position.z, pos.z, 14, dt);
    r.rotation.y += angDiff(r.rotation.y, heading) * (1 - Math.exp(-14 * dt));
    r.rotation.x = damp(r.rotation.x, 0, 10, dt);
    this.neutralize(dt, 10);
    // Hold on the Arc Reactor first, then let fine nanotech stream outward.
    // The armor geometry itself grows in-place over Tony instead of arriving as
    // detached floating plates.
    const flowT = Math.max(0, t - 0.72);
    this.updateAssemblyStream(flowT, time);

    let allCovered = true;
    for (const p of this.pieces) {
      const chest = new THREE.Vector3(0, 1.55, 0.2);
      const armorPoint = this.root.worldToLocal(p.mesh.getWorldPosition(this.tmp2));
      const distance = armorPoint.distanceTo(chest);
      const delay = 0.08 + clamp01(distance / 2.65) * 1.05;
      const duration = 0.42 + (p.order < 0.12 ? 0.28 : 0);
      const u = clamp01((flowT - delay) / duration);
      const reveal = easeOutCubic(u);
      p.mesh.position.copy(p.base);
      p.mesh.rotation.copy(p.baseRot);
      p.mesh.scale.copy(p.baseScale).multiplyScalar(reveal);
      const glow = u > 0 && u < 1 ? Math.sin(Math.PI * u) : 0;
      if (p.flashable) {
        const mat = p.mesh.material as THREE.MeshStandardMaterial;
        mat.emissive.setRGB(0.12 * glow, 0.5 * glow, 0.68 * glow);
      }
      if (u < 1) allCovered = false;
      if (u >= 1 && !p.locked) {
        p.locked = true;
        this.burst(p, p.order < 0.12 ? this.white : this.gold, p.order < 0.12 ? 5 : 2, 2.2);
        if (p.order < 0.06) {
          this.reactorBoost = 1;
          sfx.suitLock();
        }
      }
    }

    if (allCovered && flowT > 1.75) {
      this.assemblyMesh.visible = false;
      this.restorePieces();
      this.root.position.copy(pos);
      this.root.rotation.set(0, heading, 0);
      this.tony.root.visible = false;
      this.active = false;
      this.mode = "none";
      this.t = 0;
      this.reactorBoost = 1.2;
      this.ctx.setWeaponHidden(false);
      this.summoning = false;
      this.ctx.onDonned();
    }
  }

  /* ---------------- Tony animation ---------------- */

  poseTony(dt: number, time: number, o: { pos: THREE.Vector3; heading: number; speed: number; walk: number; grounded: boolean; camPitch: number }) {
    const t = this.tony;
    t.root.position.copy(o.pos);
    t.root.rotation.y = o.heading;

    const amp = Math.min(1, o.speed / 9);
    const sw = o.grounded ? Math.sin(o.walk) * amp * 0.9 : 0;
    const air = !o.grounded;
    const g = this.gesture;
    const breathe = Math.sin(time * 2.0);
    const touchReactor = this.summoning;

    t.hipR.rotation.x = damp(t.hipR.rotation.x, air ? 0.3 : sw, 16, dt);
    t.hipL.rotation.x = damp(t.hipL.rotation.x, air ? -0.2 : -sw, 16, dt);
    t.kneeR.rotation.x = damp(t.kneeR.rotation.x, air ? 0.7 : Math.max(0, -sw) * 1.1, 16, dt);
    t.kneeL.rotation.x = damp(t.kneeL.rotation.x, air ? 0.5 : Math.max(0, sw) * 1.1, 16, dt);

    // arms swing opposite to the legs; spread out like in the film while the armor peels away
    const swing = air ? 0.4 : sw * 0.8;
    // Tony raises one hand across his chest to touch the Arc Reactor and holds the pose through assembly.
    t.shR.rotation.x = damp(t.shR.rotation.x, touchReactor ? -1.25 : swing * 1 - g * 0.15, 14, dt);
    t.shL.rotation.x = damp(t.shL.rotation.x, touchReactor ? 0.05 : -swing - g * 0.15, 14, dt);
    t.shR.rotation.z = damp(t.shR.rotation.z, touchReactor ? 0.72 : -g * 0.65 - 0.05 + breathe * 0.01, 9, dt);
    t.shL.rotation.z = damp(t.shL.rotation.z, touchReactor ? 0.05 : g * 0.65 + 0.05 - breathe * 0.01, 9, dt);
    t.elR.rotation.x = damp(t.elR.rotation.x, touchReactor ? -1.45 : -0.25 - amp * 0.7 - g * 0.1, 12, dt);
    t.elL.rotation.x = damp(t.elL.rotation.x, touchReactor ? -0.25 : -0.25 - amp * 0.7 - g * 0.1, 12, dt);

    t.body.position.y = damp(t.body.position.y, 1.0 + Math.abs(Math.cos(o.walk)) * 0.035 * amp * (air ? 0 : 1) + breathe * 0.006, 20, dt);
    t.body.rotation.x = damp(t.body.rotation.x, Math.min(0.2, o.speed / 45) - g * 0.06, 8, dt);
    t.body.rotation.y = damp(t.body.rotation.y, Math.sin(o.walk) * amp * 0.1, 10, dt);
    t.head.rotation.x = damp(t.head.rotation.x, -g * 0.25 + (o.camPitch - 0.2) * 0.3, 8, dt);
  }
}
