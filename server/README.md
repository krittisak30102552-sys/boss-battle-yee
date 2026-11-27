# Multiplayer server

This service is separate from the GitHub Pages game because Pages only hosts static files.

## Deploy

1. Import this repository into Render and select the root `render.yaml` blueprint.
2. Deploy the `iron-man-multiplayer` web service.
3. Copy its HTTPS service URL.
4. In the GitHub Pages build environment, set `VITE_MULTIPLAYER_URL` to that URL, then rebuild and publish the game.
5. Set `ALLOWED_ORIGINS` on the Render service to the exact game origin:
   `https://krittisak30102552-sys.github.io`

For local server development:

```sh
cd server
npm install
npm start
```

The health endpoint is `/health`.

## Current scope

The first implementation provides room creation, six-character invite codes, joining/leaving, a four-player limit, room mode selection (co-op/free roam), host migration, and host-only start authorization. Player state packets are validated and relayed by the server.

The Three.js game has not yet been wired to render remote armor rigs or consume player-state packets. Co-op combat authority, shared boss state, and gameplay start synchronization are also follow-up work. Do not treat the room lobby alone as finished multiplayer gameplay.
