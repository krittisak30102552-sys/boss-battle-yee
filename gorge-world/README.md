# Gorge — Third Person Explorer

A small standalone Three.js scene for walking around the supplied Gorge GLB map.

## Map asset

Place the original map file here:

`gorge-world/assets/gorge.glb`

The file is intentionally not replaced with a placeholder model. The page will show a clear missing-file message until the real GLB is present.

## Controls

- **W / A / S / D** — walk
- **Mouse drag** — orbit the third-person camera
- **Mouse wheel** — zoom
- **Space** — jump
- **Shift** — move faster
- **Touch devices** — on-screen joystick and jump button; drag the scene to rotate the camera

The map is loaded with GLTFLoader and static collision is generated with Three.js Octree.