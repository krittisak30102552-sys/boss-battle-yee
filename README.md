# Iron Man MK-51 vs Thanos — 3D Boss Fight

A browser-based 3D boss battle built with React, TypeScript, Vite, and Three.js.

## Play

The project is configured to build and deploy to GitHub Pages using GitHub Actions. After the first successful deployment, open the repository's **Settings → Pages** or the Actions deployment link to launch the game.

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

The original Vite project is bundled in `game-source.tar.gz`. The deployment workflow extracts it, installs the locked dependencies, builds the single-file web game, and publishes the `dist` output to GitHub Pages.

## Run locally

Extract `game-source.tar.gz`, then run:

```bash
npm ci
npm run dev
```

To build locally:

```bash
npm run build
```
