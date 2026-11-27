import { createServer } from "node:http";
import { Server } from "socket.io";
import { randomInt } from "node:crypto";

const PORT = Number(process.env.PORT || 3001);
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "*").split(",").map((s) => s.trim());
const MAX_PLAYERS = 4;
const rooms = new Map();

const httpServer = createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, rooms: rooms.size }));
    return;
  }
  res.writeHead(404);
  res.end("Not found");
});

const io = new Server(httpServer, {
  cors: {
    origin: ALLOWED_ORIGINS.includes("*") ? true : ALLOWED_ORIGINS,
    methods: ["GET", "POST"],
  },
  transports: ["websocket", "polling"],
  maxHttpBufferSize: 16_384,
});

const cleanName = (value) => String(value || "IRON PILOT").replace(/[<>\u0000-\u001f]/g, "").trim().slice(0, 18) || "IRON PILOT";
const makeCode = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[randomInt(chars.length)];
  return code;
};
const publicRoom = (room) => ({
  code: room.code,
  mode: room.mode,
  hostId: room.hostId,
  players: [...room.players.values()].map(({ id, name, state }) => ({ id, name, state })),
});

function leaveRoom(socket) {
  const code = socket.data.roomCode;
  if (!code) return;
  const room = rooms.get(code);
  socket.leave(code);
  socket.data.roomCode = null;
  if (!room) return;
  room.players.delete(socket.id);
  if (room.players.size === 0) {
    rooms.delete(code);
    return;
  }
  if (room.hostId === socket.id) room.hostId = room.players.keys().next().value;
  io.to(code).emit("room:update", publicRoom(room));
  io.to(code).emit("player:left", { id: socket.id });
}

io.on("connection", (socket) => {
  socket.on("room:create", (payload = {}, ack = () => {}) => {
    leaveRoom(socket);
    const mode = payload.mode === "coop" ? "coop" : "freeroam";
    let code = makeCode();
    while (rooms.has(code)) code = makeCode();
    const room = { code, mode, hostId: socket.id, players: new Map() };
    room.players.set(socket.id, { id: socket.id, name: cleanName(payload.name), state: null });
    rooms.set(code, room);
    socket.join(code);
    socket.data.roomCode = code;
    ack({ ok: true, room: publicRoom(room) });
    io.to(code).emit("room:update", publicRoom(room));
  });

  socket.on("room:join", (payload = {}, ack = () => {}) => {
    const code = String(payload.code || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
    const room = rooms.get(code);
    if (!room) return ack({ ok: false, error: "ไม่พบห้องนี้" });
    if (room.players.size >= MAX_PLAYERS) return ack({ ok: false, error: "ห้องเต็มแล้ว (สูงสุด 4 คน)" });
    leaveRoom(socket);
    room.players.set(socket.id, { id: socket.id, name: cleanName(payload.name), state: null });
    socket.join(code);
    socket.data.roomCode = code;
    ack({ ok: true, room: publicRoom(room) });
    io.to(code).emit("room:update", publicRoom(room));
    io.to(code).emit("player:joined", { id: socket.id });
  });

  socket.on("player:state", (state) => {
    const code = socket.data.roomCode;
    const room = rooms.get(code);
    const player = room?.players.get(socket.id);
    if (!player || !state || typeof state !== "object") return;
    const n = (v, fallback = 0) => Number.isFinite(v) ? Math.max(-500, Math.min(500, v)) : fallback;
    player.state = {
      x: n(state.x), y: n(state.y), z: n(state.z),
      yaw: n(state.yaw), pitch: n(state.pitch),
      flying: Boolean(state.flying),
      armor: state.armor === 50 ? 50 : 85,
      exposed: Boolean(state.exposed),
    };
    socket.to(code).volatile.emit("player:state", { id: socket.id, name: player.name, state: player.state });
  });

  socket.on("room:start", (ack = () => {}) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room) return ack({ ok: false, error: "ไม่ได้อยู่ในห้อง" });
    if (room.hostId !== socket.id) return ack({ ok: false, error: "เฉพาะหัวหน้าห้องเท่านั้น" });
    io.to(room.code).emit("room:started", { mode: room.mode });
    ack({ ok: true });
  });

  socket.on("room:leave", () => leaveRoom(socket));
  socket.on("disconnect", () => leaveRoom(socket));
});

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`Iron multiplayer server listening on :${PORT}`);
});
