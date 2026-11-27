import { io, Socket } from "socket.io-client";

export type RoomMode = "coop" | "freeroam";
export interface RoomPlayer {
  id: string;
  name: string;
  state: null | {
    x: number; y: number; z: number; yaw: number; pitch: number;
    flying: boolean; armor: 50 | 85; exposed: boolean;
  };
}
export interface RoomInfo {
  code: string;
  mode: RoomMode;
  hostId: string;
  players: RoomPlayer[];
}
type Ack<T> = (value: T) => void;

const SERVER_URL = import.meta.env.VITE_MULTIPLAYER_URL as string | undefined;

export class MultiplayerClient {
  private socket: Socket | null = null;
  private roomCallbacks = new Set<(room: RoomInfo) => void>();
  private startCallbacks = new Set<(data: { mode: RoomMode }) => void>();

  get configured() {
    return Boolean(SERVER_URL);
  }

  connect(): Promise<void> {
    if (!SERVER_URL) return Promise.reject(new Error("ยังไม่ได้ตั้งค่า VITE_MULTIPLAYER_URL"));
    if (this.socket?.connected) return Promise.resolve();
    this.socket?.disconnect();
    this.socket = io(SERVER_URL, { transports: ["websocket", "polling"], timeout: 8000 });
    this.socket.on("room:update", (room: RoomInfo) => this.roomCallbacks.forEach((callback) => callback(room)));
    this.socket.on("room:started", (data: { mode: RoomMode }) => this.startCallbacks.forEach((callback) => callback(data)));
    return new Promise((resolve, reject) => {
      const socket = this.socket!;
      const timer = window.setTimeout(() => reject(new Error("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ")), 9000);
      socket.once("connect", () => { window.clearTimeout(timer); resolve(); });
      socket.once("connect_error", (error) => { window.clearTimeout(timer); reject(error); });
    });
  }

  private request<T>(event: string, payload?: unknown): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!this.socket?.connected) return reject(new Error("ยังไม่ได้เชื่อมต่อ"));
      const timer = window.setTimeout(() => reject(new Error("เซิร์ฟเวอร์ไม่ตอบสนอง")), 8000);
      const ack: Ack<T & { ok?: boolean; error?: string }> = (result) => {
        window.clearTimeout(timer);
        if (result && result.ok === false) reject(new Error(result.error || "ทำรายการไม่สำเร็จ"));
        else resolve(result);
      };
      if (payload === undefined) this.socket.emit(event, ack);
      else this.socket.emit(event, payload, ack);
    });
  }

  create(name: string, mode: RoomMode) {
    return this.request<{ ok: true; room: RoomInfo }>("room:create", { name, mode });
  }
  join(name: string, code: string) {
    return this.request<{ ok: true; room: RoomInfo }>("room:join", { name, code });
  }
  start() {
    return this.request<{ ok: true }>("room:start");
  }
  leave() {
    this.socket?.emit("room:leave");
  }
  onRoomUpdate(callback: (room: RoomInfo) => void) {
    this.roomCallbacks.add(callback);
    return () => { this.roomCallbacks.delete(callback); };
  }
  onStarted(callback: (data: { mode: RoomMode }) => void) {
    this.startCallbacks.add(callback);
    return () => { this.startCallbacks.delete(callback); };
  }
  disconnect() {
    this.socket?.disconnect();
    this.socket = null;
    this.roomCallbacks.clear();
    this.startCallbacks.clear();
  }
}
