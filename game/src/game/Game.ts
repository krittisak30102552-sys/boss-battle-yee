import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { buildIronMan, buildThanos, setFlash, IronRig, ThanosRig, THANOS_SCALE } from "./builders";
import { NanoSystem, WEAPON_COUNT } from "./nano";
import { SuitSystem } from "./suit";
import { initAudio, sfx } from "./audio";
import type { BossNetworkState } from "./multiplayer";

const RED_C = 0xb5141f;
const GOLD_C = 0xe9b13a;

/* ------------------------------------------------------------------ */
/*  Public types (used by the React HUD)                               */
/* ------------------------------------------------------------------ */

export type Status = "menu" | "playing" | "paused" | "won" | "lost";

export interface HudState {
  status: Status;
  playerHp: number;
  playerMax: number;
  tonyExposed: boolean;
  bossHp: number;
  bossMax: number;
  boost: number;
  weapon: number;
  morphing: boolean;
  charge: number;
  healCd: number;
  dashCd: number;
  phase: number;
  hurt: number;
  hits: number;
  action: string;
  locked: boolean;
  time: number;
  blocking: boolean;
  absorbing: boolean;
  ult: number;
  refocus: number;
  heat: number;
  overheat: boolean;
  sentries: number;
  snaps: number;
  hint: string;
  mark50Available: boolean;
  mark50Cinematic: boolean;
  armorModel: 50 | 85;
}

export const W = {
  REPULSOR: 0,
  REFOCUS: 1,
  UNI: 2,
  CANNON: 3,
  SENTRY: 4,
  BLADE: 5,
  KATAR: 6,
  HAMMER: 7,
  MISSILE: 8,
  SHIELD: 9,
  GAUNTLET: 10,
} as const;

export interface WeaponInfo {
  key: string;
  code: string;
  name: string;
  th: string;
  short: string;
  desc: string;
}

export const WEAPON_INFO: WeaponInfo[] = [
  { key: "1", code: "Digit1", name: "REPULSORS", th: "เรพัลเซอร์", short: "เรพัลเซอร์", desc: "ลำแสงเรพัลเซอร์ที่ฝ่ามือ ยิงรัวระยะไกล (เท้าช่วยพยุงตัวตอนบิน)" },
  { key: "2", code: "Digit2", name: "LIGHTNING REFOCUS", th: "ดูดพลังงาน", short: "ดูดพลัง", desc: "กดค้าง: ปีกนาโนด้านหลังดูดลูกพลังงาน/คลื่นช็อก/ลำแสงธานอส — ปล่อยเพื่อยิงลำแสงสะท้อนกลับ" },
  { key: "3", code: "Digit3", name: "UNI-BEAM", th: "ยูนิบีม", short: "ยูนิบีม", desc: "เอฟเฟกต์ยูนิบีมจากเตาอาร์คกลางอก" },
  { key: "4", code: "Digit4", name: "NANO / ZERO CANNON", th: "ปืนใหญ่นาโน", short: "ปืนใหญ่", desc: "กดค้างชาร์จ ปล่อยเพื่อยิง — ชาร์จเต็มจะยิง Zero Cannon จากไหล่พร้อมกัน" },
  { key: "5", code: "Digit5", name: "DISPLACER SENTRIES", th: "ป้อมปืนพลังงาน", short: "ป้อมปืน", desc: "คลิกเพื่อสร้างป้อมปืนนาโนลอยตัวยิงอัตโนมัติ (สูงสุด 3 ป้อม)" },
  { key: "6", code: "Digit6", name: "ENERGY BLADE", th: "ใบมีดพลังงาน", short: "ใบมีด", desc: "ฟันเสี้ยวพลังงาน + ใบมีดนาโนที่มือ ปัดลูกพลังงานกลับ" },
  { key: "7", code: "Digit7", name: "NANO KATAR", th: "คาตาร์นาโน", short: "คาตาร์", desc: "แทงรัวระยะประชิดสลับมือ — คอมโบ 3 ครั้งท้ายแรงสุด" },
  { key: "8", code: "Digit8", name: "POWER HAMMER", th: "ค้อนพลังงาน", short: "ค้อน", desc: "ทุบสะเทือนพื้น + SHIFT = Battering Ram พุ่งกระแทกทะลวงเกราะ" },
  { key: "9", code: "Digit9", name: "MICRO-MISSILES", th: "ขีปนาวุธจิ๋ว", short: "ขีปนาวุธ", desc: "ยิงขีปนาวุธนำวิถีจากไหล่ + เลเซอร์จิ๋วจากแขน" },
  { key: "0", code: "Digit0", name: "ENERGY SHIELD", th: "โล่พลังงาน", short: "โล่", desc: "กดค้างเพื่อกัน / กดจังหวะ = PARRY สะท้อนลูกพลังงาน" },
  { key: "G", code: "KeyG", name: "INFINITY GAUNTLET", th: "เกาน์ทเล็ตนาโน", short: "เกาน์ทเล็ต", desc: "ท่าไม้ตาย: เมื่อพลัง ULT เต็ม กดค้างเพื่อรวมพลังอัญมณีทั้ง 6 แล้วดีดนิ้ว" },
];

/* ------------------------------------------------------------------ */
/*  Constants & helpers                                                */
/* ------------------------------------------------------------------ */

const ARENA_R = 58;
const BOSS_MAX = 3000;
const PLAYER_MAX = 250;
const TONY_MAX = 250;
const TAU = Math.PI * 2;

const damp = (a: number, b: number, k: number, dt: number) => a + (b - a) * (1 - Math.exp(-k * dt));
const angDiff = (a: number, b: number) => {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
};
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/* ------------------------------------------------------------------ */
/*  Particle pool                                                      */
/* ------------------------------------------------------------------ */

class FX {
  mesh: THREE.InstancedMesh;
  cap = 1100;
  idx = 0;
  alive = 0;
  px: Float32Array;
  py: Float32Array;
  pz: Float32Array;
  vx: Float32Array;
  vy: Float32Array;
  vz: Float32Array;
  life: Float32Array;
  max: Float32Array;
  size: Float32Array;
  grav: Float32Array;
  dummy = new THREE.Object3D();
  colorDirty = false;

  constructor(scene: THREE.Scene) {
    const n = this.cap;
    this.px = new Float32Array(n);
    this.py = new Float32Array(n);
    this.pz = new Float32Array(n);
    this.vx = new Float32Array(n);
    this.vy = new Float32Array(n);
    this.vz = new Float32Array(n);
    this.life = new Float32Array(n);
    this.max = new Float32Array(n).fill(1);
    this.size = new Float32Array(n);
    this.grav = new Float32Array(n);
    this.mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xffffff }), n);
    this.mesh.frustumCulled = false;
    const c = new THREE.Color(1, 1, 1);
    this.dummy.scale.setScalar(0);
    this.dummy.updateMatrix();
    for (let i = 0; i < n; i++) {
      this.mesh.setColorAt(i, c);
      this.mesh.setMatrixAt(i, this.dummy.matrix);
    }
    scene.add(this.mesh);
  }

  spawn(x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, size: number, c: THREE.Color, grav = 0) {
    const i = this.idx;
    this.idx = (this.idx + 1) % this.cap;
    this.px[i] = x;
    this.py[i] = y;
    this.pz[i] = z;
    this.vx[i] = vx;
    this.vy[i] = vy;
    this.vz[i] = vz;
    this.life[i] = life;
    this.max[i] = life;
    this.size[i] = size;
    this.grav[i] = grav;
    this.mesh.setColorAt(i, c);
    this.colorDirty = true;
  }

  update(dt: number) {
    const d = this.dummy;
    let any = false;
    for (let i = 0; i < this.cap; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      any = true;
      if (this.life[i] <= 0) {
        d.scale.setScalar(0);
        d.position.set(0, -100, 0);
      } else {
        this.vy[i] += this.grav[i] * dt;
        this.px[i] += this.vx[i] * dt;
        this.py[i] += this.vy[i] * dt;
        this.pz[i] += this.vz[i] * dt;
        if (this.py[i] < 0.05 && this.grav[i] < 0) {
          this.py[i] = 0.05;
          this.vy[i] *= -0.3;
        }
        d.position.set(this.px[i], this.py[i], this.pz[i]);
        d.scale.setScalar(this.size[i] * (this.life[i] / this.max[i]));
        d.rotation.set(this.px[i] * 3, this.py[i] * 3, 0);
      }
      d.updateMatrix();
      this.mesh.setMatrixAt(i, d.matrix);
    }
    if (any) this.mesh.instanceMatrix.needsUpdate = true;
    if (this.colorDirty && this.mesh.instanceColor) {
      this.mesh.instanceColor.needsUpdate = true;
      this.colorDirty = false;
    }
  }

  clear() {
    this.life.fill(0);
    this.dummy.scale.setScalar(0);
    this.dummy.updateMatrix();
    for (let i = 0; i < this.cap; i++) this.mesh.setMatrixAt(i, this.dummy.matrix);
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

/* ------------------------------------------------------------------ */
/*  Entities                                                           */
/* ------------------------------------------------------------------ */

interface Proj {
  mesh: THREE.Object3D;
  vel: THREE.Vector3;
  life: number;
  dmg: number;
  owner: "p" | "b";
  r: number;
  kind: "bolt" | "orb" | "cannon" | "missile" | "refocus";
  power: number;
  homing?: boolean;
  age?: number;
}

interface Sentry {
  g: THREE.Group;
  core: THREE.Mesh;
  ring: THREE.Mesh;
  life: number;
  fire: number;
  ang: number;
  spawn: number;
  pos: THREE.Vector3;
}

interface Ring {
  mesh: THREE.Mesh;
  r: number;
  speed: number;
  max: number;
}

interface Flash {
  mesh: THREE.Mesh;
  life: number;
  max: number;
}

interface Shock {
  mesh: THREE.Mesh;
  r: number;
  speed: number;
  hit: boolean;
  dmg: number;
}

interface Meteor {
  pos: THREE.Vector3;
  t: number;
  ring: THREE.Mesh;
  rock: THREE.Mesh;
  done: boolean;
}

type BossState = "idle" | "punch" | "slam" | "orbs" | "meteor" | "rush" | "beam" | "stagger" | "roar" | "dead";

/* ------------------------------------------------------------------ */
/*  GAME                                                               */
/* ------------------------------------------------------------------ */

export class Game {
  private container: HTMLElement;
  private onHud: (s: HudState) => void;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private canvas: HTMLCanvasElement;
  private clock = new THREE.Clock();
  private raf = 0;
  private disposed = false;
  private ro: ResizeObserver;
  private time = 0;
  private hudTimer = 0;

  status: Status = "menu";

  // input
  private keys = new Set<string>();
  private mouseDown = false;
  private rightDrag = false;
  private locked = false;
  private wasLocked = false;
  private freeLook = false;

  // camera
  private camYaw = 0;
  private camPitch = 0.22;
  private shake = 0;
  private fov = 70;

  // world
  private rocks: THREE.Mesh[] = [];
  private fx: FX;
  private projs: Proj[] = [];
  private shocks: Shock[] = [];
  private meteors: Meteor[] = [];

  // shared geometries / materials
  private boltGeo = new THREE.BoxGeometry(0.14, 0.14, 1.1);
  private boltMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.7, 2.0, 2.8) });
  private sphereGeo = new THREE.SphereGeometry(1, 20, 14);
  private orbCore = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 0.7, 3.0) });
  private orbShell = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.2, 0.3, 2.0), transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false });
  private canCore = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.0, 2.2, 1.0) });
  private canShell = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.0, 0.7, 0.15), transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false });
  private chargeOrb: THREE.Mesh;
  private beamGeo = new THREE.CylinderGeometry(1, 1, 1, 10, 1, true);
  private missileGeo = new THREE.BoxGeometry(0.13, 0.13, 0.55);
  private missileMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 1.2, 0.8) });
  private refocusMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 2.4, 3.0), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
  private sentries: Sentry[] = [];
  private rings: Ring[] = [];
  private flashes: Flash[] = [];
  private uniBeam: THREE.Mesh;
  private bossBeam: THREE.Mesh;
  private snapCount = 0;
  private hint = "";
  private hintT = 0;

  // player
  private rig: IronRig;
  private remoteRigs = new Map<string, { rig: IronRig; target: THREE.Vector3; heading: number }>();
  private armorModel: 50 | 85 = 85;
  private mark85Colors: THREE.Color[] = [];
  private combatMode = 0;
  private armorDestroyed = false;
  private mark50Used = false;
  private mark50Cinematic = false;
  private tonyHp = TONY_MAX;
private nano: NanoSystem;
  private pl = {
    pos: new THREE.Vector3(0, 0, -24),
    vel: new THREE.Vector3(),
    heading: 0,
    hp: PLAYER_MAX,
    boost: 100,
    boostEmpty: false,
    boostDelay: 0,
    dashT: 0,
    dashCd: 0,
    dashDir: new THREE.Vector3(),
    invul: 0,
    flash: 0,
    cd: 0,
    swingT: 0,
    swingHit: false,
    lungeT: 0,
    charge: 0,
    blocking: false,
    blockT: 0,
    aimT: 0,
    aimPitch: 0,
    healCd: 0,
    walk: 0,
    thrusting: false,
    spaceHeld: false,
    // Mark 85 systems
    absorbing: false,
    refocus: 0,
    heat: 0,
    overheat: false,
    uniOn: false,
    uniTick: 0,
    ult: 0,
    channel: 0,
    swingHit2: false,
    katarT: 0,
    katarHand: 0,
    katarCombo: 0,
    katarLast: -9,
    katarHit: false,
    hammerT: 0,
    hammerHit: false,
    ram: false,
    ramHit: false,
    wing: 0.35,
    snd: 0,
  };
  private hurtCount = 0;
  private hitCount = 0;
  private armPose = { shR: -0.5, elR: -0.9, shL: 0, elL: -0.3, zR: 0, zL: 0 };
  private playTime = 0;

  // boss
  private brig: ThanosRig;
  private boss = {
    pos: new THREE.Vector3(0, 0, 14),
    yaw: Math.PI,
    hp: BOSS_MAX,
    phase: 1,
    state: "idle" as BossState,
    t: 0,
    think: 1.5,
    flash: 0,
    walk: 0,
    did: 0,
    staggerT: 0,
    last: "",
    from: new THREE.Vector3(),
    to: new THREE.Vector3(),
    dir: new THREE.Vector3(),
    lunge: 0,
    dustT: 0,
    bdir: new THREE.Vector3(0, 0, 1),
    btick: 0,
    bend: new THREE.Vector3(),
  };
  private bpose = { shR: 0, elR: -0.2, shL: 0, elL: -0.2, lean: 0, crouch: 0, headX: 0, fall: 0 };

  // scratch
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  private v3 = new THREE.Vector3();
  private v4 = new THREE.Vector3();
  private tA = new THREE.Vector3();
  private tB = new THREE.Vector3();
  private tC = new THREE.Vector3();
  private tD = new THREE.Vector3();
  private yAxis = new THREE.Vector3(0, 1, 0);
  private pf = new THREE.Vector3();
  private pr = new THREE.Vector3();
  private pw = new THREE.Vector3();

  private handlers: Array<[EventTarget, string, EventListener]> = [];

  constructor(container: HTMLElement, onHud: (s: HudState) => void) {
    this.container = container;
    this.onHud = onHud;
    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;

    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.setSize(w, h);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.9;
    this.canvas = this.renderer.domElement;
    this.canvas.style.display = "block";
    this.canvas.style.width = "100%";
    this.canvas.style.height = "100%";
    container.appendChild(this.canvas);

    this.camera = new THREE.PerspectiveCamera(this.fov, w / h, 0.1, 1500);


    this.buildWorld();

    this.rig = buildIronMan();
    this.scene.add(this.rig.root);
    this.mark85Colors = this.rig.mats.map(({ mat }) => mat.color.clone());
    this.applyArmorModel();
    this.nano = new NanoSystem(this.rig, this.scene);

    this.brig = buildThanos();
    this.brig.root.scale.setScalar(THANOS_SCALE);
    this.scene.add(this.brig.root);

    this.fx = new FX(this.scene);

    this.suit = new SuitSystem({
      rig: this.rig,
      scene: this.scene,
      spark: (pos, color, count, speed) => {
        for (let i = 0; i < count; i++) {
          this.fx.spawn(pos.x, pos.y, pos.z, rnd(-speed, speed), rnd(-speed * 0.3, speed * 1.2), rnd(-speed, speed), rnd(0.3, 0.7), rnd(0.05, 0.12), color, -2);
        }
      },
      player: () => this.pl,
      bossPos: () => this.boss.pos,
      setWeaponHidden: (hide) => this.nano.setHidden(hide),
      onDonned: () => {
        this.armPose = { shR: 0, elR: 0, shL: 0, elL: 0, zR: 0, zL: 0 };
        if (this.mark50Cinematic) {
          this.mark50Cinematic = false;
          this.armorDestroyed = false;
          this.armorModel = 50;
          this.pl.hp = PLAYER_MAX;
          this.tonyHp = TONY_MAX;
          this.rig.root.visible = true;
          this.applyArmorModel();
          this.say("MARK 50 · MODEL PRIME ONLINE", 3.2);
          this.emitHud(true);
        }
      },
    });


    this.chargeOrb = new THREE.Mesh(this.sphereGeo, this.canShell);
    this.chargeOrb.visible = false;
    this.scene.add(this.chargeOrb);

    const mkBeam = (c: THREE.Color, op: number) => {
      const m = new THREE.Mesh(
        this.beamGeo,
        new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
      );
      m.visible = false;
      m.frustumCulled = false;
      this.scene.add(m);
      return m;
    };
    this.uniBeam = mkBeam(new THREE.Color(1.2, 2.4, 3.0), 0.92);
    this.bossBeam = mkBeam(new THREE.Color(2.2, 0.8, 3.0), 0.85);

    this.bindInput();
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(container);

    this.reset();
    this.loop();
  }

  /* ---------------------------------------------------------------- */
  /*  World                                                           */
  /* ---------------------------------------------------------------- */


  private suit: SuitSystem;

  private wingsManual = false;

  private buildWorld() {
    const scene = this.scene;
    scene.fog = new THREE.FogExp2(0x4a2c4a, 0.0065);

    // environment reflections (makes metal look like metal)
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.3;

    // sky dome
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(700, 32, 16),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `varying vec3 vP; void main(){
          float h = normalize(vP).y;
          vec3 hor = vec3(0.95,0.36,0.3);
          vec3 mid = vec3(0.30,0.10,0.34);
          vec3 top = vec3(0.015,0.01,0.07);
          vec3 c = mix(hor, mid, smoothstep(0.0,0.22,h));
          c = mix(c, top, smoothstep(0.18,0.75,h));
          gl_FragColor = vec4(c,1.0);
        }`,
      })
    );
    scene.add(sky);

    // stars
    const sp = new Float32Array(900 * 3);
    for (let i = 0; i < 900; i++) {
      const u = Math.random() * TAU;
      const y = rnd(0.12, 1);
      const r = Math.sqrt(1 - y * y);
      sp[i * 3] = Math.cos(u) * r * 650;
      sp[i * 3 + 1] = y * 650;
      sp[i * 3 + 2] = Math.sin(u) * r * 650;
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute("position", new THREE.BufferAttribute(sp, 3));
    scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false, fog: false })));

    // gas giant with rings
    const pc = document.createElement("canvas");
    pc.width = 8;
    pc.height = 256;
    const pg = pc.getContext("2d")!;
    for (let y = 0; y < 256; y++) {
      const t = y / 256;
      const v = 0.5 + 0.5 * Math.sin(t * 38 + Math.sin(t * 9) * 2);
      pg.fillStyle = `rgb(${Math.round(190 + v * 50)},${Math.round(110 + v * 60)},${Math.round(90 + v * 40)})`;
      pg.fillRect(0, y, 8, 1);
    }
    const ptex = new THREE.CanvasTexture(pc);
    ptex.colorSpace = THREE.SRGBColorSpace;
    const planet = new THREE.Mesh(new THREE.SphereGeometry(80, 48, 32), new THREE.MeshBasicMaterial({ map: ptex, fog: false, color: 0xaa9090 }));
    planet.position.set(-170, 120, 400);
    planet.rotation.z = 0.35;
    scene.add(planet);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(110, 170, 80),
      new THREE.MeshBasicMaterial({ color: 0xc9a58a, side: THREE.DoubleSide, transparent: true, opacity: 0.4, fog: false, depthWrite: false })
    );
    ring.position.copy(planet.position);
    ring.rotation.set(Math.PI / 2 + 0.25, 0, 0.35);
    scene.add(ring);

    // lights
    scene.add(new THREE.HemisphereLight(0xff9fb0, 0x2c1a3c, 1.0));
    const sun = new THREE.DirectionalLight(0xffcfa0, 2.6);
    sun.position.set(35, 65, -55);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = -62;
    sc.right = 62;
    sc.top = 62;
    sc.bottom = -62;
    sc.near = 10;
    sc.far = 220;
    sun.shadow.bias = -0.0006;
    scene.add(sun);
    const rim = new THREE.DirectionalLight(0x8a7bff, 1.1);
    rim.position.set(-30, 30, 70);
    scene.add(rim);

    // ground texture (cracked rock)
    const gc = document.createElement("canvas");
    gc.width = gc.height = 512;
    const g = gc.getContext("2d")!;
    g.fillStyle = "#5a4668";
    g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 4000; i++) {
      const v = Math.random();
      g.fillStyle = `rgba(${v > 0.5 ? 255 : 20},${v > 0.5 ? 220 : 10},${v > 0.5 ? 255 : 40},${rnd(0.02, 0.07)})`;
      g.fillRect(Math.random() * 512, Math.random() * 512, rnd(2, 12), rnd(2, 12));
    }
    g.strokeStyle = "rgba(15,5,25,0.7)";
    g.lineWidth = 2;
    for (let i = 0; i < 26; i++) {
      let x = Math.random() * 512;
      let y = Math.random() * 512;
      g.beginPath();
      g.moveTo(x, y);
      for (let k = 0; k < 8; k++) {
        x += rnd(-40, 40);
        y += rnd(-40, 40);
        g.lineTo(x, y);
      }
      g.stroke();
    }
    const gtex = new THREE.CanvasTexture(gc);
    gtex.wrapS = gtex.wrapT = THREE.RepeatWrapping;
    gtex.repeat.set(12, 12);
    gtex.colorSpace = THREE.SRGBColorSpace;
    gtex.anisotropy = 4;
    const ground = new THREE.Mesh(new THREE.CircleGeometry(160, 64), new THREE.MeshStandardMaterial({ map: gtex, roughness: 0.95, metalness: 0.0 }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // arena boundary
    const edge = new THREE.Mesh(
      new THREE.TorusGeometry(ARENA_R, 0.28, 8, 128),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(1.4, 0.5, 2.0) })
    );
    edge.rotation.x = Math.PI / 2;
    edge.position.y = 0.2;
    scene.add(edge);

    // ruin pillars
    const pm = new THREE.MeshStandardMaterial({ color: 0x3b2c4e, roughness: 0.9, metalness: 0.05 });
    for (let i = 0; i < 34; i++) {
      const a = (i / 34) * TAU + rnd(-0.08, 0.08);
      const r = rnd(66, 105);
      const hgt = rnd(8, 34);
      const w = rnd(3, 7);
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, hgt, w * rnd(0.7, 1.4)), pm);
      m.position.set(Math.cos(a) * r, hgt / 2 - 1, Math.sin(a) * r);
      m.rotation.set(rnd(-0.12, 0.12), rnd(0, 3), rnd(-0.12, 0.12));
      m.castShadow = true;
      m.receiveShadow = true;
      scene.add(m);
    }
    // broken blocks inside arena (decor)
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * TAU;
      const r = rnd(20, 54);
      const s = rnd(0.8, 2.4);
      const m = new THREE.Mesh(new THREE.BoxGeometry(s * 1.6, s, s * 1.2), pm);
      m.position.set(Math.cos(a) * r, s / 2 - 0.1, Math.sin(a) * r);
      m.rotation.y = rnd(0, 3);
      m.castShadow = true;
      m.receiveShadow = true;
      scene.add(m);
    }
    // floating rocks
    const rm = new THREE.MeshStandardMaterial({ color: 0x4a3a62, roughness: 0.85, metalness: 0.05, flatShading: true });
    for (let i = 0; i < 16; i++) {
      const a = Math.random() * TAU;
      const r = rnd(90, 170);
      const m = new THREE.Mesh(new THREE.DodecahedronGeometry(rnd(3, 10), 0), rm);
      m.position.set(Math.cos(a) * r, rnd(20, 80), Math.sin(a) * r);
      m.castShadow = false;
      scene.add(m);
      this.rocks.push(m);
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Input                                                           */
  /* ---------------------------------------------------------------- */

  private on(target: EventTarget, type: string, fn: (e: never) => void) {
    target.addEventListener(type, fn as EventListener);
    this.handlers.push([target, type, fn as EventListener]);
  }

  private bindInput() {
    this.on(window, "keydown", (e: KeyboardEvent) => {
      if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Tab"].includes(e.code)) e.preventDefault();
      if (e.repeat) return;
      if (this.status !== "playing") {
        if (e.code === "KeyP" && this.status === "paused") this.resume();
        return;
      }
      this.keys.add(e.code);
      if (e.code === "KeyP") this.pause();
      if (e.code === "KeyM" && this.armorDestroyed) this.activateMark50();
      if (e.code === "KeyL") this.freeLook = !this.freeLook;
      const wi = WEAPON_INFO.findIndex((w) => w.code === e.code);
      if (wi >= 0 && !this.armorDestroyed) this.selectWeapon(wi);
      if (e.code === "KeyT" && !this.armorDestroyed) this.heal();
      if (e.code === "KeyR" && !this.armorDestroyed) this.toggleSuit();
      if (e.code === "KeyV" && !this.armorDestroyed) {
        this.setCombatMode(this.combatMode === 0 ? 1 : 0);
        this.selectSkill(this.combatMode === 0 ? 0 : 6);
      }
      if (e.code === "KeyB" && !this.armorDestroyed) this.toggleWings();
      if ((e.code === "ShiftLeft" || e.code === "ShiftRight") && !this.armorDestroyed) this.dash();
      if (e.code === "KeyQ" && !this.armorDestroyed) this.selectWeapon((this.nano.pending + WEAPON_COUNT - 1) % WEAPON_COUNT);
      if (e.code === "KeyE" && !this.armorDestroyed) this.selectWeapon((this.nano.pending + 1) % WEAPON_COUNT);
    });
    this.on(window, "keyup", (e: KeyboardEvent) => {
      this.keys.delete(e.code);
    });
    this.on(window, "blur", () => {
      this.keys.clear();
      this.mouseDown = false;
    });
    this.on(this.canvas, "mousedown", (e: MouseEvent) => {
      if (this.status !== "playing") return;
      if (e.button === 0) {
        this.mouseDown = true;
        if (!this.locked) this.requestLock();
      }
      if (e.button === 2) this.rightDrag = true;
    });
    this.on(window, "mouseup", (e: MouseEvent) => {
      if (e.button === 0) this.mouseDown = false;
      if (e.button === 2) this.rightDrag = false;
    });
    this.on(this.canvas, "contextmenu", (e: Event) => e.preventDefault());
    this.on(window, "mousemove", (e: MouseEvent) => {
      if (this.status !== "playing") return;
      if (this.locked || this.rightDrag || this.freeLook) {
        this.camYaw -= e.movementX * 0.0024;
        this.camPitch = clamp(this.camPitch + e.movementY * 0.0022, -0.55, 1.15);
      }
    });
    this.on(window, "wheel", (e: WheelEvent) => {
      if (this.status !== "playing") return;
      this.selectWeapon((this.nano.pending + (e.deltaY > 0 ? 1 : WEAPON_COUNT - 1)) % WEAPON_COUNT);
    });
    this.on(document, "pointerlockchange", () => {
      this.locked = document.pointerLockElement === this.canvas;
      if (!this.locked && this.wasLocked && this.status === "playing" && !this.armorDestroyed) this.pause();
      this.wasLocked = this.locked;
      this.emitHud(true);
    });
  }

  private requestLock() {
    try {
      const r = this.canvas.requestPointerLock() as unknown as Promise<void> | undefined;
      if (r && typeof r.catch === "function") r.catch(() => undefined);
    } catch {
      /* not allowed in this context – mouse-drag camera still works */
    }
  }

  private resize() {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /* ---------------------------------------------------------------- */
  /*  Public controls                                                 */
  /* ---------------------------------------------------------------- */


  getNetworkState() {
    return { x: this.pl.pos.x, y: this.pl.pos.y, z: this.pl.pos.z, heading: this.pl.heading, flying: this.pl.pos.y > 0.15 };
  }

  setRemotePlayers(players: Array<{ id: string; name: string; state: { x: number; y: number; z: number; heading: number; flying?: boolean } | null }>, ownId?: string) {
    const present = new Set(players.filter(p => p.id !== ownId && p.state).map(p => p.id));
    for (const [id, remote] of this.remoteRigs) {
      if (!present.has(id)) { this.scene.remove(remote.rig.root); this.remoteRigs.delete(id); }
    }
    for (const player of players) {
      if (player.id === ownId || !player.state) continue;
      const s = player.state;
      if (![s.x,s.y,s.z,s.heading].every(Number.isFinite)) continue;
      let remote = this.remoteRigs.get(player.id);
      if (!remote) {
        const rig = buildIronMan();
        rig.root.scale.setScalar(0.92);
        this.scene.add(rig.root);
        remote = { rig, target: new THREE.Vector3(s.x,s.y,s.z), heading: s.heading };
        this.remoteRigs.set(player.id, remote);
      }
      remote.target.set(THREE.MathUtils.clamp(s.x,-60,60), THREE.MathUtils.clamp(s.y,0,30), THREE.MathUtils.clamp(s.z,-60,60));
      remote.heading = s.heading;
    }
  }

  private updateRemotePlayers(dt: number) {
    for (const remote of this.remoteRigs.values()) {
      remote.rig.root.position.lerp(remote.target, 1 - Math.exp(-12 * dt));
      const diff = ((remote.heading - remote.rig.root.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      remote.rig.root.rotation.y += diff * (1 - Math.exp(-12 * dt));
    }
  }

  getArmorModel() {
    return this.armorModel;
  }

  activateMark50() {
    if (this.status !== "playing" || !this.armorDestroyed || this.mark50Used || this.mark50Cinematic) return false;
    this.mark50Used = true;
    this.mark50Cinematic = true;
    this.keys.clear();
    this.mouseDown = false;
    this.pl.vel.set(0, 0, 0);
    this.pl.pos.y = 0;
    // Pause the boss cleanly: remove already-launched hostile effects during the suit-up scene.
    for (const projectile of this.projs) {
      if (projectile.owner === "b") projectile.mesh.removeFromParent();
    }
    this.projs = this.projs.filter((projectile) => projectile.owner !== "b");
    for (const shock of this.shocks) this.removeShock(shock);
    this.shocks = [];
    for (const meteor of this.meteors) this.removeMeteor(meteor);
    this.meteors = [];
    this.boss.state = "idle";
    this.boss.t = 0;
    this.boss.think = 2.2;
    this.boss.lunge = 0;
    this.armorModel = 50;
    this.applyArmorModel();
    this.suit.summonForTony();
    this.say("ARC REACTOR LINK · MARK 50 DEPLOYING", 4);
    this.emitHud(true);
    return true;
  }

  private applyArmorModel() {
    // Mark 50 keeps the same rig for now, but uses a narrower silhouette and a red-dominant finish.
    const slim = this.armorModel === 50;
    this.rig.body.scale.set(1, 1, 1);
    for (const group of [this.rig.shR, this.rig.shL, this.rig.elR, this.rig.elL]) group.scale.set(1, 1, 1);
    for (const group of [this.rig.hipR, this.rig.hipL, this.rig.kneeR, this.rig.kneeL]) group.scale.set(1, 1, 1);
    this.rig.mats.forEach(({ mat }, index) => {
      const base = this.mark85Colors[index];
      if (!base) return;
      mat.color.copy(base);
      if (slim) {
        if (base.getHex() === 0xf6c04a) mat.color.setHex(0xc98232);
        else if (base.getHex() === 0xd01c28) mat.color.setHex(0xe51b2a);
      }
    });
    if (slim) {
      this.rig.body.scale.set(0.84, 1.01, 0.86);
      for (const group of [this.rig.shR, this.rig.shL]) group.scale.set(0.82, 0.96, 0.86);
      for (const group of [this.rig.elR, this.rig.elL]) group.scale.set(0.85, 1.01, 0.86);
      for (const group of [this.rig.hipR, this.rig.hipL]) group.scale.set(0.84, 1.01, 0.87);
      for (const group of [this.rig.kneeR, this.rig.kneeL]) group.scale.set(0.84, 1.03, 0.87);
    }
  }

  toggleSuit() {
  if (this.armorDestroyed) return false;
  return this.suit.toggle();
}

selectSkill(index: number) {
  if (this.armorDestroyed) return;
  this.selectWeapon(Math.max(0, Math.min(WEAPON_COUNT - 1, index)));
}

setAttackHeld(held: boolean) {
  this.mouseDown = this.armorDestroyed ? false : held;
}

touchLook(dx: number, dy: number) {
  this.camYaw -= dx * 0.006;
  this.camPitch = clamp(this.camPitch + dy * 0.006, -0.55, 1.15);
}

  start() {
    initAudio();
    this.reset();
    this.status = "playing";
    this.requestLock();
    this.emitHud(true);
  }

  pause() {
    if (this.status !== "playing") return;
    this.status = "paused";
    this.mouseDown = false;
    this.keys.clear();
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
    this.emitHud(true);
  }

  resume() {
    if (this.status !== "paused") return;
    initAudio();
    this.status = "playing";
    this.requestLock();
    this.emitHud(true);
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    for (const [t, ty, fn] of this.handlers) t.removeEventListener(ty, fn);
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
    this.nano.dispose();
    for (const remote of this.remoteRigs.values()) this.scene.remove(remote.rig.root);
    this.remoteRigs.clear();
    this.renderer.dispose();
    this.canvas.remove();
  }

  /* ---------------------------------------------------------------- */
  /*  Reset                                                           */
  /* ---------------------------------------------------------------- */

  private reset() {
    const p = this.pl;
    p.pos.set(0, 0, -24);
    p.vel.set(0, 0, 0);
    p.heading = 0;
    p.hp = PLAYER_MAX;
    this.tonyHp = TONY_MAX;
    this.armorDestroyed = false;
    this.mark50Used = false;
    this.mark50Cinematic = false;
    this.armorModel = 85;
    this.applyArmorModel();
    p.boost = 100;
    p.boostEmpty = false;
    p.dashT = 0;
    p.dashCd = 0;
    p.invul = 0;
    p.flash = 0;
    p.cd = 0;
    p.swingT = 0;
    p.lungeT = 0;
    p.charge = 0;
    p.blocking = false;
    p.healCd = 0;
    p.aimT = 0;
    this.rig.root.rotation.set(0, 0, 0);
    this.rig.body.rotation.set(0, 0, 0);
    this.suit.reset();
    this.rig.root.visible = true;
    this.camYaw = 0;
    this.camPitch = 0.22;
    this.playTime = 0;
    this.hurtCount = 0;
    this.hitCount = 0;
    this.shake = 0;

    const b = this.boss;
    b.pos.set(0, 0, 14);
    b.yaw = Math.PI;
    b.hp = BOSS_MAX;
    b.phase = 1;
    b.state = "idle";
    b.t = 0;
    b.think = 2.2;
    b.flash = 0;
    b.last = "";
    b.lunge = 0;
    this.brig.root.visible = true;
    this.brig.root.rotation.set(0, b.yaw, 0);
    this.bpose = { shR: 0, elR: -0.2, shL: 0, elL: -0.2, lean: 0, crouch: 0, headX: 0, fall: 0 };

    for (const pr of this.projs) pr.mesh.removeFromParent();
    this.projs = [];
    for (const s of this.shocks) this.removeShock(s);
    this.shocks = [];
    for (const m of this.meteors) this.removeMeteor(m);
    this.meteors = [];
    this.fx.clear();
    this.nano.resetTo(0);
    for (const sn of this.sentries) sn.g.removeFromParent();
    this.sentries = [];
    for (const r of this.rings) this.removeRing(r);
    this.rings = [];
    for (const f of this.flashes) this.removeFlash(f);
    this.flashes = [];
    this.uniBeam.visible = false;
    this.bossBeam.visible = false;
    Object.assign(p, {
      absorbing: false, refocus: 0, heat: 0, overheat: false, uniOn: false, uniTick: 0, ult: 0, channel: 0,
      katarT: 0, katarCombo: 0, hammerT: 0, ram: false, wing: 0.35, snd: 0,
    });
    this.hint = "";
    this.hintT = 0;
    this.armPose = { shR: -0.5, elR: -0.9, shL: 0, elL: -0.3, zR: 0, zL: 0 };
    b.bdir.set(0, 0, 1);
    setFlash(this.rig.mats, 0, 1, 0, 0);
    setFlash(this.brig.mats, 0, 1, 1, 1);
  }

  /* ---------------------------------------------------------------- */
  /*  Main loop                                                       */
  /* ---------------------------------------------------------------- */

  private loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.time += dt;

    const playing = this.status === "playing";
    if (playing) {
      this.playTime += dt;
      if (!this.mark50Cinematic) {
        this.updatePlayer(dt);
        this.updateBoss(dt);
        this.updateProjectiles(dt);
        this.updateShocks(dt);
        this.updateMeteors(dt);
        this.updateSentries(dt);
      }
    } else if (this.status === "menu") {
      this.updateBossIdleOnly(dt);
    } else if (this.status === "won" || this.status === "lost") {
      this.updateBoss(dt);
      this.updateProjectiles(dt);
      this.updateShocks(dt);
    }

    // At critical armor condition, trigger the same cinematic plate-release sequence as suit removal.
    const armorRatio = this.pl.hp / PLAYER_MAX;
    this.rig.damageStages.forEach((stage, index) => {
      stage.visible = !this.armorDestroyed && armorRatio <= [0.82, 0.55, 0.28][index];
    });
    if (armorRatio <= 0.08 && !this.armorDestroyed) {
      this.armorDestroyed = true;
      // Release pointer lock so the emergency Mark 50 HUD button can receive clicks.
      if (document.pointerLockElement === this.canvas) document.exitPointerLock();
      this.tonyHp = TONY_MAX;
      this.mouseDown = false;
      this.keys.clear();
      this.suit.breakApart();
      this.say("MARK 85 SHATTERED · TONY EXPOSED", 3.2);
    }
    // Once the armor has flown clear, leave Tony in the scene and retire the empty suit.
    if (this.armorDestroyed && this.suit.active && this.suit.mode === "none") {
      this.rig.root.visible = false;
    }

    this.updatePlayerPose(dt);
    this.updateRemotePlayers(dt);
    this.suit.update(dt, this.time);
    this.updateBossPose(dt);
    this.updateCompanion(dt);
    this.updateWings(dt);
    this.updateBeams(dt);
    this.updateRingsAndFlashes(dt);
    this.hintT = Math.max(0, this.hintT - dt);

    // floating rocks
    for (const r of this.rocks) {
      r.rotation.x += dt * 0.05;
      r.rotation.y += dt * 0.08;
    }

    this.rig.root.updateMatrixWorld(true);
    this.nano.update(dt, this.time);
    this.updateChargeOrb();
    this.updateCamera(dt);
    this.fx.update(dt);

    this.hudTimer -= dt;
    if (this.hudTimer <= 0) this.emitHud();

    this.renderer.render(this.scene, this.camera);
  };

  private emitHud(force = false) {
    if (!force && this.hudTimer > 0) return;
    this.hudTimer = 0.06;
    const b = this.boss;
    let action = "";
    if (this.status === "playing") {
      if (b.state === "punch" && b.t < 0.8) action = "⚠ หมัดหนัก! — ตั้งโล่แล้วกดจังหวะเพื่อ PARRY";
      else if (b.state === "slam") action = "⚠ กระโดดกระแทก! — บินขึ้นเพื่อหลบคลื่นช็อก";
      else if (b.state === "orbs") action = "ลูกพลังงาน — ใช้ดาบปัด หรือโล่กัน";
      else if (b.state === "meteor") action = "⚠ อุกกาบาต! — ดูวงแดงบนพื้น";
      else if (b.state === "rush") action = "⚠ พุ่งชน! — กด SHIFT เพื่อหลบ";
      else if (b.state === "beam") action = "⚠ ลำแสงอัญมณี! — กด 2 ค้างเพื่อดูดพลังงาน หรือ SHIFT หลบ";
      else if (b.state === "stagger") action = "ธานอสเสียหลัก — โจมตีเต็มที่!";
      else if (b.state === "roar") action = "PHASE 2 — ธานอสคลั่ง!";
    }
    this.onHud({
      status: this.status,
      playerHp: Math.max(0, Math.ceil(this.armorDestroyed ? this.tonyHp : this.pl.hp)),
      playerMax: this.armorDestroyed ? TONY_MAX : PLAYER_MAX,
      tonyExposed: this.armorDestroyed,
      bossHp: Math.max(0, Math.ceil(b.hp)),
      bossMax: BOSS_MAX,
      boost: this.pl.boost,
      weapon: this.nano.pending,
      morphing: !this.nano.ready,
      charge: this.nano.current === W.GAUNTLET ? this.pl.channel : this.pl.charge,
      healCd: this.pl.healCd,
      dashCd: this.pl.dashCd,
      phase: b.phase,
      hurt: this.hurtCount,
      hits: this.hitCount,
      action,
      locked: this.locked,
      time: this.playTime,
      blocking: this.pl.blocking,
      absorbing: this.pl.absorbing,
      ult: this.pl.ult,
      refocus: this.pl.refocus,
      heat: this.pl.heat,
      overheat: this.pl.overheat,
      sentries: this.sentries.length,
      snaps: this.snapCount,
      hint: this.hintT > 0 ? this.hint : "",
      mark50Available: this.armorDestroyed && !this.mark50Used,
      mark50Cinematic: this.mark50Cinematic,
      armorModel: this.armorModel,
    });
  }

  /* ---------------------------------------------------------------- */
  /*  Player                                                          */
  /* ---------------------------------------------------------------- */

  private selectWeapon(i: number) {
    if (this.status !== "playing" || this.armorDestroyed) return;
    if (i === this.nano.pending && this.nano.ready && i === this.nano.current) return;
    if (this.nano.switchTo(i)) sfx.morph();
    const pl = this.pl;
    pl.charge = 0;
    pl.swingT = 0;
    pl.channel = 0;
    pl.hammerT = 0;
    pl.katarT = 0;
    pl.uniOn = false;
  }

  private say(text: string, t = 2.2) {
    this.hint = text;
    this.hintT = t;
  }

  private dash() {
    if (this.armorDestroyed) return;
    const p = this.pl;
    if (p.dashCd > 0 || p.dashT > 0) return;
    const fwd = this.v1.set(Math.sin(this.camYaw), 0, Math.cos(this.camYaw));
    const right = this.v2.set(-Math.cos(this.camYaw), 0, Math.sin(this.camYaw));
    const k = this.keys;
    const ix = (k.has("KeyD") ? 1 : 0) - (k.has("KeyA") ? 1 : 0);
    const iz = (k.has("KeyW") ? 1 : 0) - (k.has("KeyS") ? 1 : 0);
    p.dashDir.set(0, 0, 0).addScaledVector(fwd, iz).addScaledVector(right, ix);
    if (p.dashDir.lengthSq() < 0.01) p.dashDir.copy(fwd);
    p.dashDir.normalize();
    // Power Hammer equipped: the dash becomes a BATTERING RAM
    const ram = this.nano.current === W.HAMMER && this.nano.ready && !this.suit.active;
    p.ram = ram;
    p.ramHit = false;
    p.dashT = ram ? 0.32 : 0.22;
    p.dashCd = 1.1;
    sfx.dash();
    if (ram) this.say("BATTERING RAM!", 1);
  }

  private heal() {
    if (this.armorDestroyed) return;
    const p = this.pl;
    if (p.healCd > 0 || p.hp >= PLAYER_MAX) return;
    p.hp = Math.min(PLAYER_MAX, p.hp + 80);
    p.healCd = 30;
    sfx.heal();
    const c = new THREE.Color(0.6, 2.2, 1.4);
    for (let i = 0; i < 60; i++) {
      const a = Math.random() * TAU;
      this.fx.spawn(p.pos.x + Math.cos(a) * 1.2, p.pos.y + rnd(0, 2), p.pos.z + Math.sin(a) * 1.2, 0, rnd(1.5, 4), 0, rnd(0.6, 1.1), 0.1, c);
    }
  }

  private isFront(from: THREE.Vector3, to: THREE.Vector3, heading: number, minDot: number) {
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    const l = Math.hypot(dx, dz) || 1;
    return (Math.sin(heading) * dx + Math.cos(heading) * dz) / l > minDot;
  }

  private updatePlayer(dt: number) {
    const p = this.pl;
    const k = this.keys;

    // camera keys
    if (k.has("ArrowLeft")) this.camYaw += 2.2 * dt;
    if (k.has("ArrowRight")) this.camYaw -= 2.2 * dt;
    if (k.has("ArrowUp")) this.camPitch = clamp(this.camPitch - 1.4 * dt, -0.55, 1.15);
    if (k.has("ArrowDown")) this.camPitch = clamp(this.camPitch + 1.4 * dt, -0.55, 1.15);

    const fwd = this.pf.set(Math.sin(this.camYaw), 0, Math.cos(this.camYaw));
    const right = this.pr.set(-Math.cos(this.camYaw), 0, Math.sin(this.camYaw));
    const ix = (k.has("KeyD") ? 1 : 0) - (k.has("KeyA") ? 1 : 0);
    const iz = (k.has("KeyW") ? 1 : 0) - (k.has("KeyS") ? 1 : 0);
    const wish = this.pw.set(0, 0, 0).addScaledVector(fwd, iz).addScaledVector(right, ix);
    if (wish.lengthSq() > 0) wish.normalize();

    const grounded = p.pos.y <= 0.02;

    // timers
    p.cd -= dt;
    p.dashCd = Math.max(0, p.dashCd - dt);
    p.healCd = Math.max(0, p.healCd - dt);
    p.invul = Math.max(0, p.invul - dt);
    p.flash = Math.max(0, p.flash - dt * 4);
    p.aimT = Math.max(0, p.aimT - dt);
    p.boostDelay = Math.max(0, p.boostDelay - dt);

    // ---- weapon logic
    const w = this.nano.current;
    const down = this.mouseDown && !this.suit.active;
    const ready = this.nano.ready && !this.suit.active;
    let blocking = false;
    let absorbing = false;
    let uniOn = false;
    if (ready) {
      switch (w) {
        case W.REPULSOR:
          if (down && p.cd <= 0) this.fireBolt();
          break;
        case W.REFOCUS:
          absorbing = down;
          break;
        case W.UNI:
          if (p.overheat && p.heat < 0.35) p.overheat = false;
          if (down && !p.overheat) {
            uniOn = true;
            p.heat += dt / 2.8;
            p.aimT = 0.3;
            if (p.heat >= 1) {
              p.heat = 1;
              p.overheat = true;
              this.say("UNI-BEAM ร้อนจัด — รอระบายความร้อน", 1.4);
              sfx.block();
            }
          }
          break;
        case W.CANNON:
          if (down && p.cd <= 0) {
            if (p.charge === 0) sfx.charge();
            p.charge = Math.min(1, p.charge + dt / 1.2);
            p.aimT = 0.3;
          } else if (!down && p.charge > 0) {
            if (p.charge > 0.2) this.fireCannon(p.charge);
            p.charge = 0;
          }
          break;
        case W.SENTRY:
          if (down && p.cd <= 0) this.deploySentry();
          break;
        case W.BLADE:
          if (down && p.swingT <= 0 && p.cd <= 0) this.startSwing();
          break;
        case W.KATAR:
          if (down && p.cd <= 0) this.katarStab();
          break;
        case W.HAMMER:
          if (down && p.hammerT <= 0 && p.cd <= 0) this.startHammer();
          break;
        case W.MISSILE:
          if (down && p.cd <= 0) this.fireMissiles();
          break;
        case W.SHIELD:
          blocking = down;
          break;
        case W.GAUNTLET:
          if (down && p.cd <= 0) {
            if (p.ult >= 100) {
              if (p.channel === 0) sfx.charge();
              p.channel = Math.min(1, p.channel + dt / 1.5);
              p.aimT = 0.3;
              if (p.channel >= 1) this.infinitySnap();
            } else {
              p.cd = 0.8;
              this.say(`พลัง ULT ยังไม่เต็ม (${Math.floor(p.ult)}%) — โจมตีบอส ดูดพลังงาน หรือ PARRY เพื่อชาร์จ`, 2.4);
              sfx.block();
            }
          } else if (!down) {
            p.channel = Math.max(0, p.channel - dt * 2.5);
          }
          break;
      }
    } else {
      p.charge = 0;
      p.channel = 0;
    }
    // Lightning Refocus: releasing the button fires everything the fins absorbed
    if (p.absorbing && !absorbing && ready && p.refocus > 0.12 && p.cd <= 0) this.fireRefocus();
    p.absorbing = absorbing;
    p.uniOn = uniOn;
    if (!uniOn) p.heat = Math.max(0, p.heat - dt * (p.overheat ? 0.35 : 0.5));
    if (blocking && !p.blocking) p.blockT = 0;
    if (blocking) p.blockT += dt;
    p.blocking = blocking;

    // energy blade swing (+ nano hand blade follow-up)
    if (p.swingT > 0) {
      p.swingT -= dt;
      const e = 0.45 - p.swingT;
      if (!p.swingHit && e >= 0.16) {
        p.swingHit = true;
        this.swordHit();
      }
      if (!p.swingHit2 && e >= 0.3) {
        p.swingHit2 = true;
        if (this.meleeStrike(6.2, 0.2, 45, new THREE.Color(0.8, 2, 2.8), 10)) sfx.hit();
      }
    }

    // nano katar stab
    if (p.katarT > 0) {
      p.katarT -= dt;
      if (!p.katarHit && p.katarT <= 0.11) {
        p.katarHit = true;
        const finisher = p.katarCombo === 2;
        if (this.meleeStrike(5.6, 0.25, finisher ? 72 : 34, new THREE.Color(0.8, 2.2, 3), finisher ? 22 : 8) && finisher) {
          this.shake = Math.max(this.shake, 0.35);
        }
      }
    }

    // power hammer smash
    if (p.hammerT > 0) {
      p.hammerT -= dt;
      if (!p.hammerHit && 0.95 - p.hammerT >= 0.45) {
        p.hammerHit = true;
        this.hammerSmash();
      }
    }

    // battering ram contact
    if (p.dashT > 0 && p.ram && !p.ramHit) {
      const bb = this.boss;
      if (bb.state !== "dead" && bb.state !== "roar" && Math.hypot(p.pos.x - bb.pos.x, p.pos.z - bb.pos.z) < 5.6 && p.pos.y < 6) this.batteringRam();
    }

    // ---- movement
    let speed = grounded ? 11 : 14;
    if (blocking) speed = 5;
    if (p.charge > 0) speed = 6;
    if (p.swingT > 0) speed = 7;
    if (absorbing) speed = 6;
    if (uniOn) speed = 7;
    if (p.channel > 0) speed = 4;
    if (p.hammerT > 0) speed = 4;
    if (p.katarT > 0) speed = 8;

    if (p.dashT > 0) {
      p.dashT -= dt;
      p.vel.x = p.dashDir.x * (p.ram ? 44 : 36);
      p.vel.z = p.dashDir.z * (p.ram ? 44 : 36);
      if (p.dashT <= 0) p.ram = false;
      this.fx.spawn(p.pos.x, p.pos.y + 1, p.pos.z, 0, 0, 0, 0.35, 0.5, new THREE.Color(0.7, 1.5, 2.2));
    } else if (p.lungeT > 0) {
      p.lungeT -= dt;
      p.vel.x = Math.sin(p.heading) * 19;
      p.vel.z = Math.cos(p.heading) * 19;
    } else {
      const a = 1 - Math.exp(-(grounded ? 14 : 5) * dt);
      p.vel.x += (wish.x * speed - p.vel.x) * a;
      p.vel.z += (wish.z * speed - p.vel.z) * a;
    }

    // vertical: jump / hover with thrusters
    const space = k.has("Space");
    if (space && !p.spaceHeld && grounded) p.vel.y = 9;
    p.spaceHeld = space;
    if (p.boostEmpty && p.boost > 20) p.boostEmpty = false;
    const thrust = !this.armorDestroyed && space && p.boost > 0 && !p.boostEmpty;
    p.thrusting = thrust;
    if (thrust) {
      p.vel.y = Math.min(p.vel.y + 55 * dt, 10.5);
      p.boost -= 30 * dt;
      p.boostDelay = 0.7;
      if (p.boost <= 0) {
        p.boost = 0;
        p.boostEmpty = true;
      }
      if (Math.random() < 0.7) this.fx.spawn(p.pos.x + rnd(-0.3, 0.3), p.pos.y + 0.1, p.pos.z + rnd(-0.3, 0.3), rnd(-1, 1), rnd(-6, -3), rnd(-1, 1), 0.3, 0.2, new THREE.Color(2.0, 1.3, 0.4));
    } else {
      p.vel.y -= 30 * dt;
      if (p.vel.y < -20) p.vel.y = -20;
      if (grounded) p.boost = Math.min(100, p.boost + 32 * dt);
      else if (p.boostDelay <= 0) p.boost = Math.min(100, p.boost + 7 * dt);
    }
    if (p.pos.y > 30 && p.vel.y > 0) p.vel.y = 0;

    const prevVy = p.vel.y;
    p.pos.addScaledVector(p.vel, dt);
    if (p.pos.y < 0) {
      if (prevVy < -14) {
        const c = new THREE.Color(0.8, 0.6, 0.9);
        for (let i = 0; i < 18; i++) this.fx.spawn(p.pos.x, 0.2, p.pos.z, rnd(-4, 4), rnd(0.5, 3), rnd(-4, 4), 0.6, 0.25, c, -8);
      }
      p.pos.y = 0;
      if (p.vel.y < 0) p.vel.y = 0;
    }
    // arena bounds
    const rr = Math.hypot(p.pos.x, p.pos.z);
    if (rr > ARENA_R - 1) {
      p.pos.x *= (ARENA_R - 1) / rr;
      p.pos.z *= (ARENA_R - 1) / rr;
    }
    // boss body collision
    const b = this.boss;
    if (b.state !== "dead" && b.pos.y < 0.5 && p.pos.y < 6.5) {
      const dx = p.pos.x - b.pos.x;
      const dz = p.pos.z - b.pos.z;
      const d = Math.hypot(dx, dz);
      const minD = 2.5;
      if (d < minD) {
        const nx = d > 0.001 ? dx / d : 1;
        const nz = d > 0.001 ? dz / d : 0;
        p.pos.x = b.pos.x + nx * minD;
        p.pos.z = b.pos.z + nz * minD;
      }
    }

    // heading follows the camera
    if (!this.freeLook) p.heading += angDiff(p.heading, this.camYaw) * Math.min(1, dt * 14);
    p.walk += Math.hypot(p.vel.x, p.vel.z) * dt * 0.75;
    // Armor damage visuals are synchronized in the main loop, including the defeat frame.
  }

  private aimTarget(jitter = true): THREE.Vector3 {
    const cam = this.camera;
    const dir = this.v1;
    cam.getWorldDirection(dir);
    const origin = cam.position;
    const b = this.boss;
    const out = new THREE.Vector3();
    if (b.state !== "dead") {
      const bc = this.v2.set(b.pos.x, b.pos.y + 3.8, b.pos.z);
      const toB = this.v3.copy(bc).sub(origin);
      const t = toB.dot(dir);
      if (t > 0) {
        const closest = out.copy(origin).addScaledVector(dir, t);
        if (closest.distanceTo(bc) < 5.2) {
          return jitter ? out.set(bc.x + rnd(-0.6, 0.6), bc.y + rnd(-0.6, 0.6), bc.z + rnd(-0.6, 0.6)) : out.set(bc.x, bc.y, bc.z);
        }
      }
    }
    return out.copy(origin).addScaledVector(dir, 150);
  }

  private muzzlePos(out: THREE.Vector3) {
    this.rig.root.updateMatrixWorld(true);
    return this.nano.weapon.muzzle.getWorldPosition(out);
  }

  private fireBolt() {
    const p = this.pl;
    const m = this.muzzlePos(new THREE.Vector3());
    const target = this.aimTarget();
    const dir = target.sub(m).normalize();
    const mesh = new THREE.Mesh(this.boltGeo, this.boltMat);
    mesh.position.copy(m);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
    this.scene.add(mesh);
    this.projs.push({ mesh, vel: dir.clone().multiplyScalar(95), life: 1.5, dmg: 14, owner: "p", r: 0.3, kind: "bolt", power: 0 });
    p.cd = 0.16;
    p.aimT = 0.6;
    p.aimPitch = Math.asin(clamp(dir.y, -1, 1));
    sfx.shoot();
    const c = new THREE.Color(0.8, 2, 2.8);
    for (let i = 0; i < 3; i++) this.fx.spawn(m.x, m.y, m.z, dir.x * 8 + rnd(-2, 2), dir.y * 8 + rnd(-2, 2), dir.z * 8 + rnd(-2, 2), 0.2, 0.14, c);
  }

  private spawnCannonShot(from: THREE.Vector3, dir: THREE.Vector3, size: number, dmg: number, power: number, speed = 72) {
    const g = new THREE.Group();
    const core = new THREE.Mesh(this.sphereGeo, this.canCore);
    const shell = new THREE.Mesh(this.sphereGeo, this.canShell);
    shell.scale.setScalar(1.7);
    g.add(core, shell);
    g.scale.setScalar(size);
    g.position.copy(from);
    this.scene.add(g);
    this.projs.push({ mesh: g, vel: dir.clone().multiplyScalar(speed), life: 2, dmg, owner: "p", r: size * 0.9, kind: "cannon", power });
  }

  private fireCannon(charge: number) {
    const p = this.pl;
    const m = this.muzzlePos(new THREE.Vector3());
    const target = this.aimTarget();
    const dir = target.sub(m).normalize();
    const size = 0.5 + charge * 0.9;
    this.spawnCannonShot(m, dir, size, 120 + 480 * charge, charge);
    p.cd = 0.9;
    p.aimT = 0.7;
    p.aimPitch = Math.asin(clamp(dir.y, -1, 1));
    p.vel.x -= dir.x * 7;
    p.vel.z -= dir.z * 7;
    this.shake = Math.max(this.shake, 0.3 + charge * 0.5);
    sfx.boom();
    const c = new THREE.Color(3, 1.8, 0.6);
    for (let i = 0; i < 22; i++) this.fx.spawn(m.x, m.y, m.z, dir.x * 14 + rnd(-6, 6), dir.y * 14 + rnd(-6, 6), dir.z * 14 + rnd(-6, 6), 0.4, 0.3, c);

    // ZERO CANNONS: a full charge also fires the shoulder cannons
    if (charge >= 0.85) {
      this.rig.root.updateMatrixWorld(true);
      const aim = this.aimTarget(false);
      for (const em of this.nano.weapon.extraMuzzles) {
        const from = em.getWorldPosition(new THREE.Vector3());
        const d = aim.clone().sub(from).normalize();
        this.spawnCannonShot(from, d, 0.62, 95, 0.55, 82);
        for (let i = 0; i < 12; i++) this.fx.spawn(from.x, from.y, from.z, d.x * 12 + rnd(-4, 4), d.y * 12 + rnd(-4, 4), d.z * 12 + rnd(-4, 4), 0.35, 0.22, c);
      }
      this.say("ZERO CANNONS!", 0.9);
    }
  }

  private startSwing() {
    const p = this.pl;
    p.swingT = 0.45;
    p.swingHit = false;
    p.swingHit2 = false;
    p.cd = 0.5;
    p.lungeT = 0.2;
    sfx.slash();
    // slash arc fx
    const f = new THREE.Vector3(Math.sin(p.heading), 0, Math.cos(p.heading));
    const c = new THREE.Color(0.8, 2, 2.8);
    for (let i = 0; i < 26; i++) {
      const a = -1.1 + (i / 25) * 2.2;
      const rx = Math.cos(p.heading) * Math.sin(a) * -1;
      const rz = Math.sin(p.heading) * Math.sin(a);
      this.fx.spawn(
        p.pos.x + f.x * Math.cos(a) * 2.4 + rx * 2.4,
        p.pos.y + 1.2 + Math.sin(a * 2) * 0.5,
        p.pos.z + f.z * Math.cos(a) * 2.4 + rz * 2.4,
        f.x * 3,
        0,
        f.z * 3,
        0.28,
        0.22,
        c
      );
    }
  }

  private swordHit() {
    const p = this.pl;
    const b = this.boss;
    const fwdH = p.heading;
    // deflect enemy projectiles
    for (const pr of this.projs) {
      if (pr.owner !== "b") continue;
      const d = pr.mesh.position.distanceTo(this.v1.set(p.pos.x, p.pos.y + 1.2, p.pos.z));
      if (d < 6 && this.isFront(p.pos, pr.mesh.position, fwdH, -0.2)) this.reflect(pr);
    }
    if (b.state === "dead" || b.state === "roar") return;
    const d = Math.hypot(b.pos.x - p.pos.x, b.pos.z - p.pos.z);
    if (d < 7.2 && this.isFront(p.pos, b.pos, fwdH, 0.25) && p.pos.y < b.pos.y + 7.5) {
      const hp = this.v1.set(b.pos.x + (p.pos.x - b.pos.x) * 0.5, p.pos.y + 1.5, b.pos.z + (p.pos.z - b.pos.z) * 0.5);
      this.damageBoss(135, hp);
      this.shake = Math.max(this.shake, 0.35);
      const c = new THREE.Color(0.8, 2, 2.8);
      for (let i = 0; i < 24; i++) this.fx.spawn(hp.x, hp.y, hp.z, rnd(-8, 8), rnd(-2, 8), rnd(-8, 8), 0.4, 0.2, c);
    }
  }

  /** generic melee cone test in front of the player; returns true when the boss was hit */
  private meleeStrike(reach: number, minDot: number, dmg: number, color: THREE.Color, sparks: number): boolean {
    const p = this.pl;
    const b = this.boss;
    if (b.state === "dead" || b.state === "roar") return false;
    const d = Math.hypot(b.pos.x - p.pos.x, b.pos.z - p.pos.z);
    if (d < reach + 1.4 && this.isFront(p.pos, b.pos, p.heading, minDot) && p.pos.y < b.pos.y + 7.5) {
      const hp = new THREE.Vector3(b.pos.x + (p.pos.x - b.pos.x) * 0.5, p.pos.y + 1.5, b.pos.z + (p.pos.z - b.pos.z) * 0.5);
      this.damageBoss(dmg, hp);
      for (let i = 0; i < sparks; i++) this.fx.spawn(hp.x, hp.y, hp.z, rnd(-8, 8), rnd(-2, 8), rnd(-8, 8), 0.4, 0.2, color);
      return true;
    }
    return false;
  }

  private spawnRing(x: number, y: number, z: number, color: THREE.Color, speed: number, max: number) {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false });
    const m = new THREE.Mesh(new THREE.RingGeometry(0.88, 1, 56), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y, z);
    m.scale.setScalar(0.5);
    m.frustumCulled = false;
    this.scene.add(m);
    this.rings.push({ mesh: m, r: 0.5, speed, max });
  }

  private removeRing(r: Ring) {
    r.mesh.removeFromParent();
    r.mesh.geometry.dispose();
    (r.mesh.material as THREE.Material).dispose();
  }

  private spawnFlash(from: THREE.Vector3, to: THREE.Vector3, color: THREE.Color, radius: number, life: number) {
    const dir = to.clone().sub(from);
    const len = dir.length();
    if (len < 0.01) return;
    dir.divideScalar(len);
    const m = new THREE.Mesh(
      this.beamGeo,
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
    );
    m.position.copy(from).addScaledVector(dir, len / 2);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    m.scale.set(radius, len, radius);
    m.frustumCulled = false;
    this.scene.add(m);
    this.flashes.push({ mesh: m, life, max: life });
  }

  private removeFlash(f: Flash) {
    f.mesh.removeFromParent();
    (f.mesh.material as THREE.Material).dispose();
  }

  private updateRingsAndFlashes(dt: number) {
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.r += r.speed * dt;
      r.mesh.scale.setScalar(r.r);
      (r.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.85 * (1 - r.r / r.max));
      if (r.r >= r.max) {
        this.removeRing(r);
        this.rings.splice(i, 1);
      }
    }
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      const f = this.flashes[i];
      f.life -= dt;
      (f.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, f.life / f.max);
      if (f.life <= 0) {
        this.removeFlash(f);
        this.flashes.splice(i, 1);
      }
    }
  }

  /* ---- Nano Katar ---- */
  private katarStab() {
    const p = this.pl;
    p.katarCombo = this.playTime - p.katarLast < 0.7 ? (p.katarCombo + 1) % 3 : 0;
    p.katarLast = this.playTime;
    p.katarHand = p.katarCombo % 2;
    p.katarT = 0.2;
    p.katarHit = false;
    p.cd = p.katarCombo === 2 ? 0.34 : 0.2;
    p.lungeT = 0.09;
    sfx.slash();
    const f = new THREE.Vector3(Math.sin(p.heading), 0, Math.cos(p.heading));
    const c = new THREE.Color(0.8, 2.2, 3);
    for (let i = 0; i < 10; i++) {
      this.fx.spawn(p.pos.x + f.x * 1.6 + rnd(-0.4, 0.4), p.pos.y + 1.3 + rnd(-0.2, 0.2), p.pos.z + f.z * 1.6 + rnd(-0.4, 0.4), f.x * 6, rnd(-1, 1), f.z * 6, 0.2, 0.14, c);
    }
  }

  /* ---- Power Hammer & Battering Ram ---- */
  private startHammer() {
    const p = this.pl;
    p.hammerT = 0.95;
    p.hammerHit = false;
    p.cd = 1.3;
    sfx.charge();
  }

  private hammerSmash() {
    const p = this.pl;
    const b = this.boss;
    const f = new THREE.Vector3(Math.sin(p.heading), 0, Math.cos(p.heading));
    const cx = p.pos.x + f.x * 4.2;
    const cz = p.pos.z + f.z * 4.2;
    sfx.boom();
    this.shake = Math.max(this.shake, 0.7);
    this.explode(new THREE.Vector3(cx, 0.6, cz), 0.8, new THREE.Color(1.2, 2.2, 3));
    this.spawnRing(cx, 0.25, cz, new THREE.Color(0.6, 1.8, 3), 26, 16);
    if (b.state !== "dead" && b.state !== "roar" && p.pos.y < 3) {
      const d = Math.hypot(b.pos.x - cx, b.pos.z - cz);
      if (d < 8.2) {
        this.damageBoss(240, new THREE.Vector3(b.pos.x, 2.5, b.pos.z));
        this.staggerBoss(1.0);
      }
    }
  }

  private batteringRam() {
    const p = this.pl;
    const b = this.boss;
    p.ramHit = true;
    p.dashT = Math.min(p.dashT, 0.06);
    sfx.boom();
    this.shake = Math.max(this.shake, 0.9);
    const hp = new THREE.Vector3((p.pos.x + b.pos.x) / 2, p.pos.y + 1.6, (p.pos.z + b.pos.z) / 2);
    this.damageBoss(120, hp);
    this.explode(hp, 0.6, new THREE.Color(1.2, 2.4, 3));
    this.spawnRing(hp.x, 0.3, hp.z, new THREE.Color(0.8, 2.0, 3), 24, 12);
    this.staggerBoss(0.9);
    const dx = b.pos.x - p.pos.x;
    const dz = b.pos.z - p.pos.z;
    const l = Math.hypot(dx, dz) || 1;
    b.pos.x += (dx / l) * 2.5;
    b.pos.z += (dz / l) * 2.5;
  }

  /* ---- Micro-Missiles & Micro-Lasers ---- */
  private fireMissiles() {
    const p = this.pl;
    const wd = this.nano.weapon;
    this.rig.root.updateMatrixWorld(true);
    const mR = wd.muzzle.getWorldPosition(new THREE.Vector3());
    const mL = (wd.extraMuzzles[0] ?? wd.muzzle).getWorldPosition(new THREE.Vector3());
    const target = this.aimTarget(false);
    p.cd = 1.5;
    p.aimT = 0.8;
    sfx.shoot();
    sfx.whoosh();
    const puff = new THREE.Color(2.2, 1.7, 1.2);
    for (let i = 0; i < 8; i++) {
      const from = i % 2 ? mL : mR;
      const dir = target.clone().sub(from).normalize();
      dir.x += rnd(-0.35, 0.35);
      dir.y += rnd(0.25, 0.6);
      dir.z += rnd(-0.2, 0.2);
      dir.normalize();
      const mesh = new THREE.Mesh(this.missileGeo, this.missileMat);
      mesh.position.copy(from);
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
      this.scene.add(mesh);
      this.projs.push({ mesh, vel: dir.multiplyScalar(18 + rnd(0, 6)), life: 3, dmg: 24, owner: "p", r: 0.45, kind: "missile", power: 0, homing: true, age: 0 });
      this.fx.spawn(from.x, from.y, from.z, rnd(-2, 2), rnd(1, 4), rnd(-2, 2), 0.4, 0.28, puff);
    }
    // micro-lasers: four pinpoint lock-on shots from the forearms
    const b = this.boss;
    if (b.state !== "dead") {
      const cyan = new THREE.Color(0.8, 2.4, 3.0);
      const hands = [this.rig.handR, this.rig.handL];
      for (let i = 0; i < 4; i++) {
        const from = hands[i % 2].getWorldPosition(new THREE.Vector3());
        const to = new THREE.Vector3(b.pos.x + rnd(-1.4, 1.4), b.pos.y + rnd(1.5, 6), b.pos.z + rnd(-1.4, 1.4));
        this.spawnFlash(from, to, cyan, 0.035, 0.14);
        if (b.state !== "roar") this.damageBoss(7, to);
        this.fx.spawn(to.x, to.y, to.z, rnd(-3, 3), rnd(0, 4), rnd(-3, 3), 0.25, 0.14, cyan);
      }
    }
  }

  /* ---- Lightning Refocus: fire back what the fins absorbed ---- */
  private fireRefocus() {
    const p = this.pl;
    const e = p.refocus;
    p.refocus = 0;
    const m = this.muzzlePos(new THREE.Vector3());
    const target = this.aimTarget();
    const dir = target.sub(m).normalize();
    const size = 0.8 + e * 1.4;
    const g = new THREE.Group();
    const beam = new THREE.Mesh(this.boltGeo, this.refocusMat);
    beam.scale.set(size * 2.6, size * 2.6, 7);
    const head = new THREE.Mesh(this.sphereGeo, this.canCore);
    head.material = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 3, 3.4) });
    head.scale.setScalar(size * 0.55);
    head.position.z = 3;
    g.add(beam, head);
    g.position.copy(m);
    g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
    this.scene.add(g);
    this.projs.push({ mesh: g, vel: dir.clone().multiplyScalar(125), life: 1.2, dmg: 70 + 560 * e, owner: "p", r: 0.8 + e * 1.4, kind: "refocus", power: e });
    p.cd = 0.5;
    p.aimT = 0.9;
    p.aimPitch = Math.asin(clamp(dir.y, -1, 1));
    p.vel.x -= dir.x * 6;
    p.vel.z -= dir.z * 6;
    this.shake = Math.max(this.shake, 0.4 + e * 0.6);
    sfx.boom();
    sfx.parry();
    const c = new THREE.Color(1.4, 2.6, 3.2);
    for (let i = 0; i < 30; i++) this.fx.spawn(m.x, m.y, m.z, dir.x * 16 + rnd(-7, 7), dir.y * 16 + rnd(-7, 7), dir.z * 16 + rnd(-7, 7), 0.45, 0.28, c);
    this.say(`LIGHTNING REFOCUS! (${Math.round(e * 100)}%)`, 1.2);
  }

  /* ---- Energy Displacer Sentries ---- */
  private deploySentry() {
    const p = this.pl;
    p.cd = 0.9;
    if (this.sentries.length >= 3) {
      const old = this.sentries.shift()!;
      this.popSentry(old);
    }
    this.rig.root.updateMatrixWorld(true);
    const from = this.rig.handR.getWorldPosition(new THREE.Vector3());
    const g = new THREE.Group();
    const red = new THREE.MeshStandardMaterial({ color: RED_C, metalness: 0.7, roughness: 0.3 });
    const gold = new THREE.MeshStandardMaterial({ color: GOLD_C, metalness: 0.75, roughness: 0.3 });
    const body = new THREE.Mesh(new THREE.OctahedronGeometry(0.36, 0), red);
    body.castShadow = true;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.05, 8, 24), gold);
    ring.rotation.x = Math.PI / 2;
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 12, 10),
      new THREE.MeshStandardMaterial({ color: 0xaaf4ff, emissive: 0x55ddff, emissiveIntensity: 4, metalness: 0 })
    );
    g.add(body, ring, core);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU;
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.34), gold);
      fin.position.set(Math.cos(a) * 0.42, -0.18, Math.sin(a) * 0.42);
      fin.rotation.y = -a;
      g.add(fin);
    }
    g.position.copy(from);
    g.scale.setScalar(0.1);
    this.scene.add(g);
    this.sentries.push({ g, core, ring, life: 16, fire: 0.5, ang: Math.random() * TAU, spawn: 0, pos: from.clone() });
    sfx.morph();
    const c = new THREE.Color(0.9, 2.2, 3);
    for (let i = 0; i < 16; i++) this.fx.spawn(from.x, from.y, from.z, rnd(-4, 4), rnd(-2, 5), rnd(-4, 4), 0.5, 0.18, c);
    this.say(`Energy Displacer Sentry ${this.sentries.length}/3`, 1.1);
  }

  private popSentry(sn: Sentry) {
    const c = new THREE.Color(2.2, 1.2, 0.5);
    for (let i = 0; i < 18; i++) this.fx.spawn(sn.pos.x, sn.pos.y, sn.pos.z, rnd(-5, 5), rnd(-2, 6), rnd(-5, 5), 0.6, 0.2, c, -4);
    sn.g.removeFromParent();
  }

  private updateSentries(dt: number) {
    const p = this.pl;
    const b = this.boss;
    for (let i = this.sentries.length - 1; i >= 0; i--) {
      const sn = this.sentries[i];
      sn.life -= dt;
      sn.spawn += dt;
      const idx = this.sentries.indexOf(sn);
      const n = Math.max(1, this.sentries.length);
      const a = this.time * 0.7 + (idx / n) * TAU;
      const tx = p.pos.x + Math.cos(a) * 3.6;
      const ty = p.pos.y + 3.3 + Math.sin(this.time * 2 + idx) * 0.35;
      const tz = p.pos.z + Math.sin(a) * 3.6;
      const k = Math.min(1, dt * 4.5);
      sn.pos.x += (tx - sn.pos.x) * k;
      sn.pos.y += (ty - sn.pos.y) * k;
      sn.pos.z += (tz - sn.pos.z) * k;
      sn.g.position.copy(sn.pos);
      sn.g.scale.setScalar(Math.min(1, 0.1 + sn.spawn * 2.4) * (sn.life < 2 && Math.sin(sn.life * 22) > 0 ? 0.6 : 1));
      sn.ring.rotation.z += dt * 3;
      sn.g.rotation.y += dt * 1.5;
      if (b.state !== "dead") {
        // face the boss
        sn.g.rotation.y = Math.atan2(b.pos.x - sn.pos.x, b.pos.z - sn.pos.z);
        sn.fire -= dt;
        if (sn.fire <= 0 && sn.spawn > 0.5 && b.state !== "roar") {
          sn.fire = 0.55;
          const to = this.v1.set(b.pos.x + rnd(-1, 1), b.pos.y + 3.8 + rnd(-1, 1), b.pos.z + rnd(-1, 1));
          const dir = to.clone().sub(sn.pos).normalize();
          const mesh = new THREE.Mesh(this.boltGeo, this.boltMat);
          mesh.position.copy(sn.pos);
          mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
          this.scene.add(mesh);
          this.projs.push({ mesh, vel: dir.multiplyScalar(85), life: 1.5, dmg: 10, owner: "p", r: 0.3, kind: "bolt", power: 0 });
          this.fx.spawn(sn.pos.x, sn.pos.y, sn.pos.z, 0, 0, 0, 0.2, 0.3, new THREE.Color(0.8, 2, 2.8));
        }
      }
      if (sn.life <= 0) {
        this.popSentry(sn);
        this.sentries.splice(i, 1);
      }
    }
  }

  /* ---- Infinity Gauntlet: the snap ---- */
  private infinitySnap() {
    const p = this.pl;
    const b = this.boss;
    p.ult = 0;
    p.channel = 0;
    p.cd = 2.5;
    this.snapCount++;
    sfx.boom();
    sfx.parry();
    sfx.roar();
    this.shake = 1.5;
    for (const pr of this.projs) if (pr.owner === "b") pr.mesh.removeFromParent();
    this.projs = this.projs.filter((x) => x.owner !== "b");
    for (const m of this.meteors) this.removeMeteor(m);
    this.meteors = [];
    for (const sh of this.shocks) this.removeShock(sh);
    this.shocks = [];
    this.spawnRing(p.pos.x, 0.3, p.pos.z, new THREE.Color(3, 2.4, 1.2), 70, 110);
    this.spawnRing(p.pos.x, 0.5, p.pos.z, new THREE.Color(1.6, 2.4, 3), 45, 90);
    const cols = [new THREE.Color(1, 2.2, 4), new THREE.Color(4, 0.8, 0.8), new THREE.Color(2.8, 1, 4), new THREE.Color(4, 2.4, 0.6), new THREE.Color(0.8, 4, 1.4), new THREE.Color(4, 3.8, 1)];
    this.rig.root.updateMatrixWorld(true);
    const hp = this.nano.weapon.muzzle.getWorldPosition(new THREE.Vector3());
    for (let i = 0; i < 90; i++) this.fx.spawn(hp.x, hp.y, hp.z, rnd(-14, 14), rnd(-4, 14), rnd(-14, 14), rnd(0.6, 1.4), rnd(0.2, 0.45), cols[i % 6], -3);
    if (b.state !== "dead") {
      const at = new THREE.Vector3(b.pos.x, b.pos.y + 3.8, b.pos.z);
      for (let i = 0; i < 120; i++) this.fx.spawn(at.x + rnd(-2, 2), at.y + rnd(-3, 3), at.z + rnd(-2, 2), rnd(-12, 12), rnd(-3, 12), rnd(-12, 12), rnd(0.8, 1.8), rnd(0.25, 0.5), cols[i % 6], -2);
      this.damageBoss(900, at, true);
      this.staggerBoss(3.2);
    }
    this.say("“ฉันคือ... ไอรอนแมน” — INFINITY SNAP!", 2.6);
  }

  private reflect(pr: Proj) {
    const b = this.boss;
    const dir = this.v2.set(b.pos.x, b.pos.y + 4, b.pos.z).sub(pr.mesh.position).normalize();
    pr.vel.copy(dir).multiplyScalar(60);
    pr.owner = "p";
    pr.dmg = 70;
    sfx.parry();
    const c = new THREE.Color(2.4, 2.4, 3);
    for (let i = 0; i < 14; i++) this.fx.spawn(pr.mesh.position.x, pr.mesh.position.y, pr.mesh.position.z, rnd(-6, 6), rnd(-6, 6), rnd(-6, 6), 0.3, 0.18, c);
  }

  private damagePlayer(amount: number, src: THREE.Vector3, kind: "melee" | "proj" | "wave" | "meteor") {
    const p = this.pl;
    if (this.status !== "playing") return;
    if (p.invul > 0 || p.dashT > 0) return;
    let dmg = amount;
    if (p.blocking && this.nano.ready) {
      const directional = kind === "melee" || kind === "proj";
      const frontal = !directional || this.isFront(p.pos, src, p.heading, -0.15);
      if (frontal) {
        if (kind === "melee" && p.blockT < 0.4) {
          // PARRY!
          sfx.parry();
          this.shake = Math.max(this.shake, 0.6);
          const c = new THREE.Color(2.5, 2.5, 3);
          for (let i = 0; i < 40; i++) this.fx.spawn(p.pos.x + Math.sin(p.heading) * 1.4, p.pos.y + 1.3, p.pos.z + Math.cos(p.heading) * 1.4, rnd(-9, 9), rnd(-4, 9), rnd(-9, 9), 0.5, 0.22, c);
          p.invul = 0.5;
          p.ult = Math.min(100, p.ult + 12);
          this.staggerBoss(1.8);
          return;
        }
        dmg *= directional ? 0.15 : 0.5;
        sfx.block();
        const c = new THREE.Color(1.5, 2.2, 3);
        for (let i = 0; i < 12; i++) this.fx.spawn(p.pos.x + Math.sin(p.heading) * 1.4, p.pos.y + 1.3, p.pos.z + Math.cos(p.heading) * 1.4, rnd(-5, 5), rnd(-2, 5), rnd(-5, 5), 0.3, 0.15, c);
      }
    }
    if (this.armorDestroyed) this.tonyHp = Math.max(0, this.tonyHp - dmg);
    else p.hp = Math.max(0, p.hp - dmg);
    p.flash = 1;
    p.invul = 0.3;
    this.hurtCount++;
    this.shake = Math.max(this.shake, 0.25 + Math.min(0.6, dmg / 60));
    sfx.hurt();
    if ((this.armorDestroyed && this.tonyHp <= 0) || (!this.armorDestroyed && p.hp <= 0)) {
      if (this.armorDestroyed) this.tonyHp = 0;
      else p.hp = 0;
      this.status = "lost";
      this.mouseDown = false;
      if (document.pointerLockElement === this.canvas) document.exitPointerLock();
      const c = new THREE.Color(2.5, 1.2, 0.4);
      for (let i = 0; i < 80; i++) this.fx.spawn(p.pos.x, p.pos.y + 1, p.pos.z, rnd(-10, 10), rnd(0, 12), rnd(-10, 10), rnd(0.6, 1.4), 0.3, c, -10);
      sfx.boom();
      this.emitHud(true);
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Player pose                                                     */
  /* ---------------------------------------------------------------- */


private updatePlayerPose(dt: number) {
    const p = this.pl;
    const r = this.rig;
    const grounded = p.pos.y <= 0.05;
    const speed = Math.hypot(p.vel.x, p.vel.z);
    const dead = this.status === "lost";
    if (this.suit.active) {
      this.suit.poseTony(dt, this.time, { pos: p.pos, heading: p.heading, speed, walk: p.walk, grounded, camPitch: this.camPitch });
      return;
    }

    r.root.position.copy(p.pos);
    r.root.rotation.y = p.heading;

    // legs
    const sw = grounded ? Math.sin(p.walk) * Math.min(1, speed / 8) * 0.85 : 0;
    const air = !grounded;
    r.hipR.rotation.x = damp(r.hipR.rotation.x, air ? 0.15 : sw, 18, dt);
    r.hipL.rotation.x = damp(r.hipL.rotation.x, air ? -0.25 : -sw, 18, dt);
    r.kneeR.rotation.x = damp(r.kneeR.rotation.x, air ? 0.35 : Math.max(0, -sw) * 0.9, 18, dt);
    r.kneeL.rotation.x = damp(r.kneeL.rotation.x, air ? 0.5 : Math.max(0, sw) * 0.9, 18, dt);

    // lean
    const W_ = this.nano.current;
    let lean = air ? 0.15 + Math.min(0.35, speed / 30) : Math.min(0.28, speed / 40);
    if (p.uniOn) lean = -0.14;
    if (p.absorbing) lean = -0.08;
    if (W_ === W.HAMMER && p.hammerT > 0) {
      const e = 0.95 - p.hammerT;
      lean = e < 0.45 ? -0.3 * (e / 0.45) : 0.5;
    }
    r.body.rotation.x = damp(r.body.rotation.x, dead ? 1.2 : lean, 8, dt);
    r.body.rotation.y = damp(r.body.rotation.y, p.swingT > 0 ? Math.sin((0.45 - p.swingT) * 7) * 0.3 : p.katarT > 0 ? (p.katarHand ? 0.4 : -0.4) : 0, 14, dt);
    r.head.rotation.x = damp(r.head.rotation.x, -lean * 0.8 + (this.camPitch - 0.2) * 0.4, 8, dt);

    // flames
    const fl = (p.thrusting || p.pos.y > 0.3) && !dead;
    for (const f of r.flames) {
      f.visible = fl;
      if (fl) {
        const s = p.thrusting ? 1 : 0.45;
        f.scale.set(0.8 + Math.random() * 0.4, s * (0.8 + Math.random() * 0.5), 0.8 + Math.random() * 0.4);
      }
    }
    // chest pulse (triangular arc reactor)
    const cm = r.chest.material as THREE.MeshStandardMaterial;
    const rg = r.reactorGlow.material as THREE.MeshStandardMaterial;
    cm.emissiveIntensity = 3.5 + Math.sin(this.time * 4) * 1.2 + (p.uniOn ? 6 : 0) + (p.ult >= 100 ? 2 : 0);
    rg.emissiveIntensity = 3 + Math.sin(this.time * 4) * 0.8 + (p.uniOn ? 8 : 0);

    // arms
    const w = this.nano.current;
    const morphing = !this.nano.ready;
    let tShR = -0.55;
    let tElR = -0.9;
    let kR = 10;
    let tShL = -sw * 0.8;
    let tElL = -0.35;
    let kL = 10;
    let tZR = 0;
    let tZL = 0;

    if (morphing) {
      tShR = -1.25;
      tElR = -0.3;
      if (this.nano.weapon.hand === "L") {
        tShL = -1.25;
        tElL = -0.3;
      }
    } else if (w === W.REPULSOR || w === W.CANNON) {
      if (p.aimT > 0) {
        tShR = -1.5 - p.aimPitch * 0.9;
        tElR = -0.08;
        kR = 22;
      } else {
        tShR = -0.9;
        tElR = -0.7;
      }
      if (w === W.CANNON && p.charge > 0) {
        tShR = -1.45;
        tElR = -0.1;
      }
    } else if (w === W.REFOCUS) {
      if (p.absorbing) {
        // arms flung wide while the fins drink in energy
        tShR = -0.35;
        tElR = -0.1;
        tZR = -1.25;
        tShL = -0.35;
        tElL = -0.1;
        tZL = 1.25;
        kR = kL = 14;
      } else if (p.aimT > 0) {
        tShR = -1.5 - p.aimPitch * 0.9;
        tElR = -0.08;
        kR = 22;
      } else {
        tShR = -0.9;
        tElR = -0.7;
      }
    } else if (w === W.UNI) {
      if (p.uniOn) {
        tShR = 0.1;
        tElR = -0.2;
        tZR = -0.85;
        tShL = 0.1;
        tElL = -0.2;
        tZL = 0.85;
        kR = kL = 14;
      } else {
        tShR = -0.7;
        tElR = -0.8;
        tShL = -0.7;
        tElL = -0.8;
      }
    } else if (w === W.SENTRY) {
      tShR = p.cd > 0.45 ? -1.55 : -1.0;
      tElR = p.cd > 0.45 ? -0.2 : -0.7;
      kR = 18;
    } else if (w === W.BLADE) {
      tShR = -1.0;
      tElR = -0.7;
      tShL = -0.8;
      tElL = -0.9;
      if (p.swingT > 0) {
        const e = 0.45 - p.swingT;
        kR = 40;
        if (e < 0.14) {
          tShR = -1.0 + (-2.8 + 1.0) * (e / 0.14);
          tElR = -0.4;
        } else if (e < 0.3) {
          tShR = -0.45;
          tElR = -0.35;
          tShL = -1.5;
          tElL = -0.2;
          kL = 30;
        } else {
          tShR = -1.0;
          tElR = -0.7;
          kR = 12;
        }
      }
    } else if (w === W.KATAR) {
      tShR = -0.95;
      tElR = -1.25;
      tShL = -0.95;
      tElL = -1.25;
      tZR = -0.15;
      tZL = 0.15;
      if (p.katarT > 0) {
        if (p.katarHand === 0) {
          tShR = -1.55;
          tElR = -0.05;
          kR = 45;
        } else {
          tShL = -1.55;
          tElL = -0.05;
          kL = 45;
        }
      }
    } else if (w === W.HAMMER) {
      tShR = -0.9;
      tElR = -0.7;
      tShL = -0.6;
      tElL = -0.8;
      if (p.hammerT > 0) {
        const e = 0.95 - p.hammerT;
        if (e < 0.45) {
          tShR = -0.9 + (-3.0 + 0.9) * (e / 0.45);
          tElR = -0.3;
          kR = 14;
        } else if (e < 0.7) {
          tShR = -0.5;
          tElR = -0.25;
          kR = 50;
        } else {
          tShR = -0.7;
          tElR = -0.6;
          kR = 8;
        }
      }
    } else if (w === W.MISSILE) {
      tShR = -1.15;
      tElR = -0.55;
      tShL = -1.15;
      tElL = -0.55;
      tZR = -0.35;
      tZL = 0.35;
      if (p.aimT > 0) {
        tShR = -1.5 - p.aimPitch * 0.6;
        tElR = -0.1;
        tShL = -1.5 - p.aimPitch * 0.6;
        tElL = -0.1;
        kR = kL = 20;
      }
    } else if (w === W.SHIELD) {
      if (p.blocking) {
        tShL = -1.5;
        tElL = -0.12;
        kL = 25;
      } else {
        tShL = -0.75;
        tElL = -1.0;
      }
      tShR = sw * 0.8;
      tElR = -0.35;
    } else if (w === W.GAUNTLET) {
      tShL = -1.3;
      tElL = -0.55;
      tShR = sw * 0.8;
      tElR = -0.35;
      if (p.channel > 0) {
        tShL = -2.5;
        tElL = -0.25;
        tZL = 0.35;
        kL = 12;
      }
    }
    if (dead) {
      tShR = 0.3;
      tElR = -0.2;
      tShL = 0.3;
      tElL = -0.2;
      tZR = 0;
      tZL = 0;
    }
    const ap = this.armPose;
    ap.shR = damp(ap.shR, tShR, kR, dt);
    ap.elR = damp(ap.elR, tElR, kR, dt);
    ap.shL = damp(ap.shL, tShL, kL, dt);
    ap.elL = damp(ap.elL, tElL, kL, dt);
    ap.zR = damp(ap.zR, tZR, 12, dt);
    ap.zL = damp(ap.zL, tZL, 12, dt);
    r.shR.rotation.x = ap.shR;
    r.elR.rotation.x = ap.elR;
    r.shL.rotation.x = ap.shL;
    r.elL.rotation.x = ap.elL;
    r.shR.rotation.z = ap.zR;
    r.shL.rotation.z = ap.zL;

    // energy shield disc + infinity stones
    const sh = this.nano.weapons[W.SHIELD];
    if (sh.glow) {
      const shieldMat = sh.glow.material as THREE.MeshBasicMaterial;
      shieldMat.opacity = p.blocking ? (this.combatMode === 1 ? 0.62 + Math.sin(this.time * 24) * 0.12 : 0.5 + Math.sin(this.time * 18) * 0.12) : 0.08;
      shieldMat.color.setHex(this.combatMode === 1 ? 0x38e8ff : 0x66dfff);
      shieldMat.wireframe = this.combatMode === 1;
    }
    const gs = this.nano.weapons[W.GAUNTLET].stones;
    gs.forEach((st, i) => {
      const lit = p.channel * 6 > i ? 5 : 0;
      (st.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.5 + (p.ult / 100) * 2.2 + lit + Math.sin(this.time * 6 + i) * 0.25 * (p.ult / 100);
    });

    // hit flash
    setFlash(r.mats, p.flash * 0.9, 1, 0.1, 0.1);
  }

  /** while Tony is out of the suit the empty Mark 85 hovers around Thanos and fires on its own */
  private updateCompanion(dt: number) {
    // The autonomous armor companion is disabled once the suit has shattered.
    if (this.armorDestroyed || this.status !== "playing" || !this.suit.companionReady) return;
    const p = this.pl;
    p.snd -= dt;
    if (p.snd > 0) return;
    p.snd = 1.1;
    const b = this.boss;
    if (b.state === "dead") return;
    const from = this.rig.root.position.clone().add(new THREE.Vector3(0, 1.65, 0));
    const dir = new THREE.Vector3(b.pos.x, b.pos.y + 3.7, b.pos.z).sub(from).normalize();
    const beam = new THREE.Mesh(this.boltGeo, this.boltMat);
    beam.position.copy(from);
    beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
    this.scene.add(beam);
    this.projs.push({ mesh: beam, vel: dir.multiplyScalar(78), life: 1.7, dmg: 10, owner: "p", r: 0.32, kind: "bolt", power: 0 });
    this.fx.spawn(from.x, from.y, from.z, 0, 0, 0, 0.22, 0.3, new THREE.Color(0.8, 2, 2.8));
  }

  /* ---- Nano Lightning Refocuser fins ---- */
  setCombatMode(mode: number) {
    if (this.armorDestroyed) return this.combatMode;
    this.combatMode = mode === 1 ? 1 : 0;
    const shield = this.nano.weapons[W.SHIELD].glow;
    if (shield) {
      const material = shield.material as THREE.MeshBasicMaterial;
      material.color.setHex(this.combatMode === 1 ? 0x38e8ff : 0x66dfff);
      material.wireframe = this.combatMode === 1;
    }
    window.dispatchEvent(new CustomEvent("combatmodechange", { detail: this.combatMode }));
    return this.combatMode;
  }

  toggleWings() {
    if (this.armorDestroyed) return this.wingsManual;
    this.wingsManual = !this.wingsManual;
    return this.wingsManual;
  }

  private updateWings(dt: number) {
    const p = this.pl;
    const r = this.rig;
    let target = 0.35;
    if (this.status === "lost") target = 0.1;
    else if (this.combatMode === 1) target = 1;
    else if (this.wingsManual) target = 1;
    else if (this.suit.active) target = 0.5;
    else if (this.nano.current === W.REFOCUS && this.nano.ready) target = p.absorbing ? 1 : 0.8;
    else if (this.nano.current === W.UNI && this.nano.ready && p.heat > 0) target = 1;
    else if (p.thrusting || p.pos.y > 0.5) target = 0.6;
    p.wing = damp(p.wing, target, 6, dt);
    const d = p.wing;
    const absorbing = p.absorbing && this.status === "playing";
    r.wings.forEach((f, i) => {
      const flutter = Math.sin(this.time * (absorbing ? 32 : 3) + i * 1.7) * (absorbing ? 0.035 : 0.012);
      f.pivot.rotation.z = -f.side * (f.fold + (f.open - f.fold) * d + flutter);
      f.pivot.rotation.x = -0.25 - d * 0.12;
      f.pivot.scale.set(1, 0.62 + 0.38 * d, 1);
    });
    const glow = absorbing ? 3.5 + p.refocus * 5 + Math.sin(this.time * 30) * 0.8 : 1.3 + d * 1.1 + (p.refocus > 0 ? p.refocus * 2 : 0);
    for (const gm of r.wingGlow) (gm.material as THREE.MeshStandardMaterial).emissiveIntensity = glow;

    if (absorbing) {
      // crackling lightning between the fin tips + energy streaming in
      r.root.updateMatrixWorld(true);
      const cy = new THREE.Color(0.8, 2.2, 3.2);
      const tips = r.wings.map((f) => f.pivot.localToWorld(new THREE.Vector3(0, f.len * f.pivot.scale.y, 0)));
      for (let k = 0; k < 2; k++) {
        const t = tips[Math.floor(Math.random() * tips.length)];
        this.fx.spawn(t.x, t.y, t.z, rnd(-3, 3), rnd(-2, 3), rnd(-3, 3), 0.35, 0.14, cy);
      }
      if (Math.random() < 0.35) {
        const a = tips[Math.floor(Math.random() * tips.length)];
        const b = tips[Math.floor(Math.random() * tips.length)];
        if (a !== b) {
          const mid = a.clone().lerp(b, 0.5).add(new THREE.Vector3(rnd(-0.4, 0.4), rnd(-0.4, 0.4), rnd(-0.4, 0.4)));
          this.spawnFlash(a, mid, cy, 0.03, 0.08);
          this.spawnFlash(mid, b, cy, 0.03, 0.08);
        }
      }
      if (Math.random() < 0.5) {
        const a = rnd(0, TAU);
        const wp = r.mountBack.getWorldPosition(this.tA);
        const sx = wp.x + Math.cos(a) * 3.5;
        const sy = wp.y + rnd(-1.2, 1.5);
        const sz = wp.z + Math.sin(a) * 3.5;
        this.fx.spawn(sx, sy, sz, (wp.x - sx) * 3.2, (wp.y - sy) * 3.2, (wp.z - sz) * 3.2, 0.3, 0.1, cy);
      }
    }
  }

  private setBeam(m: THREE.Mesh, from: THREE.Vector3, to: THREE.Vector3, radius: number) {
    const dir = this.tD.copy(to).sub(from);
    const len = dir.length();
    if (len < 0.01) {
      m.visible = false;
      return;
    }
    dir.divideScalar(len);
    m.position.copy(from).addScaledVector(dir, len / 2);
    m.quaternion.setFromUnitVectors(this.yAxis, dir);
    m.scale.set(radius, len, radius);
    m.visible = true;
  }

  /** Uni-Beam (chest + feet) and Thanos' stone beam: visuals + continuous damage */
  private updateBeams(dt: number) {
    const p = this.pl;
    const b = this.boss;
    const playing = this.status === "playing";

    const on = p.uniOn && playing && this.nano.current === W.UNI && this.nano.ready && !this.suit.active;
    if (!on) {
      this.uniBeam.visible = false;
    } else {
      this.rig.root.updateMatrixWorld(true);
      const wd = this.nano.weapon;
      const from = wd.muzzle.getWorldPosition(this.tA);
      const aim = this.aimTarget(false);
      const dir = this.tB.copy(aim).sub(from).normalize();
      let len = 70;
      let hit = false;
      if (b.state !== "dead" && b.state !== "roar") {
        const bc = this.tC.set(b.pos.x, b.pos.y + 3.8, b.pos.z);
        const t = bc.clone().sub(from).dot(dir);
        if (t > 0) {
          const closest = from.clone().addScaledVector(dir, t);
          if (closest.distanceTo(bc) < 3.4) {
            hit = true;
            len = Math.max(1, t - 1.2);
          }
        }
      }
      if (!hit && dir.y < -0.001) len = Math.min(len, from.y / -dir.y);
      const end = from.clone().addScaledVector(dir, len);
      const pulse = 0.17 + Math.sin(this.time * 55) * 0.035;
      this.setBeam(this.uniBeam, from, end, pulse);
      const air = p.pos.y > 0.6;
      p.uniTick -= dt;
      if (p.uniTick <= 0) {
        p.uniTick = 0.1;
        if (hit) this.damageBoss(air ? 10.5 : 7, end);
      }
      if (Math.random() < 0.8) {
        const c = new THREE.Color(1.2, 2.4, 3.2);
        this.fx.spawn(end.x, end.y, end.z, rnd(-5, 5), rnd(0, 6), rnd(-5, 5), 0.3, 0.16, c);
      }
      if (Math.random() < 0.5) this.fx.spawn(from.x, from.y, from.z, rnd(-2, 2), rnd(-2, 2), rnd(-2, 2), 0.2, 0.12, new THREE.Color(1.6, 2.6, 3.2));
    }

    // Thanos' stone beam (fire phase only)
    const firing = b.state === "beam" && b.t >= 1.1 && this.status !== "menu";
    const charging = b.state === "beam" && b.t < 1.1 && playing;
    if (firing || charging) {
      const from = this.gauntletPos(this.tA);
      const mat = this.bossBeam.material as THREE.MeshBasicMaterial;
      if (charging) {
        const to = this.tB.copy(from).addScaledVector(b.bdir, 60);
        if (b.bdir.y < -0.001) to.copy(from).addScaledVector(b.bdir, Math.min(60, from.y / -b.bdir.y));
        mat.opacity = 0.25 + Math.sin(this.time * 40) * 0.1;
        this.setBeam(this.bossBeam, from, to, 0.07);
      } else {
        mat.opacity = 0.85;
        this.setBeam(this.bossBeam, from, b.bend, 0.55 + Math.sin(this.time * 45) * 0.12);
      }
    } else {
      this.bossBeam.visible = false;
    }
  }

  private updateChargeOrb() {
    const p = this.pl;
    const o = this.chargeOrb;
    if (p.charge > 0 && this.nano.current === W.CANNON && this.nano.ready) {
      o.visible = true;
      this.muzzlePos(o.position);
      const s = 0.1 + p.charge * 0.75 + Math.sin(this.time * 40) * 0.04;
      o.scale.setScalar(s);
      if (Math.random() < 0.6) {
        const a = rnd(0, TAU);
        const c = new THREE.Color(2.4, 1.2, 0.4);
        this.fx.spawn(o.position.x + Math.cos(a) * 1.2, o.position.y + rnd(-1, 1), o.position.z + Math.sin(a) * 1.2, -Math.cos(a) * 4, 0, -Math.sin(a) * 4, 0.3, 0.1, c);
      }
    } else {
      o.visible = false;
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Camera                                                          */
  /* ---------------------------------------------------------------- */

  private updateCamera(dt: number) {
    const cam = this.camera;
    if (this.status === "menu") {
      const a = this.time * 0.12;
      cam.position.set(Math.cos(a) * 34, 6 + Math.sin(a * 1.7) * 2, -4 + Math.sin(a) * 34);
      cam.lookAt(0, 4, -4);
      cam.fov = damp(cam.fov, 62, 4, dt);
      cam.updateProjectionMatrix();
      return;
    }
    const p = this.pl;
    if (this.mark50Cinematic) {
      // Dedicated Model Prime close-up: frame Tony's Arc Reactor, not the arena.
      const behindX = -Math.sin(p.heading) * 4.25;
      const behindZ = -Math.cos(p.heading) * 4.25;
      const closePosition = this.v1.set(p.pos.x + behindX, p.pos.y + 2.05, p.pos.z + behindZ);
      const chestTarget = this.v2.set(p.pos.x, p.pos.y + 1.55, p.pos.z);
      cam.position.lerp(closePosition, 1 - Math.exp(-5.5 * dt));
      cam.lookAt(chestTarget);
      this.fov = damp(this.fov, 39, 4.5, dt);
      cam.fov = this.fov;
      cam.updateProjectionMatrix();
      return;
    }
    const dist = 8.5;
    const cp = Math.cos(this.camPitch);
    const dir = this.v1.set(Math.sin(this.camYaw) * cp, -Math.sin(this.camPitch), Math.cos(this.camYaw) * cp);
    const right = this.v2.set(-Math.cos(this.camYaw), 0, Math.sin(this.camYaw));
    const target = this.v3.set(p.pos.x, p.pos.y + 1.9, p.pos.z);
    cam.position.copy(target).addScaledVector(dir, -dist).addScaledVector(right, 0.9);
    if (cam.position.y < 0.5) cam.position.y = 0.5;
    this.shake = Math.max(0, this.shake - dt * 1.8);
    if (this.shake > 0) {
      cam.position.x += rnd(-1, 1) * this.shake * 0.45;
      cam.position.y += rnd(-1, 1) * this.shake * 0.45;
      cam.position.z += rnd(-1, 1) * this.shake * 0.45;
    }
    cam.lookAt(this.pw.copy(cam.position).addScaledVector(dir, 30));
    const tf = p.dashT > 0 ? 82 : 70;
    this.fov = damp(this.fov, tf, 10, dt);
    cam.fov = this.fov;
    cam.updateProjectionMatrix();
  }

  /* ---------------------------------------------------------------- */
  /*  Projectiles / shocks / meteors                                  */
  /* ---------------------------------------------------------------- */

  private bossDist(pt: THREE.Vector3) {
    const b = this.boss;
    const y = clamp(pt.y, b.pos.y + 1.2, b.pos.y + 6.2);
    return Math.hypot(pt.x - b.pos.x, pt.y - y, pt.z - b.pos.z);
  }

  private explode(pos: THREE.Vector3, power: number, color: THREE.Color) {
    const n = Math.floor(20 + power * 50);
    for (let i = 0; i < n; i++) {
      const s = rnd(4, 14) * (0.5 + power);
      const a = rnd(0, TAU);
      const e = rnd(-1, 1);
      this.fx.spawn(pos.x, pos.y, pos.z, Math.cos(a) * s * (1 - Math.abs(e) * 0.5), e * s, Math.sin(a) * s * (1 - Math.abs(e) * 0.5), rnd(0.4, 1.0), rnd(0.2, 0.5) * (0.6 + power), color, -4);
    }
  }

  private updateProjectiles(dt: number) {
    const p = this.pl;
    const chest = this.v3.set(p.pos.x, p.pos.y + 1.1, p.pos.z);
    for (let i = this.projs.length - 1; i >= 0; i--) {
      const pr = this.projs[i];
      const pos = pr.mesh.position;
      pos.addScaledVector(pr.vel, dt);
      pr.life -= dt;
      let remove = pr.life <= 0;

      // trail
      const big = pr.kind === "cannon" || pr.kind === "refocus";
      const tc =
        pr.owner === "p"
          ? pr.kind === "cannon"
            ? new THREE.Color(2.4, 1.2, 0.3)
            : pr.kind === "missile"
              ? new THREE.Color(2.4, 1.6, 0.8)
              : pr.kind === "refocus"
                ? new THREE.Color(1.2, 2.4, 3.2)
                : new THREE.Color(0.5, 1.4, 2.2)
          : new THREE.Color(1.6, 0.5, 2.2);
      if (pr.kind !== "bolt" || Math.random() < 0.5) this.fx.spawn(pos.x, pos.y, pos.z, rnd(-0.5, 0.5), rnd(-0.5, 0.5), rnd(-0.5, 0.5), 0.25, big ? pr.r * 0.7 : 0.14, tc);

      // homing micro-missiles curve toward Thanos
      if (pr.homing && this.boss.state !== "dead") {
        pr.age = (pr.age ?? 0) + dt;
        const bb = this.boss;
        const want = this.v1.set(bb.pos.x, bb.pos.y + 3.6, bb.pos.z).sub(pos).normalize();
        const speed = Math.min(72, 18 + pr.age * 90);
        const cur = this.v2.copy(pr.vel).normalize();
        cur.lerp(want, Math.min(1, dt * (1.5 + pr.age * 7))).normalize();
        pr.vel.copy(cur).multiplyScalar(speed);
        pr.mesh.quaternion.setFromUnitVectors(this.v4.set(0, 0, 1), cur);
      }

      // Lightning Refocus: the back fins drag hostile energy in
      if (!remove && pr.owner === "b" && p.absorbing) {
        const wp = this.rig.mountBack.getWorldPosition(this.pw);
        const d = pos.distanceTo(wp);
        if (d < 15) {
          const dir = this.v2.copy(wp).sub(pos).normalize();
          pr.vel.lerp(dir.multiplyScalar(36), Math.min(1, dt * 7));
        }
        if (d < 1.5) {
          p.refocus = Math.min(1, p.refocus + 0.22);
          p.ult = Math.min(100, p.ult + 6);
          sfx.parry();
          this.explode(pos, 0.15, new THREE.Color(0.8, 2.2, 3));
          remove = true;
        }
      }
      if (pr.kind === "orb") pr.mesh.rotation.y += dt * 5;

      if (!remove && pos.y < 0.1) {
        remove = true;
        this.explode(pos, pr.kind === "cannon" ? 0.5 : 0.1, tc);
      }

      if (!remove && pr.owner === "p") {
        const b = this.boss;
        if (b.state !== "dead" && this.bossDist(pos) < pr.r + 2.0) {
          const dead = this.damageBoss(pr.dmg, pos);
          if (pr.kind === "cannon") {
            this.explode(pos, pr.power, new THREE.Color(3, 1.6, 0.5));
            this.shake = Math.max(this.shake, 0.4 + pr.power * 0.5);
            sfx.boom();
            if (pr.power > 0.85 && !dead) this.staggerBoss(1.6);
          } else if (pr.kind === "refocus") {
            this.explode(pos, 0.4 + pr.power, new THREE.Color(1.2, 2.4, 3.2));
            this.spawnRing(pos.x, Math.max(0.3, pos.y), pos.z, new THREE.Color(0.8, 2, 3), 20, 10);
            this.shake = Math.max(this.shake, 0.4 + pr.power * 0.7);
            sfx.boom();
            if (pr.power > 0.8 && !dead) this.staggerBoss(1.8);
          } else if (pr.kind === "missile") {
            this.explode(pos, 0.25, new THREE.Color(3, 1.5, 0.5));
            this.shake = Math.max(this.shake, 0.12);
          } else {
            this.explode(pos, 0.08, new THREE.Color(0.8, 2, 2.8));
          }
          remove = true;
        }
      } else if (!remove && pr.owner === "b") {
        if (pos.distanceTo(chest) < pr.r + 0.95) {
          if (pr.kind === "orb" && p.blocking && this.nano.ready && p.blockT < 0.3 && this.isFront(p.pos, pos, p.heading, -0.15)) {
            // energy-shield PARRY: the orb is thrown straight back
            this.reflect(pr);
            p.ult = Math.min(100, p.ult + 8);
            this.shake = Math.max(this.shake, 0.3);
          } else {
            this.damagePlayer(pr.dmg, pos, "proj");
            this.explode(pos, 0.25, new THREE.Color(1.8, 0.6, 2.4));
            remove = true;
          }
        }
      }
      if (remove) {
        pr.mesh.removeFromParent();
        this.projs.splice(i, 1);
      }
    }
  }

  private spawnOrb(from: THREE.Vector3, dir: THREE.Vector3, speed: number, dmg: number) {
    const g = new THREE.Group();
    const core = new THREE.Mesh(this.sphereGeo, this.orbCore);
    const shell = new THREE.Mesh(this.sphereGeo, this.orbShell);
    shell.scale.setScalar(1.6);
    g.add(core, shell);
    g.scale.setScalar(0.75);
    g.position.copy(from);
    this.scene.add(g);
    this.projs.push({ mesh: g, vel: dir.clone().multiplyScalar(speed), life: 4, dmg, owner: "b", r: 0.75, kind: "orb", power: 0 });
  }

  private spawnShock(x: number, z: number, speed: number, dmg: number) {
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 0.6, 2.4), transparent: true, opacity: 0.8, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false });
    const m = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1.4, 56, 1, true), mat);
    m.position.set(x, 0.7, z);
    m.scale.set(1, 1, 1);
    this.scene.add(m);
    this.shocks.push({ mesh: m, r: 1, speed, hit: false, dmg });
  }

  private removeShock(s: Shock) {
    s.mesh.removeFromParent();
    s.mesh.geometry.dispose();
    (s.mesh.material as THREE.Material).dispose();
  }

  private updateShocks(dt: number) {
    const p = this.pl;
    for (let i = this.shocks.length - 1; i >= 0; i--) {
      const s = this.shocks[i];
      s.r += s.speed * dt;
      s.mesh.scale.set(s.r, 1, s.r);
      (s.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.8 * (1 - s.r / 75));
      if (!s.hit && this.status === "playing") {
        const d = Math.hypot(p.pos.x - s.mesh.position.x, p.pos.z - s.mesh.position.z);
        if (Math.abs(d - s.r) < 1.6 && p.pos.y < 1.3) {
          s.hit = true;
          if (p.absorbing && this.nano.ready) {
            // the fins swallow the shockwave
            p.refocus = Math.min(1, p.refocus + 0.34);
            p.ult = Math.min(100, p.ult + 10);
            sfx.parry();
            this.say("ดูดซับคลื่นช็อกสำเร็จ!", 1.2);
            this.explode(this.v1.set(p.pos.x, p.pos.y + 1.4, p.pos.z), 0.4, new THREE.Color(0.8, 2.2, 3));
          } else {
            this.damagePlayer(s.dmg, s.mesh.position, "wave");
          }
        }
      }
      if (s.r > 78) {
        this.removeShock(s);
        this.shocks.splice(i, 1);
      }
    }
  }

  private addMeteor(x: number, z: number) {
    const ringMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 0.35, 0.2), transparent: true, opacity: 0.8, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false });
    const ring = new THREE.Mesh(new THREE.RingGeometry(3.2, 4.2, 40), ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, 0.12, z);
    this.scene.add(ring);
    const rock = new THREE.Mesh(
      new THREE.IcosahedronGeometry(2.4, 0),
      new THREE.MeshStandardMaterial({ color: 0x3a1010, emissive: 0xff4a10, emissiveIntensity: 2.2, roughness: 0.8, flatShading: true })
    );
    rock.visible = false;
    this.scene.add(rock);
    this.meteors.push({ pos: new THREE.Vector3(x, 0, z), t: 0, ring, rock, done: false });
    sfx.warn();
  }

  private removeMeteor(m: Meteor) {
    m.ring.removeFromParent();
    m.ring.geometry.dispose();
    (m.ring.material as THREE.Material).dispose();
    m.rock.removeFromParent();
    m.rock.geometry.dispose();
    (m.rock.material as THREE.Material).dispose();
  }

  private updateMeteors(dt: number) {
    const p = this.pl;
    for (let i = this.meteors.length - 1; i >= 0; i--) {
      const m = this.meteors[i];
      m.t += dt;
      (m.ring.material as THREE.MeshBasicMaterial).opacity = 0.35 + 0.45 * Math.abs(Math.sin(m.t * 10));
      if (m.t > 1.3) {
        const u = clamp((m.t - 1.3) / 0.45, 0, 1);
        m.rock.visible = true;
        m.rock.position.set(m.pos.x, 55 * (1 - u * u) + 1.5, m.pos.z);
        m.rock.rotation.x += dt * 6;
        m.rock.rotation.z += dt * 4;
        if (u >= 1 && !m.done) {
          m.done = true;
          const hit = Math.hypot(p.pos.x - m.pos.x, p.pos.z - m.pos.z) < 4.4 && p.pos.y < 3.5;
          if (hit) this.damagePlayer(32, m.pos, "meteor");
          this.explode(this.v1.set(m.pos.x, 1, m.pos.z), 0.9, new THREE.Color(3, 1.1, 0.3));
          this.shake = Math.max(this.shake, 0.5);
          sfx.boom();
          this.removeMeteor(m);
          this.meteors.splice(i, 1);
        }
      }
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Boss                                                            */
  /* ---------------------------------------------------------------- */

  private bossAuthority = true;
  setBossAuthority(authority: boolean) { this.bossAuthority = authority; }
  getBossNetworkState(): BossNetworkState {
    const b = this.boss;
    return { x:b.pos.x,y:b.pos.y,z:b.pos.z,yaw:b.yaw,hp:b.hp,phase:b.phase,state:b.state,t:b.t,walk:b.walk,flash:b.flash,think:b.think,did:b.did,updatedAt:Date.now() };
  }
  applyBossNetworkState(s: BossNetworkState) {
    if (this.bossAuthority) return;
    const b = this.boss;
    b.pos.set(s.x,s.y,s.z); b.yaw=s.yaw; b.hp=s.hp; b.phase=s.phase;
    b.state=s.state as typeof b.state; b.t=s.t; b.walk=s.walk; b.flash=s.flash;
    b.think=s.think; b.did=s.did;
    this.updateBossPose(0.05);
    this.emitHud(false);
  }

  private damageBoss(amount: number, point: THREE.Vector3, noUlt = false): boolean {
    const b = this.boss;
    if (this.status !== "playing") return false;
    if (b.state === "dead" || b.state === "roar") return false;
    b.hp -= amount;
    if (!noUlt) this.pl.ult = Math.min(100, this.pl.ult + amount * 0.06);
    b.flash = 1;
    this.hitCount++;
    sfx.hit();
    const c = new THREE.Color(2.2, 1.8, 2.8);
    for (let i = 0; i < 4; i++) this.fx.spawn(point.x, point.y, point.z, rnd(-5, 5), rnd(-1, 6), rnd(-5, 5), 0.3, 0.16, c);
    if (this.bossAuthority && b.hp <= 0) {
      b.hp = 0;
      b.state = "dead";
      b.t = 0;
      b.dustT = 0;
      for (const pr of this.projs) if (pr.owner === "b") pr.mesh.removeFromParent();
      this.projs = this.projs.filter((x) => x.owner !== "b");
      for (const m of this.meteors) this.removeMeteor(m);
      this.meteors = [];
      sfx.roar();
      this.shake = 1;
      return true;
    }
    if (this.bossAuthority && b.phase === 1 && b.hp <= BOSS_MAX * 0.5) {
      b.phase = 2;
      b.state = "roar";
      b.t = 0;
      b.did = 0;
      b.pos.y = 0;
      for (const pr of this.projs) if (pr.owner === "b") pr.mesh.removeFromParent();
      this.projs = this.projs.filter((x) => x.owner !== "b");
      for (const m of this.meteors) this.removeMeteor(m);
      this.meteors = [];
      sfx.roar();
    }
    return false;
  }

  private staggerBoss(t: number) {
    const b = this.boss;
    if (b.state === "idle" || b.state === "punch" || b.state === "orbs" || b.state === "meteor" || b.state === "rush" || b.state === "beam" || b.state === "stagger") {
      b.state = "stagger";
      b.t = 0;
      b.staggerT = t;
      b.lunge = 0;
    }
  }

  private updateBossIdleOnly(dt: number) {
    this.boss.walk += dt;
    this.bpose.lean = Math.sin(this.time * 1.5) * 0.02;
  }

  private bossForward(out: THREE.Vector3) {
    return out.set(Math.sin(this.boss.yaw), 0, Math.cos(this.boss.yaw));
  }

  private turnBoss(dt: number, rate: number) {
    const b = this.boss;
    const p = this.pl;
    const want = Math.atan2(p.pos.x - b.pos.x, p.pos.z - b.pos.z);
    const d = angDiff(b.yaw, want);
    b.yaw += clamp(d, -rate * dt, rate * dt);
  }

  private gauntletPos(out: THREE.Vector3) {
    this.brig.root.updateMatrixWorld(true);
    return this.brig.muzzle.getWorldPosition(out);
  }

  private chooseAttack(dist: number) {
    const b = this.boss;
    const p2 = b.phase === 2;
    const r = Math.random();
    let a: string;
    if (dist < 9) {
      if (r < 0.45) a = "punch";
      else if (r < 0.72) a = "slam";
      else if (p2 && r < 0.9) a = "rush";
      else a = "punch";
    } else {
      if (r < 0.28) a = "orbs";
      else if (r < 0.5) a = "slam";
      else if (r < 0.72) a = "beam";
      else if (p2 && r < 0.88) a = "meteor";
      else if (p2) a = "rush";
      else a = "orbs";
    }
    if (a === b.last && Math.random() < 0.7) a = a === "orbs" ? "slam" : "orbs";
    b.last = a;
    b.state = a as BossState;
    b.t = 0;
    b.did = 0;
  }

  private updateBoss(dt: number) {
    const b = this.boss;
    const p = this.pl;
    b.flash = Math.max(0, b.flash - dt * 4);
    b.t += dt;
    const dx = p.pos.x - b.pos.x;
    const dz = p.pos.z - b.pos.z;
    const dist = Math.hypot(dx, dz);
    const bp = this.bpose;
    const p2 = b.phase === 2;
    const live = this.status === "playing";

    // defaults (smoothly applied in updateBossPose)
    bp.shR = 0.05;
    bp.elR = -0.2;
    bp.shL = 0.05;
    bp.elL = -0.2;
    bp.lean = 0;
    bp.crouch = 0;
    bp.headX = 0;
    bp.fall = 0;

    // lunge motion (punch)
    if (b.lunge > 0) {
      b.lunge -= dt;
      const f = this.bossForward(this.v1);
      b.pos.x += f.x * 18 * dt;
      b.pos.z += f.z * 18 * dt;
    }

    switch (b.state) {
      case "idle": {
        if (!live) break;
        this.turnBoss(dt, 3);
        const sp = p2 ? 7.5 : 5.2;
        if (dist > 5.5) {
          const f = this.bossForward(this.v1);
          b.pos.x += f.x * sp * dt;
          b.pos.z += f.z * sp * dt;
          b.walk += dt * sp * 1.25;
        } else {
          b.walk *= 0.98;
        }
        bp.lean = dist > 5.5 ? 0.12 : 0;
        bp.shR = Math.sin(b.walk) * 0.35;
        bp.shL = -Math.sin(b.walk) * 0.35;
        b.think -= dt;
        if (b.think <= 0) this.chooseAttack(dist);
        break;
      }
      case "punch": {
        if (b.t < 0.85) {
          this.turnBoss(dt, 2.2);
          bp.shR = -2.6;
          bp.elR = -0.6;
          bp.lean = -0.2;
          bp.crouch = 0.1;
          if (b.t > 0.55 && Math.random() < 0.5) {
            const c = new THREE.Color(2.4, 1.0, 0.3);
            this.fx.spawn(b.pos.x + rnd(-1, 1), b.pos.y + 5.5, b.pos.z + rnd(-1, 1), 0, 2, 0, 0.3, 0.2, c);
          }
        } else {
          bp.shR = -1.5;
          bp.elR = 0;
          bp.lean = 0.35;
          if (!b.did) {
            b.did = 1;
            b.lunge = 0.14;
            sfx.slash();
            const reach = Math.hypot(dx, dz);
            if (reach < 8.2 && this.isFront(b.pos, p.pos, b.yaw, 0.2) && p.pos.y < 7) {
              this.damagePlayer(p2 ? 34 : 28, b.pos, "melee");
            }
            this.shake = Math.max(this.shake, 0.2);
          }
        }
        if (b.t > 1.5) this.endAttack(0.9);
        break;
      }
      case "slam": {
        if (b.t < 0.7) {
          this.turnBoss(dt, 3);
          bp.shR = -2.8;
          bp.shL = -2.8;
          bp.elR = -0.3;
          bp.elL = -0.3;
          bp.crouch = 0.35 * Math.min(1, b.t / 0.5);
          b.from.copy(b.pos);
          const target = this.v1.set(p.pos.x, 0, p.pos.z);
          const dv = this.v2.copy(target).sub(b.pos);
          const l = dv.length();
          if (l > 28) dv.multiplyScalar(28 / l);
          b.to.copy(b.pos).add(dv);
          // stop short so we don't land inside the player
          const dl = dv.length();
          if (dl > 3) b.to.addScaledVector(dv.normalize(), -2.5);
        } else if (b.t < 1.6) {
          const u = (b.t - 0.7) / 0.9;
          b.pos.lerpVectors(b.from, b.to, u);
          b.pos.y = 13 * 4 * u * (1 - u);
          bp.shR = -3.0;
          bp.shL = -3.0;
          bp.lean = -0.1;
          if (u > 0.6) {
            bp.shR = -1.0;
            bp.shL = -1.0;
            bp.lean = 0.3;
          }
        } else {
          if (!b.did) {
            b.did = 1;
            b.pos.copy(b.to);
            b.pos.y = 0;
            this.spawnShock(b.pos.x, b.pos.z, p2 ? 28 : 24, p2 ? 36 : 30);
            if (Math.hypot(dx, dz) < 4.5 && p.pos.y < 2) this.damagePlayer(36, b.pos, "wave");
            this.shake = 1;
            sfx.boom();
            this.explode(this.v1.set(b.pos.x, 0.5, b.pos.z), 1, new THREE.Color(1.8, 0.8, 2.4));
          }
          bp.crouch = 0.4;
          bp.shR = -0.3;
          bp.shL = -0.3;
        }
        if (b.t > 2.6) this.endAttack(0.8);
        break;
      }
      case "orbs": {
        this.turnBoss(dt, 4.5);
        const n = p2 ? 5 : 3;
        bp.shL = -1.55;
        bp.elL = -0.05;
        bp.shR = 0.2;
        bp.lean = -0.1;
        if (b.t > 0.7 + b.did * 0.32 && b.did < n) {
          b.did++;
          const from = this.gauntletPos(new THREE.Vector3());
          const aim = new THREE.Vector3(p.pos.x + p.vel.x * 0.25, p.pos.y + 1.1, p.pos.z + p.vel.z * 0.25);
          const dir = aim.sub(from).normalize();
          if (p2) {
            dir.x += rnd(-0.07, 0.07);
            dir.z += rnd(-0.07, 0.07);
            dir.normalize();
          }
          this.spawnOrb(from, dir, 26, 18);
          sfx.shoot();
          const c = new THREE.Color(1.8, 0.6, 2.4);
          for (let i = 0; i < 10; i++) this.fx.spawn(from.x, from.y, from.z, rnd(-4, 4), rnd(-4, 4), rnd(-4, 4), 0.3, 0.2, c);
        }
        if (b.t < 0.7 && Math.random() < 0.6) {
          const g = this.gauntletPos(this.v1);
          this.fx.spawn(g.x + rnd(-1, 1), g.y + rnd(-1, 1), g.z + rnd(-1, 1), 0, 0, 0, 0.3, 0.2, new THREE.Color(1.8, 0.6, 2.4));
        }
        if (b.t > 0.7 + n * 0.32 + 0.6) this.endAttack(0.8);
        break;
      }
      case "meteor": {
        bp.shL = -2.9;
        bp.shR = -2.9;
        bp.elL = -0.2;
        bp.elR = -0.2;
        bp.lean = -0.25;
        if (b.t > 0.9 && b.t < 3.0 && b.t > 0.9 + b.did * 0.32) {
          b.did++;
          const ox = b.did % 3 === 0 ? 0 : rnd(-9, 9);
          const oz = b.did % 3 === 0 ? 0 : rnd(-9, 9);
          let mx = p.pos.x + ox;
          let mz = p.pos.z + oz;
          const rr = Math.hypot(mx, mz);
          if (rr > ARENA_R - 4) {
            mx *= (ARENA_R - 4) / rr;
            mz *= (ARENA_R - 4) / rr;
          }
          this.addMeteor(mx, mz);
        }
        if (b.t > 4.0) this.endAttack(0.6);
        break;
      }
      case "rush": {
        if (b.t < 0.9) {
          this.turnBoss(dt, 5);
          bp.lean = 0.5;
          bp.crouch = 0.35;
          bp.shR = 0.8;
          bp.shL = 0.8;
          b.dir.set(Math.sin(b.yaw), 0, Math.cos(b.yaw));
          if (Math.random() < 0.5) this.fx.spawn(b.pos.x + rnd(-1.5, 1.5), 0.2, b.pos.z + rnd(-1.5, 1.5), 0, 1.5, 0, 0.5, 0.3, new THREE.Color(1.5, 0.7, 2.0));
        } else if (b.t < 1.7) {
          bp.lean = 0.7;
          bp.shR = 1.0;
          bp.shL = 1.0;
          b.pos.addScaledVector(b.dir, 34 * dt);
          const rr = Math.hypot(b.pos.x, b.pos.z);
          if (rr > ARENA_R - 3) {
            b.pos.x *= (ARENA_R - 3) / rr;
            b.pos.z *= (ARENA_R - 3) / rr;
          }
          b.walk += dt * 30;
          if (Math.random() < 0.8) this.fx.spawn(b.pos.x + rnd(-1.5, 1.5), 0.3, b.pos.z + rnd(-1.5, 1.5), rnd(-3, 3), rnd(1, 4), rnd(-3, 3), 0.5, 0.35, new THREE.Color(1.5, 0.7, 2.0));
          if (!b.did && Math.hypot(dx, dz) < 4.6 && p.pos.y < 7) {
            b.did = 1;
            this.damagePlayer(p2 ? 38 : 32, b.pos, "melee");
          }
        } else {
          bp.lean = 0.35;
          bp.crouch = 0.15;
        }
        if (b.t > 2.6) this.endAttack(0.5);
        break;
      }
      case "beam": {
        // Infinity-stone beam: charge (telegraph) → sustained beam that slowly tracks the player
        bp.shL = -1.55;
        bp.elL = -0.05;
        bp.shR = 0.2;
        bp.lean = -0.12;
        const g = this.gauntletPos(this.v1);
        const aim = this.v2.set(p.pos.x, p.pos.y + 1.1, p.pos.z).sub(g).normalize();
        if (b.t < 1.1) {
          this.turnBoss(dt, 3.5);
          b.bdir.lerp(aim, Math.min(1, dt * 6)).normalize();
          b.btick = 0.15;
          if (Math.random() < 0.8) this.fx.spawn(g.x + rnd(-1.2, 1.2), g.y + rnd(-1.2, 1.2), g.z + rnd(-1.2, 1.2), 0, 0, 0, 0.3, 0.22, new THREE.Color(2.2, 0.8, 3));
        } else if (b.t < 2.7) {
          this.turnBoss(dt, 1.0);
          b.bdir.lerp(aim, Math.min(1, dt * 1.1)).normalize();
          let len = 75;
          if (b.bdir.y < -0.001) len = Math.min(len, g.y / -b.bdir.y);
          b.bend.copy(g).addScaledVector(b.bdir, len);
          if (live) {
            const chestP = this.v3.set(p.pos.x, p.pos.y + 1.1, p.pos.z);
            const seg = this.tC.copy(b.bend).sub(g);
            const L2 = Math.max(0.0001, seg.lengthSq());
            const tt = clamp(chestP.clone().sub(g).dot(seg) / L2, 0, 1);
            const closest = g.clone().addScaledVector(seg, tt);
            if (closest.distanceTo(chestP) < 1.8) {
              if (p.absorbing && this.nano.ready && !this.suit.active) {
                // Lightning Refocus drinks the beam
                p.refocus = Math.min(1, p.refocus + dt * 0.75);
                p.ult = Math.min(100, p.ult + dt * 8);
                this.rig.mountBack.getWorldPosition(b.bend);
                if (Math.random() < 0.7) this.fx.spawn(b.bend.x + rnd(-0.5, 0.5), b.bend.y + rnd(-0.5, 0.5), b.bend.z + rnd(-0.5, 0.5), rnd(-4, 4), rnd(-2, 4), rnd(-4, 4), 0.3, 0.16, new THREE.Color(1, 2.4, 3.2));
              } else {
                b.btick -= dt;
                if (b.btick <= 0) {
                  b.btick = 0.3;
                  this.damagePlayer(p2 ? 20 : 16, g, "proj");
                }
              }
            }
          }
          if (Math.random() < 0.8) this.fx.spawn(b.bend.x + rnd(-1, 1), Math.max(0.2, b.bend.y), b.bend.z + rnd(-1, 1), rnd(-4, 4), rnd(1, 6), rnd(-4, 4), 0.5, 0.3, new THREE.Color(2, 0.8, 2.8), -6);
          if (Math.random() < 0.5) this.shake = Math.max(this.shake, 0.1);
        } else {
          this.endAttack(0.8);
        }
        break;
      }
      case "stagger": {
        bp.lean = -0.35;
        bp.headX = -0.4;
        bp.shR = 0.5;
        bp.shL = 0.5;
        bp.crouch = 0.2;
        if (b.t > b.staggerT) this.endAttack(0.4);
        break;
      }
      case "roar": {
        bp.lean = -0.3;
        bp.shR = -0.9 + Math.sin(b.t * 12) * 0.06;
        bp.shL = -0.9 + Math.sin(b.t * 12) * 0.06;
        bp.elR = -0.4;
        bp.elL = -0.4;
        bp.headX = -0.5;
        if (b.t > 0.5 && b.did === 0) {
          b.did = 1;
          this.spawnShock(b.pos.x, b.pos.z, 30, 22);
          this.shake = 1;
          sfx.boom();
          this.explode(this.v1.set(b.pos.x, 1, b.pos.z), 1, new THREE.Color(1.8, 0.8, 2.4));
        }
        if (b.t > 2.4) this.endAttack(0.6);
        break;
      }
      case "dead": {
        bp.fall = Math.min(1, b.t / 2.0);
        bp.crouch = Math.min(0.5, b.t * 0.3);
        bp.shR = 0.4;
        bp.shL = 0.4;
        bp.lean = -0.4 * Math.min(1, b.t);
        if (b.t > 1.6 && this.brig.root.visible) {
          const u = clamp((b.t - 1.6) / 1.6, 0, 1);
          const c = new THREE.Color(1.3, 0.8, 1.7);
          for (let i = 0; i < 14; i++) {
            this.fx.spawn(b.pos.x + rnd(-2, 2), 0.5 + Math.random() * 7 * (1 - u * 0.4), b.pos.z + rnd(-2, 2), rnd(-2, 2), rnd(0.5, 4), rnd(-2, 2), rnd(1.5, 3), rnd(0.2, 0.45), c);
          }
        }
        if (b.t > 3.2 && this.brig.root.visible) {
          this.brig.root.visible = false;
          sfx.boom();
        }
        if (b.t > 4.6 && this.status === "playing") {
          this.status = "won";
          if (document.pointerLockElement === this.canvas) document.exitPointerLock();
          this.mouseDown = false;
          this.emitHud(true);
        }
        break;
      }
    }

    // keep boss inside the arena
    const rr = Math.hypot(b.pos.x, b.pos.z);
    if (rr > ARENA_R - 3) {
      b.pos.x *= (ARENA_R - 3) / rr;
      b.pos.z *= (ARENA_R - 3) / rr;
    }
  }

  private endAttack(think: number) {
    const b = this.boss;
    b.state = "idle";
    b.t = 0;
    b.did = 0;
    b.think = b.phase === 2 ? think * 0.55 : think;
    b.pos.y = 0;
  }

  /* ---------------------------------------------------------------- */
  /*  Boss pose                                                       */
  /* ---------------------------------------------------------------- */

  private updateBossPose(dt: number) {
    const b = this.boss;
    const r = this.brig;
    const bp = this.bpose;
    const ps = this.pose;
    r.root.position.copy(b.pos);
    r.root.rotation.y = b.yaw;
    ps.shR = damp(ps.shR, bp.shR, 9, dt);
    ps.elR = damp(ps.elR, bp.elR, 9, dt);
    ps.shL = damp(ps.shL, bp.shL, 9, dt);
    ps.elL = damp(ps.elL, bp.elL, 9, dt);
    ps.lean = damp(ps.lean, bp.lean, 7, dt);
    ps.crouch = damp(ps.crouch, bp.crouch, 9, dt);
    ps.headX = damp(ps.headX, bp.headX, 8, dt);
    ps.fall = damp(ps.fall, bp.fall, 4, dt);

    r.shR.rotation.x = ps.shR;
    r.elR.rotation.x = ps.elR;
    r.shL.rotation.x = ps.shL;
    r.elL.rotation.x = ps.elL;
    r.body.rotation.x = ps.lean + ps.fall * -0.9 + Math.sin(this.time * 1.6) * 0.012;
    r.body.position.y = 1.0 - ps.crouch * 0.4 - ps.fall * 0.3;
    r.head.rotation.x = ps.headX;

    const sw = Math.sin(b.walk) * (b.state === "idle" || b.state === "rush" ? 0.6 : 0.05);
    const cr = ps.crouch * 1.6;
    r.hipR.rotation.x = sw - cr * 0.5;
    r.hipL.rotation.x = -sw - cr * 0.5;
    r.kneeR.rotation.x = Math.max(0, -sw) * 0.8 + cr;
    r.kneeL.rotation.x = Math.max(0, sw) * 0.8 + cr;

    // infinity stones pulse
    const pulse = (b.phase === 2 ? 5 : 3) + Math.sin(this.time * (b.phase === 2 ? 8 : 4)) * 1.2;
    for (const s of r.stones) (s.material as THREE.MeshStandardMaterial).emissiveIntensity = pulse;

    setFlash(r.mats, b.flash * 0.55, 1, 0.9, 1);
    if (b.phase === 2) {
      // subtle rage glow on eyes handled by stones pulsing; tint skin slightly
      const base = b.state === "roar" ? 0.18 + Math.sin(b.t * 20) * 0.08 : 0.04;
      if (b.flash < 0.01) setFlash(r.mats, base, 1, 0.1, 0.3);
    }
  }

  private pose = { shR: 0, elR: -0.2, shL: 0, elL: -0.2, lean: 0, crouch: 0, headX: 0, fall: 0 };
}
