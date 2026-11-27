import { initializeApp, getApps } from "firebase/app";
import { getAuth, signInAnonymously, type User } from "firebase/auth";
import { getDatabase, ref, onValue, runTransaction, onDisconnect, type Database } from "firebase/database";

export type RoomMode = "coop" | "freeroam";
export interface RoomPlayer { id: string; name: string; state: null; }
export interface RoomInfo { code: string; mode: RoomMode; hostId: string; players: RoomPlayer[]; started?: boolean; }

const config = {
  apiKey: String(import.meta.env.VITE_FIREBASE_API_KEY || "").trim().replace(/^["']|["']$/g, ""),
  authDomain: String(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "").trim().replace(/^["']|["']$/g, ""),
  // Use the exact Realtime Database endpoint created for this Firebase project.
  databaseURL: "https://iron-man-game-413bd-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: String(import.meta.env.VITE_FIREBASE_PROJECT_ID || "").trim().replace(/^["']|["']$/g, ""),
  appId: String(import.meta.env.VITE_FIREBASE_APP_ID || "").trim().replace(/^["']|["']$/g, ""),
};
const configured = Boolean(config.apiKey && config.authDomain && config.databaseURL && config.projectId && config.appId);
const app = configured ? (getApps()[0] ?? initializeApp(config)) : null;
const auth = app ? getAuth(app) : null;
const db: Database | null = app ? getDatabase(app) : null;
const safeName = (name: string) => (name || "IRON PILOT").replace(/[<>\u0000-\u001f]/g, "").trim().slice(0, 18) || "IRON PILOT";
const newCode = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
};

export class MultiplayerClient {
  private user: User | null = null;
  private code: string | null = null;
  private unsubscribe: (() => void) | null = null;
  private roomCallbacks = new Set<(room: RoomInfo) => void>();
  private startCallbacks = new Set<(data: { mode: RoomMode }) => void>();
  private wasStarted = false;
  get configured() { return configured; }

  async connect() {
    if (!auth || !db) throw new Error("ยังไม่ได้ตั้งค่า Firebase ตามขั้นตอนที่ให้ไว้");
    if (!auth.currentUser) await signInAnonymously(auth);
    this.user = auth.currentUser;
    if (!this.user) throw new Error("ยืนยันตัวตนผู้เล่นไม่สำเร็จ");
  }
  private require() {
    if (!db || !this.user) throw new Error("ยังไม่ได้เชื่อมต่อ Firebase");
    return { db, uid: this.user.uid };
  }
  private watch(code: string) {
    this.unsubscribe?.();
    this.code = code;
    const { db } = this.require();
    this.wasStarted = false;
    this.unsubscribe = onValue(ref(db, `rooms/${code}`), snap => {
      const data = snap.val();
      if (!data) { this.roomCallbacks.forEach(cb => cb(null as unknown as RoomInfo)); return; }
      const players = Object.entries(data.players || {}).map(([id, p]: [string, any]) => ({ id, name: String(p.name || "IRON PILOT"), state: null as null }));
      const room: RoomInfo = { code, mode: data.mode, hostId: data.hostId, players, started: Boolean(data.started) };
      this.roomCallbacks.forEach(cb => cb(room));
      if (room.started && !this.wasStarted) this.startCallbacks.forEach(cb => cb({ mode: room.mode }));
      this.wasStarted = Boolean(room.started);
    });
  }
  async create(name: string, mode: RoomMode): Promise<{ ok: true; room: RoomInfo }> {
    const { db, uid } = this.require();
    await this.leave();
    for (let i = 0; i < 8; i++) {
      const code = newCode();
      const result = await runTransaction(ref(db, `rooms/${code}`), current => current === null ? {
        code, mode, hostId: uid, started: false,
        players: { [uid]: { name: safeName(name) } },
      } : undefined);
      if (result.committed) {
        await onDisconnect(ref(db, `rooms/${code}/players/${uid}`)).remove();
        this.watch(code);
        return { ok: true, room: { code, mode, hostId: uid, players: [{ id: uid, name: safeName(name), state: null }], started: false } };
      }
    }
    throw new Error("สร้างห้องไม่สำเร็จ ลองใหม่อีกครั้ง");
  }
  async join(name: string, input: string): Promise<{ ok: true; room: RoomInfo }> {
    const { db, uid } = this.require();
    await this.leave();
    const code = input.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
    if (code.length !== 6) throw new Error("กรอกรหัสห้อง 6 ตัว");
    let reason = "เข้าห้องไม่สำเร็จ";
    const result = await runTransaction(ref(db, `rooms/${code}`), room => {
      if (!room) { reason = "ไม่พบห้องนี้"; return; }
      room.players ||= {};
      if (room.started) { reason = "ห้องเริ่มเกมแล้ว"; return; }
      if (!room.players[uid] && Object.keys(room.players).length >= 4) { reason = "ห้องเต็มแล้ว (สูงสุด 4 คน)"; return; }
      room.players[uid] = { name: safeName(name) };
      return room;
    });
    if (!result.committed) throw new Error(reason);
    await onDisconnect(ref(db, `rooms/${code}/players/${uid}`)).remove();
    this.watch(code);
    const raw = result.snapshot.val();
    const players = Object.entries(raw.players || {}).map(([id, p]: [string, any]) => ({ id, name: p.name, state: null as null }));
    return { ok: true, room: { code, mode: raw.mode, hostId: raw.hostId, players, started: Boolean(raw.started) } };
  }
  async start(): Promise<{ ok: true }> {
    const { db, uid } = this.require();
    if (!this.code) throw new Error("ยังไม่ได้อยู่ในห้อง");
    let reason = "เริ่มห้องไม่สำเร็จ";
    const result = await runTransaction(ref(db, `rooms/${this.code}`), room => {
      if (!room) { reason = "ไม่พบห้อง"; return; }
      if (room.hostId !== uid) { reason = "เฉพาะ HOST เท่านั้นที่เริ่มได้"; return; }
      room.started = true; return room;
    });
    if (!result.committed) throw new Error(reason);
    return { ok: true };
  }
  async leave() {
    if (!db || !this.user || !this.code) return;
    const code = this.code, uid = this.user.uid;
    this.unsubscribe?.(); this.unsubscribe = null; this.code = null;
    await runTransaction(ref(db, `rooms/${code}`), room => {
      if (!room?.players?.[uid]) return room;
      delete room.players[uid];
      const ids = Object.keys(room.players);
      if (!ids.length) return null;
      if (room.hostId === uid) room.hostId = ids[0];
      return room;
    });
    await onDisconnect(ref(db, `rooms/${code}/players/${uid}`)).cancel();
  }
  onRoomUpdate(callback: (room: RoomInfo) => void) {
    this.roomCallbacks.add(callback);
    return () => this.roomCallbacks.delete(callback);
  }
  onStarted(callback: (data: { mode: RoomMode }) => void) {
    this.startCallbacks.add(callback);
    return () => this.startCallbacks.delete(callback);
  }
  disconnect() {
    void this.leave();
    this.roomCallbacks.clear(); this.startCallbacks.clear();
  }
}
