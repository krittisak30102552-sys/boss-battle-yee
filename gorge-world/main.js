import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { Octree } from "three/addons/math/Octree.js";
import { Capsule } from "three/addons/math/Capsule.js";

const canvas = document.querySelector("#game-canvas");
const statusText = document.querySelector("#status-text");
const loadingMessage = document.querySelector("#loading-message");
const loadingBar = document.querySelector("#loading-bar");
const welcome = document.querySelector("#welcome");
const startButton = document.querySelector("#start-button");
const mapError = document.querySelector("#map-error");

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9eb4ad);
scene.fog = new THREE.Fog(0x9eb4ad, 70, 190);

const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.08, 350);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

scene.add(new THREE.HemisphereLight(0xdceee8, 0x53645c, 2.0));
const sun = new THREE.DirectionalLight(0xfff3dd, 2.1);
sun.position.set(-35, 55, 25);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -90;
sun.shadow.camera.right = 90;
sun.shadow.camera.top = 90;
sun.shadow.camera.bottom = -90;
scene.add(sun);

const worldOctree = new Octree();
let mapReady = false;
let isPlaying = false;
let mapRoot = null;

const player = {
  foot: new THREE.Vector3(0, -2.8, 0),
  velocity: new THREE.Vector3(),
  onFloor: false,
  radius: 0.28,
  height: 1.58
};
const collider = new Capsule(
  new THREE.Vector3(0, player.foot.y + player.radius, 0),
  new THREE.Vector3(0, player.foot.y + player.height - player.radius, 0),
  player.radius
);

const avatar = new THREE.Group();
const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0x315d50, roughness: 0.82 });
const accentMaterial = new THREE.MeshStandardMaterial({ color: 0xd1e8d9, roughness: 0.72 });
const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.25, 0.66, 5, 10), bodyMaterial);
body.position.y = 0.77;
body.castShadow = true;
avatar.add(body);
const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 16, 12), accentMaterial);
head.position.y = 1.38;
head.castShadow = true;
avatar.add(head);
const leftArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.45, 4, 8), bodyMaterial);
leftArm.position.set(-0.31, 0.86, 0);
leftArm.rotation.z = -0.12;
avatar.add(leftArm);
const rightArm = leftArm.clone();
rightArm.position.x = 0.31;
rightArm.rotation.z = 0.12;
avatar.add(rightArm);
scene.add(avatar);

const keys = Object.create(null);
const input = { x: 0, y: 0 };
const clock = new THREE.Clock();
const cameraTarget = new THREE.Vector3();
const cameraDesired = new THREE.Vector3();
const forward = new THREE.Vector3();
const right = new THREE.Vector3();
const wishDirection = new THREE.Vector3();
let cameraYaw = 0;
let cameraPitch = 0.24;
let cameraDistance = 5.4;
let dragging = false;
let previousPointer = { x: 0, y: 0 };

function setStatus(message) {
  statusText.textContent = message;
}
function updateCamera(delta) {
  cameraTarget.copy(player.foot).add(new THREE.Vector3(0, 1.13, 0));
  const horizontal = Math.cos(cameraPitch) * cameraDistance;
  cameraDesired.set(
    cameraTarget.x + Math.sin(cameraYaw) * horizontal,
    cameraTarget.y + Math.sin(cameraPitch) * cameraDistance,
    cameraTarget.z + Math.cos(cameraYaw) * horizontal
  );
  camera.position.lerp(cameraDesired, 1 - Math.exp(-8 * delta));
  camera.lookAt(cameraTarget);
}
function syncAvatar() {
  avatar.position.copy(player.foot);
}
function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
}
window.addEventListener("resize", onResize);

function loadMap() {
  setStatus("กำลังโหลดแผนที่");
  loadingMessage.textContent = "กำลังอ่าน gorge.glb…";
  const loader = new GLTFLoader();
  loader.load(
    "./assets/gorge.glb",
    (gltf) => {
      mapRoot = gltf.scene;
      mapRoot.updateMatrixWorld(true);
      mapRoot.traverse((object) => {
        if (object.isMesh) {
          object.receiveShadow = true;
          object.castShadow = false;
        }
      });
      scene.add(mapRoot);
      worldOctree.fromGraphNode(mapRoot);
      mapReady = true;
      startButton.disabled = false;
      startButton.textContent = "เริ่มเดินสำรวจ";
      loadingBar.style.width = "100%";
      loadingMessage.textContent = "โหลดแผนที่สำเร็จ พร้อมออกสำรวจ";
      setStatus("แผนที่พร้อมแล้ว");
      mapError.hidden = true;
      const bounds = new THREE.Box3().setFromObject(mapRoot);
      console.info("[Gorge Explorer] map bounds:", bounds.min.toArray(), bounds.max.toArray());
    },
    (event) => {
      if (event.total > 0) {
        const percent = Math.min(99, Math.round((event.loaded / event.total) * 100));
        loadingBar.style.width = percent + "%";
        loadingMessage.textContent = "กำลังโหลดแผนที่ " + percent + "%";
      }
    },
    (error) => {
      console.error("[Gorge Explorer] map load failed:", error);
      setStatus("ยังไม่พบไฟล์แผนที่");
      loadingMessage.textContent = "ยังไม่มีไฟล์ assets/gorge.glb ใน Repository";
      startButton.disabled = true;
      startButton.textContent = "รอไฟล์แผนที่";
      mapError.hidden = false;
    }
  );
}

startButton.addEventListener("click", () => {
  if (!mapReady) return;
  welcome.hidden = true;
  isPlaying = true;
  setStatus("กำลังสำรวจ");
  canvas.focus?.();
});

function handleKey(event, pressed) {
  const movementKeys = ["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"];
  if (movementKeys.includes(event.code)) event.preventDefault();
  keys[event.code] = pressed;
  if (pressed && event.code === "Space" && isPlaying && player.onFloor) {
    player.velocity.y = 6.6;
    player.onFloor = false;
  }
}
window.addEventListener("keydown", (event) => handleKey(event, true), { passive: false });
window.addEventListener("keyup", (event) => handleKey(event, false));
window.addEventListener("blur", () => {
  for (const key of Object.keys(keys)) keys[key] = false;
  input.x = 0;
  input.y = 0;
});

canvas.addEventListener("pointerdown", (event) => {
  if (!isPlaying || event.pointerType === "touch") return;
  dragging = true;
  previousPointer = { x: event.clientX, y: event.clientY };
  canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener("pointermove", (event) => {
  if (!dragging) return;
  const dx = event.clientX - previousPointer.x;
  const dy = event.clientY - previousPointer.y;
  previousPointer = { x: event.clientX, y: event.clientY };
  cameraYaw -= dx * 0.0045;
  cameraPitch = THREE.MathUtils.clamp(cameraPitch + dy * 0.0035, -0.12, 0.95);
});
function stopDrag() { dragging = false; }
canvas.addEventListener("pointerup", stopDrag);
canvas.addEventListener("pointercancel", stopDrag);
canvas.addEventListener("wheel", (event) => {
  cameraDistance = THREE.MathUtils.clamp(cameraDistance + event.deltaY * 0.004, 3.1, 9.5);
}, { passive: true });

const stickZone = document.querySelector("#stick-zone");
const stickKnob = document.querySelector("#stick-knob");
let stickPointer = null;
function moveStick(event) {
  const rect = stickZone.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const max = rect.width * 0.34;
  const dx = event.clientX - centerX;
  const dy = event.clientY - centerY;
  const length = Math.max(1, Math.hypot(dx, dy));
  const scale = Math.min(1, max / length);
  const px = dx * scale;
  const py = dy * scale;
  stickKnob.style.transform = "translate(" + px + "px," + py + "px)";
  input.x = px / max;
  input.y = py / max;
}
stickZone.addEventListener("pointerdown", (event) => {
  stickPointer = event.pointerId;
  stickZone.setPointerCapture(stickPointer);
  moveStick(event);
});
stickZone.addEventListener("pointermove", (event) => {
  if (event.pointerId === stickPointer) moveStick(event);
});
function releaseStick(event) {
  if (event.pointerId !== stickPointer) return;
  stickPointer = null;
  input.x = 0;
  input.y = 0;
  stickKnob.style.transform = "translate(0,0)";
}
stickZone.addEventListener("pointerup", releaseStick);
stickZone.addEventListener("pointercancel", releaseStick);
document.querySelector("#jump-button").addEventListener("pointerdown", (event) => {
  event.preventDefault();
  if (isPlaying && player.onFloor) {
    player.velocity.y = 6.6;
    player.onFloor = false;
  }
});

function updatePlayer(delta) {
  if (!isPlaying || !mapReady) return;
  const forwardAmount = Number(keys.KeyW || keys.ArrowUp) - Number(keys.KeyS || keys.ArrowDown) - input.y;
  const sideAmount = Number(keys.KeyD || keys.ArrowRight) - Number(keys.KeyA || keys.ArrowLeft) + input.x;
  forward.set(-Math.sin(cameraYaw), 0, -Math.cos(cameraYaw));
  right.set(Math.cos(cameraYaw), 0, -Math.sin(cameraYaw));
  wishDirection.set(0, 0, 0)
    .addScaledVector(forward, forwardAmount)
    .addScaledVector(right, sideAmount);
  if (wishDirection.lengthSq() > 1) wishDirection.normalize();
  const speed = keys.ShiftLeft || keys.ShiftRight ? 6.2 : 4.3;
  player.velocity.x = THREE.MathUtils.damp(player.velocity.x, wishDirection.x * speed, 12, delta);
  player.velocity.z = THREE.MathUtils.damp(player.velocity.z, wishDirection.z * speed, 12, delta);
  player.velocity.y -= 18 * delta;

  collider.translate(player.velocity.clone().multiplyScalar(delta));
  const result = worldOctree.capsuleIntersect(collider);
  player.onFloor = false;
  if (result) {
    collider.translate(result.normal.clone().multiplyScalar(result.depth));
    if (result.normal.y > 0.55) {
      player.onFloor = true;
      if (player.velocity.y < 0) player.velocity.y = 0;
    } else {
      player.velocity.addScaledVector(result.normal, -result.normal.dot(player.velocity));
    }
  }

  player.foot.set(collider.start.x, collider.start.y - player.radius, collider.start.z);
  syncAvatar();
  if (wishDirection.lengthSq() > 0.01) {
    avatar.rotation.y = Math.atan2(-wishDirection.x, -wishDirection.z);
  }
  if (player.foot.y < -80) {
    player.foot.set(0, -2.8, 0);
    collider.start.set(0, player.foot.y + player.radius, 0);
    collider.end.set(0, player.foot.y + player.height - player.radius, 0);
    player.velocity.set(0, 0, 0);
  }
}

function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.05);
  updatePlayer(delta);
  updateCamera(delta);
  renderer.render(scene, camera);
}
syncAvatar();
loadMap();
animate();
