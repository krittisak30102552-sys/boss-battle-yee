# Iron Man MK-51 vs Thanos — 3D Boss Fight

A browser-based 3D boss battle built with React, TypeScript, Vite, and Three.js.

## Play online

The GitHub Actions workflow builds the game and publishes it to GitHub Pages whenever a change is pushed to `main`. Once the first deployment succeeds, the game is available at:

https://krittisak30102552-sys.github.io/boss-battle-yee/

## Controls

- **W / A / S / D** — move
- **Mouse** — aim / rotate camera
- **Left click** — attack
- **Space** — jump / hold to fly
- **Shift** — dash
- **1–4, Q / E, mouse wheel** — switch nano weapons
- **R** — repair armor
- **P / Esc** — pause

## Run locally

The complete original Vite source and lockfile are stored in the repository as compressed base64 segments under `.upload-source/`. The deployment workflow reconstructs the archive and extracts the project before building.

After extracting the source archive, run:

```bash
npm ci
npm run dev
```

To build:

```bash
npm run build
```
