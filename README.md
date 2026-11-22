# Iron Man MK-51 vs Thanos — 3D Boss Fight

A browser-based 3D boss battle built with React, TypeScript, Vite, and Three.js.

## Play
The repository includes a GitHub Actions workflow that builds the project and deploys it to GitHub Pages whenever changes are pushed to `main`. After the first successful deployment, use the Pages link shown in the Actions deployment.

## Controls
- **W / A / S / D** — move
- **Mouse** — aim / rotate camera
- **Left click** — attack
- **Space** — jump / hold to fly
- **Shift** — dash
- **1–4, Q / E, mouse wheel** — switch nano weapons
- **R** — repair armor
- **P / Esc** — pause

## Source
The complete original Vite project, including its lockfile, is bundled in `game-source.tar.xz`. The deployment workflow extracts the project, installs dependencies, builds the single-file web game, and publishes the `dist` output to GitHub Pages.

## Run locally
Extract `game-source.tar.xz`, then run:
```bash
npm ci
npm run dev
```
To build:
```bash
npm run build
```
