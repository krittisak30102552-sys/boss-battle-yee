# Iron Man Mark 85 vs Thanos — 3D Boss Fight

A browser-based 3D boss battle built with React, TypeScript, Vite, and Three.js.

## Play online

The GitHub Actions workflow builds the maintained project in `game/` and publishes it to GitHub Pages whenever code is pushed to `main`.

https://krittisak30102552-sys.github.io/boss-battle-yee/

## Controls

- **W / A / S / D** — move
- **Mouse** — aim and rotate the camera
- **Left click** — use the selected weapon
- **Space** — jump / hold to fly
- **Shift** — dash
- **1–9, 0, G / Q / E / mouse wheel** — select or cycle skills
- **V** — enter or leave Form 2; the suit wings unfold automatically
- **B** — manually unfold / fold the wings
- **R** — remove or reassemble the Mark 85 suit
- **T** — repair armor
- **P / Esc** — pause

## Run locally

```bash
cd game
npm ci
npm run dev
```

To build the production game, run `npm run build` from `game/`.
