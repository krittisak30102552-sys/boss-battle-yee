import { useEffect, useRef, useState } from "react";
import { Game, HudState, WEAPON_INFO } from "./game/Game";
import { downloadSingleHtml, downloadSourceZip } from "./utils/download";
import { MultiplayerClient, RoomInfo, RoomMode } from "./game/multiplayer";

const INITIAL: HudState = {
  status: "menu",
  playerHp: 250,
  playerMax: 250,
  tonyExposed: false,
  bossHp: 3000,
  bossMax: 3000,
  boost: 100,
  weapon: 0,
  morphing: false,
  charge: 0,
  healCd: 0,
  dashCd: 0,
  phase: 1,
  hurt: 0,
  hits: 0,
  action: "",
  locked: false,
  time: 0,
  blocking: false,
  absorbing: false,
  ult: 0,
  refocus: 0,
  heat: 0,
  overheat: false,
  sentries: 0,
  snaps: 0,
  hint: "",
  mark50Available: false,
  mark50Cinematic: false,
  armorModel: 85,
};

const fmt = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;

function Bar({ value, max, color, h = "h-3" }: { value: number; max: number; color: string; h?: string }) {
  return (
    <div className={`w-full ${h} bg-black/60 border border-white/20 skew-x-[-12deg] overflow-hidden`}>
      <div className="h-full transition-[width] duration-100" style={{ width: `${Math.max(0, (value / max) * 100)}%`, background: color }} />
    </div>
  );
}

function DownloadButtons({ compact = false }: { compact?: boolean }) {
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };
  const base =
    "pointer-events-auto cursor-pointer border font-bold tracking-wide transition hover:brightness-125 disabled:opacity-50 " +
    (compact ? "px-3 py-1.5 text-xs" : "px-5 py-3 text-sm");
  return (
    <div className={`flex ${compact ? "gap-2" : "gap-3 flex-wrap justify-center"}`}>
      <button disabled={busy} onClick={() => run(downloadSourceZip)} className={`${base} border-cyan-300/60 bg-cyan-500/15 text-cyan-100`}>
        ⬇ โค้ดเกม (.zip)
      </button>
      <button disabled={busy} onClick={() => run(downloadSingleHtml)} className={`${base} border-amber-300/60 bg-amber-500/15 text-amber-100`}>
        ⬇ เกมไฟล์เดียว (.html)
      </button>
    </div>
  );
}

const KEYS: Array<[string, string]> = [
  ["W A S D", "เดิน"],
  ["เมาส์", "หมุนกล้อง / เล็ง"],
  ["L", "เปิด / ปิดมุมมองอิสระ"],
  ["คลิกซ้าย", "ใช้อาวุธ"],
  ["SPACE", "กระโดด / กดค้างเพื่อบิน"],
  ["SHIFT", "Dash หลบ (อมตะชั่วขณะ)"],
  ["1–9 / 0 / G / Q E / ล้อเมาส์", "เลือกอาวุธและสกิลนาโน"],
  ["V", "เข้า / ออกจาก FORM 2 · กางปีกอัตโนมัติ"],
  ["B", "กาง / พับปีกนาโน"],
  ["R", "ถอดชุด / ใส่ชุด Mark 85"],
  ["T", "ซ่อมเกราะด้วยนาโนบอท (+80, คูลดาวน์ 30 วิ)"],
  ["P / ESC", "พัก"],
  ["ลูกศร / ลากเมาส์ขวา", "หมุนกล้อง (ถ้าล็อกเมาส์ไม่ได้)"],
];

export default function App() {
  const mountRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [hud, setHud] = useState<HudState>(INITIAL);
  const [error, setError] = useState("");
  const [chooseMode, setChooseMode] = useState(false);
  const [deviceMode, setDeviceMode] = useState<"desktop" | "mobile" | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mp] = useState(() => new MultiplayerClient());
  const [mpName, setMpName] = useState("IRON PILOT");
  const [mpCode, setMpCode] = useState("");
  const [mpRoom, setMpRoom] = useState<RoomInfo | null>(null);
  const [mpMode, setMpMode] = useState<RoomMode>("coop");
  const [mpBusy, setMpBusy] = useState(false);
  const [mpError, setMpError] = useState("");\n  const [mpUid, setMpUid] = useState<string | undefined>(undefined);
    const [combatMode, setCombatMode] = useState<0 | 1>(0);
    const armorModel = hud.armorModel;
    const visibleWeapons = combatMode === 0 ? WEAPON_INFO.slice(0, 6) : WEAPON_INFO.slice(6);
    const switchCombatMode = () => {
      const next = combatMode === 0 ? 1 : 0;
      setCombatMode(next);
      gameRef.current?.setCombatMode(next);
      gameRef.current?.selectSkill(next === 0 ? 0 : 6);
    };
    

  const launchMultiplayerGame = () => {
    setMpError("");
    setChooseMode(false);
    setDeviceMode("desktop");
    gameRef.current?.start();
  };

  useEffect(() => {
    const offRoom = mp.onRoomUpdate((room) => { setMpRoom(room); });
    const offStart = mp.onStarted(() => launchMultiplayerGame());
    return () => { offRoom(); offStart(); mp.disconnect(); };
  }, [mp]);

  const createRoom = async () => { setMpBusy(true); setMpError(""); try { await mp.connect(); const r = await mp.create(mpName, mpMode); setMpRoom(r.room); setMpUid(mp.playerId); } catch (e) { setMpError(e instanceof Error ? e.message : String(e)); } finally { setMpBusy(false); } };
  const joinRoom = async () => { setMpBusy(true); setMpError(""); try { await mp.connect(); const r = await mp.join(mpName, mpCode); setMpRoom(r.room); setMpUid(mp.playerId); } catch (e) { setMpError(e instanceof Error ? e.message : String(e)); } finally { setMpBusy(false); } };
  const startRoom = async () => { setMpBusy(true); setMpError(""); try { await mp.start(); launchMultiplayerGame(); } catch (e) { setMpError(e instanceof Error ? e.message : String(e)); } finally { setMpBusy(false); } };

  useEffect(() => {
    if (!mountRef.current) return;
    let game: Game;
    try {
      game = new Game(mountRef.current, setHud);
    } catch (e) {
      setError(String(e));
      return;
    }
    gameRef.current = game;
    return () => {
      game.dispose();
      gameRef.current = null;
    };
  }, []);


const holdKey = (code: string, label: string, extra = "") => (
  <button key={code} type="button"
    onPointerDown={(e) => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); document.dispatchEvent(new KeyboardEvent("keydown", { code, key: code.startsWith("Key") ? code.slice(3).toLowerCase() : code === "Space" ? " " : code.startsWith("Arrow") ? code.slice(5).toLowerCase() : code === "ShiftLeft" ? "Shift" : code, bubbles: true })); }}
    onPointerUp={() => document.dispatchEvent(new KeyboardEvent("keyup", { code, key: code.startsWith("Key") ? code.slice(3).toLowerCase() : code === "Space" ? " " : code.startsWith("Arrow") ? code.slice(5).toLowerCase() : code === "ShiftLeft" ? "Shift" : code, bubbles: true }))}
    onPointerCancel={() => document.dispatchEvent(new KeyboardEvent("keyup", { code, key: code.startsWith("Key") ? code.slice(3).toLowerCase() : code === "Space" ? " " : code.startsWith("Arrow") ? code.slice(5).toLowerCase() : code === "ShiftLeft" ? "Shift" : code, bubbles: true }))}
    onLostPointerCapture={() => document.dispatchEvent(new KeyboardEvent("keyup", { code, key: code.startsWith("Key") ? code.slice(3).toLowerCase() : code === "Space" ? " " : code.startsWith("Arrow") ? code.slice(5).toLowerCase() : code === "ShiftLeft" ? "Shift" : code, bubbles: true }))}
    onContextMenu={(e) => e.preventDefault()}
    className={`h-12 w-12 rounded-xl border border-white/35 bg-black/65 text-lg font-black text-white shadow-lg active:bg-cyan-500/50 active:scale-95 ${extra}`}>
    {label}
  </button>
);

  
const cameraTouchRef = useRef<{ x: number; y: number } | null>(null);
const stickPointerRef = useRef<number | null>(null);
const virtualKeysRef = useRef<Set<string>>(new Set());
const setVirtualKey = (code: string, down: boolean) => {
  const held = virtualKeysRef.current.has(code);
  if (down && !held) {
    virtualKeysRef.current.add(code);
    document.dispatchEvent(new KeyboardEvent("keydown", { code, key: code.startsWith("Key") ? code.slice(3).toLowerCase() : code === "Space" ? " " : code.startsWith("Arrow") ? code.slice(5).toLowerCase() : code === "ShiftLeft" ? "Shift" : code, bubbles: true }));
  } else if (!down && held) {
    virtualKeysRef.current.delete(code);
    document.dispatchEvent(new KeyboardEvent("keyup", { code, key: code.startsWith("Key") ? code.slice(3).toLowerCase() : code === "Space" ? " " : code.startsWith("Arrow") ? code.slice(5).toLowerCase() : code === "ShiftLeft" ? "Shift" : code, bubbles: true }));
  }
};
const moveStick = (e: React.PointerEvent<HTMLDivElement>) => {
  const rect = e.currentTarget.getBoundingClientRect();
  const dx = e.clientX - (rect.left + rect.width / 2);
  const dy = e.clientY - (rect.top + rect.height / 2);
  const max = rect.width * 0.34;
  const distance = Math.hypot(dx, dy) || 1;
  const scale = Math.min(1, max / distance);
  const x = dx * scale, y = dy * scale;
  const knob = e.currentTarget.querySelector<HTMLElement>("[data-stick-knob]");
  if (knob) knob.style.transform = "translate(" + x + "px," + y + "px)";
  const dead = rect.width * 0.13;
  setVirtualKey("KeyA", x < -dead);
  setVirtualKey("KeyD", x > dead);
  setVirtualKey("KeyW", y < -dead);
  setVirtualKey("KeyS", y > dead);
};
const releaseStick = () => {
  ["KeyW", "KeyA", "KeyS", "KeyD"].forEach((code) => setVirtualKey(code, false));
  const knob = document.querySelector<HTMLElement>("[data-stick-knob]");
  if (knob) knob.style.transform = "translate(0px,0px)";
};

  
useEffect(() => {
  const onCombatModeChange = (event: Event) => {
    const detail = (event as CustomEvent<number>).detail;
    setCombatMode(detail === 1 ? 1 : 0);
  };
  window.addEventListener("combatmodechange", onCombatModeChange);
  return () => window.removeEventListener("combatmodechange", onCombatModeChange);
}, []);

    const bossPct = hud.bossHp / hud.bossMax;
  const armorRatio = hud.playerMax > 0 ? hud.playerHp / hud.playerMax : 1;
  const armorCondition = hud.tonyExposed
    ? { label: "TONY VITALS · โทนี่มีชีวิตอยู่", color: "border-cyan-300 text-cyan-100", glow: "0 0 18px rgba(34,211,238,0.45)" }
    : armorRatio <= 0.2
      ? { label: "CRITICAL DAMAGE · เกราะเสียหายหนัก", color: "border-red-400 text-red-200", glow: "0 0 16px rgba(248,113,113,0.45)" }
      : armorRatio <= 0.5
        ? { label: "ARMOR DAMAGED · เกราะเสียหาย", color: "border-amber-300 text-amber-200", glow: "0 0 12px rgba(251,191,36,0.25)" }
        : { label: "ARMOR STABLE · เกราะปกติ", color: "border-emerald-300/60 text-emerald-200", glow: "none" };
  const showHud = hud.status === "playing" || hud.status === "paused";

  return (
    <div className="fixed inset-0 overflow-hidden bg-black text-white select-none" style={{ fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
      <div ref={mountRef} className="absolute inset-0" />

      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black text-red-300 p-8 text-center">
          ไม่สามารถเริ่ม WebGL ได้: {error}
        </div>
      )}

      {/* ---------------- in-game HUD ---------------- */}
      {showHud && (
        <div className="pointer-events-none absolute inset-0">
          {/* damage vignette */}
          {hud.hurt > 0 && (
            <div
              key={hud.hurt}
              className="hurt-flash absolute inset-0"
              style={{ boxShadow: "inset 0 0 160px 40px rgba(255,0,0,0.65)" }}
            />
          )}

          {/* boss bar */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 w-[min(720px,88vw)]">
            <div className="flex items-end justify-between mb-1 px-1">
              <div className="text-lg font-black tracking-[0.25em] text-purple-200 drop-shadow">THANOS</div>
              <div className="text-xs text-purple-200/80">
                {hud.phase === 2 ? "PHASE II · RAGE" : "PHASE I"} · {hud.bossHp}/{hud.bossMax}
              </div>
            </div>
            <div className="relative">
              <Bar value={hud.bossHp} max={hud.bossMax} color="linear-gradient(90deg,#7c3aed,#c026d3)" h="h-4" />
              <div className="absolute top-0 bottom-0 left-1/2 w-px bg-white/60" />
            </div>
            <div className="h-7 mt-2 text-center text-sm font-bold text-amber-300 drop-shadow animate-pulse">{hud.action}</div>
          </div>

          {/* crosshair */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <div className={`w-8 h-8 rounded-full border-2 ${hud.blocking ? "border-cyan-300" : "border-cyan-200/70"} flex items-center justify-center`}>
              <div className="w-1 h-1 rounded-full bg-cyan-200" />
            </div>
            {hud.hits > 0 && (
              <div key={hud.hits} className="hit-marker absolute inset-0 flex items-center justify-center text-red-400 font-black text-2xl">
                ✕
              </div>
            )}
          </div>

          {/* separate armor + Tony pilot status */}
          <div className="absolute left-4 bottom-4 w-[min(320px,44vw)] space-y-2">
            <div className="border border-red-300/35 bg-black/65 p-2">
              <div className="flex justify-between text-xs font-black tracking-wider text-red-200 mb-1">
                <span>{hud.tonyExposed ? "TONY STARK · VITALS" : `ARMOR · MARK ${armorModel}`}</span>
                <span>{hud.playerHp}/{hud.playerMax}</span>
              </div>
              <Bar value={hud.playerHp} max={hud.playerMax} color={hud.tonyExposed ? "linear-gradient(90deg,#0891b2,#67e8f9)" : "linear-gradient(90deg,#dc2626,#f59e0b)"} h="h-4" />
              {hud.mark50Available && (
                <button type="button" onClick={() => gameRef.current?.activateMark50()}
                  className="pointer-events-auto mt-3 w-full rounded-xl border-2 border-cyan-300 bg-cyan-500/20 px-4 py-3 text-sm font-black tracking-wider text-cyan-100 shadow-[0_0_22px_rgba(34,211,238,0.35)] active:scale-95">
                  ⚡ เรียก MARK 50 · คลิก หรือกด M
                </button>
              )}
              {hud.mark50Cinematic && (
                <div className="mt-3 text-center text-xs font-black tracking-[0.2em] text-cyan-200 animate-pulse">
                  ARC REACTOR LINK · MODEL PRIME ASSEMBLY
                </div>
              )}
              <div className={`mt-2 inline-flex items-center gap-2 border bg-black/65 px-2 py-1 text-[10px] font-black tracking-wide ${armorCondition.color}`} style={{ boxShadow: armorCondition.glow }}>
                <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
                {armorCondition.label}
              </div>
            </div>
            {!hud.tonyExposed && (
              <>
              <div>
                <div className="text-[10px] font-bold text-cyan-200 mb-1">THRUSTERS</div>
                <Bar value={hud.boost} max={100} color="linear-gradient(90deg,#06b6d4,#a5f3fc)" h="h-2" />
              </div>
              <div className="flex gap-2 text-[11px] font-bold">
                <div className={`px-2 py-1 border ${hud.healCd > 0 ? "border-white/20 text-white/40" : "border-emerald-300/70 text-emerald-200"} bg-black/50`}>
                  [T] ซ่อม {hud.healCd > 0 ? `${Math.ceil(hud.healCd)}s` : "พร้อม"}
                </div>
                <div className={`px-2 py-1 border ${hud.dashCd > 0 ? "border-white/20 text-white/40" : "border-cyan-300/70 text-cyan-200"} bg-black/50`}>
                  [SHIFT] Dash {hud.dashCd > 0 ? `${hud.dashCd.toFixed(1)}s` : "พร้อม"}
                </div>
              </div>
              </>
            )}
          </div>

          {!hud.tonyExposed && (
            <>
            {/* current form + skill bar */}
            <div className="absolute bottom-[82px] left-1/2 -translate-x-1/2 rounded-md border border-cyan-300/40 bg-slate-950/85 px-3 py-1 text-[10px] font-black tracking-[0.22em] text-cyan-100 shadow-[0_0_14px_rgba(34,211,238,0.18)]">
              {combatMode === 1 ? "FORM 2 · NANO WINGS DEPLOYED" : "FORM 1 · STANDARD CONFIG"}
            </div>
            {/* weapons */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex w-[calc(100%-1rem)] max-w-[720px] justify-center gap-1 sm:gap-2">
              {visibleWeapons.map((w, i) => {
                  const skillIndex = combatMode === 0 ? i : i + 6;
                const active = hud.weapon === skillIndex;
                return (
                  <div
                    key={w.key}
                    className={`relative min-w-0 max-w-[110px] flex-1 px-1 sm:px-2 py-2 border-2 skew-x-[-8deg] transition ${
                      active ? "border-amber-300 bg-red-700/60 scale-110 shadow-[0_0_20px_rgba(251,191,36,0.6)]" : "border-white/20 bg-black/55 opacity-70"
                    }`}
                  >
                    <div className="skew-x-[8deg]">
                      <div className="text-[10px] text-amber-200 font-black">[{w.key}]</div>
                      <div className="text-[11px] sm:text-xs font-black leading-tight">{w.th}</div>
                      <div className="text-[9px] text-white/60 hidden sm:block">{w.name}</div>
                      {active && i === 3 && hud.charge > 0 && (
                        <div className="mt-1">
                          <Bar value={hud.charge} max={1} color="linear-gradient(90deg,#f97316,#fde047)" h="h-1.5" />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {hud.morphing && (
              <div className="absolute bottom-[104px] left-1/2 -translate-x-1/2 text-cyan-200 text-xs font-black tracking-[0.3em] animate-pulse">
                NANOBOTS REFORMING…
              </div>
            )}
  
  
            </>
          )}

          {/* top right */}
          <div className="absolute top-4 right-4 flex flex-col items-end gap-2">
            <div className="text-sm font-bold text-white/80 bg-black/40 px-3 py-1 border border-white/10">⏱ {fmt(hud.time)}</div>
            <DownloadButtons compact />
          </div>

          {hud.status === "playing" && !hud.locked && (
            <div className="absolute top-24 right-4 text-[11px] text-white/60 text-right max-w-[230px]">
              กด L เปิด/ปิดมุมมองอิสระ · ขยับเมาส์เพื่อหมุนกล้อง
            </div>
          )}
        </div>
      )}


      {showHud && deviceMode === "mobile" && hud.status === "playing" && (
        <div className="pointer-events-none absolute inset-0 z-20 touch-none">
          <div className="pointer-events-auto hidden">
            <span />
            {holdKey("KeyW", "▲", "col-start-2")}
            <span />
            {holdKey("KeyA", "◀", "")}
            {holdKey("KeyS", "▼", "")}
            {holdKey("KeyD", "▶", "")}
          </div>
          <div className="pointer-events-auto hidden">
            {holdKey("Space", "กระโดด / บิน", "w-28 h-14 text-xs")}
            {holdKey("ShiftLeft", "พุ่งหลบ", "w-28 h-11 text-xs")}
            <div className="hidden">
              <span />
              {holdKey("ArrowUp", "กล้อง ▲", "w-12 h-10 text-[10px]")}
              <span />
              {holdKey("ArrowLeft", "◀", "w-12 h-10")}
              {holdKey("ArrowDown", "▼", "w-12 h-10")}
              {holdKey("ArrowRight", "▶", "w-12 h-10")}
            </div>
          </div>
        </div>
      )}


      {showHud && deviceMode === "mobile" && hud.status === "playing" && (
        <>
          <div data-stick-area className="pointer-events-auto absolute bottom-7 left-5 z-30 flex h-36 w-36 touch-none items-center justify-center rounded-full border-2 border-white/50 bg-black/45 shadow-xl"
            onPointerDown={(e) => { e.preventDefault(); stickPointerRef.current = e.pointerId; e.currentTarget.setPointerCapture(e.pointerId); moveStick(e); }}
            onPointerMove={(e) => { if (stickPointerRef.current === e.pointerId) moveStick(e); }}
            onPointerUp={() => { stickPointerRef.current = null; releaseStick(); }} onPointerCancel={() => { stickPointerRef.current = null; releaseStick(); }} onLostPointerCapture={() => { stickPointerRef.current = null; releaseStick(); }}>
            <div className="pointer-events-none absolute h-24 w-24 rounded-full border border-white/25" />
            <div data-stick-knob className="pointer-events-none absolute h-14 w-14 rounded-full border-2 border-cyan-200 bg-cyan-400/50 shadow-lg" />
          </div>
          <div className="pointer-events-auto absolute inset-0 z-10 touch-none"
            onPointerDown={(e) => {
              if ((e.target as HTMLElement).closest("button, [data-stick-area]")) return;
              e.preventDefault();
              cameraTouchRef.current = { x: e.clientX, y: e.clientY };
              e.currentTarget.setPointerCapture(e.pointerId);
            }}
            onPointerMove={(e) => {
              const prev = cameraTouchRef.current;
              if (!prev) return;
              e.preventDefault();
              const dx = e.clientX - prev.x, dy = e.clientY - prev.y;
              cameraTouchRef.current = { x: e.clientX, y: e.clientY };
              gameRef.current?.touchLook(dx, dy);
            }}
            onPointerUp={() => { cameraTouchRef.current = null; }}
            onPointerCancel={() => { cameraTouchRef.current = null; }}
            onLostPointerCapture={() => { cameraTouchRef.current = null; }}
          />
          <div className="pointer-events-none absolute bottom-3 right-4 z-30 text-[10px] font-bold text-white/60">แตะพื้นที่ว่างแล้วลากเพื่อหมุนกล้อง</div>
        </>
      )}


      {showHud && hud.status === "playing" && (
        <button type="button" onClick={() => gameRef.current?.pause()}
          className="pointer-events-auto absolute left-4 top-4 z-[80] rounded-xl border border-amber-300/60 bg-slate-950/90 px-3 py-2 text-xs font-black text-amber-100 shadow-xl">
          ⏸ หยุดเกม
        </button>
      )}

      {showHud && hud.status === "playing" && (
        <>
          <button type="button" onClick={() => setSettingsOpen((v) => !v)}
            className="pointer-events-auto absolute right-4 top-4 z-[80] rounded-xl border border-white/35 bg-slate-950/90 px-3 py-2 text-xs font-black text-white shadow-xl">
            ⚙ ตั้งค่า
          </button>
          {settingsOpen && (
            <div className="pointer-events-auto absolute right-4 top-16 z-[90] w-64 rounded-2xl border border-cyan-300/40 bg-slate-950/95 p-4 text-white shadow-2xl">
              <div className="mb-3 text-sm font-black text-cyan-200">ตั้งค่าการควบคุม</div>
              <div className="mb-3 rounded-lg border border-amber-300/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                MARK 85 · Mark 50 จะเรียกใช้ได้เมื่อ Mark 85 พัง
              </div>
              <button type="button"
                onClick={() => { setDeviceMode((v) => v === "mobile" ? "desktop" : "mobile"); setSettingsOpen(false); }}
                className="mb-3 w-full rounded-lg border border-cyan-300/50 bg-cyan-500/15 px-3 py-2 text-left text-xs font-bold">
                {deviceMode === "mobile" ? "เปลี่ยนเป็นคอมพิวเตอร์" : "เปิดโหมดมือถือ · ปุ่มสัมผัส"}
              </button>
              <button type="button" onClick={switchCombatMode}
                className="mb-3 w-full rounded-lg border border-amber-300/50 bg-amber-500/15 px-3 py-2 text-left text-xs font-bold text-amber-100">
                {combatMode === 0 ? "เข้า FORM 2 · กางปีกนาโน" : "กลับ FORM 1 · พับปีกนาโน"}
              </button>
              <div className="space-y-1 text-[11px] leading-relaxed text-white/75">
                <div>V — เข้า / ออก FORM 2 · กางปีกอัตโนมัติ</div>
                <div>R — ถอดชุด / ใส่ชุด Mark {armorModel}</div>
                <div>B — กาง / พับปีกนาโน</div>
                <div>T — ซ่อมเกราะ</div>
                <div>1–9, 0 — เลือกสกิล</div>
                <div>คลิก / แตะโจมตี — ยิงอาวุธที่เลือก</div>
              </div>
              <button type="button" onClick={() => setSettingsOpen(false)}
                className="mt-3 w-full rounded-lg bg-white/10 px-3 py-2 text-xs font-bold">ปิด</button>
            </div>
          )}
        </>
      )}

      {/* ---------------- MENU ---------------- */}
      {hud.status === "menu" && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-black/70 via-black/40 to-black/80 overflow-y-auto">
          <div className="max-w-3xl w-full px-5 py-8 text-center">
            <div className="text-amber-300 tracking-[0.5em] text-xs font-bold mb-2">NANO TECH BOSS FIGHT</div>
            <h1 className="text-4xl sm:text-6xl font-black leading-none">
              <span className="text-red-500 drop-shadow-[0_0_5px_rgba(239,68,68,0.2)]">IRON MAN</span>
              <span className="text-amber-300"> MK-85</span>
              <div className="text-2xl sm:text-3xl text-white/80 my-2 tracking-widest">VS</div>
              <span className="text-purple-400 drop-shadow-[0_0_6px_rgba(168,85,247,0.22)]">THANOS</span>
            </h1>
            <div className="mt-4 inline-flex border border-amber-300/40 bg-black/50 px-4 py-2 text-xs font-black text-amber-100">
              MARK 85 · EMERGENCY RESERVE: MARK 50
            </div>
            <p className="mt-4 text-white/80 text-sm sm:text-base leading-relaxed">
              สนามรบบนไททัน — เริ่มด้วย Mark 85 — เมื่อเกราะพัง โทนี่จะเรียก Mark 50 สำรองมาใส่
              <br />
              เปลี่ยนชุดได้อีกครั้งในเมนูตั้งค่าระหว่างเล่น
            </p>

            <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-2 text-left">
              {WEAPON_INFO.map((w) => (
                <div key={w.key} className="border border-amber-300/30 bg-black/50 p-2">
                  <div className="text-[10px] text-amber-300 font-black">
                    [{w.key}] {w.name}
                  </div>
                  <div className="text-sm font-bold">{w.th}</div>
                  <div className="text-[11px] text-white/60">{w.desc}</div>
                </div>
              ))}
            </div>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-left text-xs bg-black/50 border border-white/10 p-3">
              {KEYS.map(([k, d]) => (
                <div key={k} className="flex gap-2">
                  <span className="shrink-0 min-w-[96px] font-bold text-cyan-200">{k}</span>
                  <span className="text-white/75">{d}</span>
                </div>
              ))}
            </div>

            <div className="mt-5 mx-auto max-w-xl border border-cyan-300/35 bg-slate-950/85 p-4 text-left">
              <div className="text-sm font-black tracking-wider text-cyan-200">🌐 MULTIPLAYER · เล่นกับเพื่อน</div>
              {!mp.configured && <p className="mt-2 text-xs text-amber-200/90">เซิร์ฟเวอร์กำลังรอตั้งค่า URL เพื่อเปิดใช้งาน</p>}
              <label className="mt-3 block text-[11px] text-white/65">ชื่อนักบิน</label>
              <input value={mpName} onChange={(e) => setMpName(e.target.value.slice(0,18))} maxLength={18} className="mt-1 w-full rounded-lg border border-white/20 bg-black/60 px-3 py-2 text-sm text-white" />
              {!mpRoom ? <>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button onClick={() => setMpMode("coop")} className={`rounded-lg border p-2 text-xs font-bold ${mpMode === "coop" ? "border-amber-300 bg-amber-500/20 text-amber-100" : "border-white/20 bg-white/5"}`}>⚔️ CO-OP</button>
                  <button onClick={() => setMpMode("freeroam")} className={`rounded-lg border p-2 text-xs font-bold ${mpMode === "freeroam" ? "border-cyan-300 bg-cyan-500/20 text-cyan-100" : "border-white/20 bg-white/5"}`}>🛫 FREE ROAM</button>
                </div>
                <button disabled={mpBusy || !mp.configured} onClick={createRoom} className="mt-3 w-full rounded-lg border border-cyan-300/60 bg-cyan-500/15 px-3 py-2.5 text-sm font-black text-cyan-100 disabled:opacity-40">＋ สร้างห้องใหม่</button>
                <div className="mt-3 flex gap-2">
                  <input value={mpCode} onChange={(e) => setMpCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,6))} maxLength={6} placeholder="รหัสห้อง 6 ตัว" className="min-w-0 flex-1 rounded-lg border border-white/20 bg-black/60 px-3 py-2 text-sm uppercase tracking-[0.25em] text-white" />
                  <button disabled={mpBusy || !mp.configured || mpCode.length !== 6} onClick={joinRoom} className="rounded-lg border border-amber-300/60 bg-amber-500/15 px-4 py-2 text-xs font-black text-amber-100 disabled:opacity-40">เข้าร่วม</button>
                </div>
              </> : <div className="mt-3 rounded-xl border border-cyan-300/30 bg-cyan-950/30 p-3">
                <div className="text-[10px] font-bold tracking-widest text-cyan-200">ROOM CODE</div><div className="my-1 text-3xl font-black tracking-[0.3em] text-white">{mpRoom.code}</div>
                <div className="text-xs text-white/60">{mpRoom.mode === "coop" ? "CO-OP" : "FREE ROAM"} · {mpRoom.players.length}/4 คน</div>
                <div className="mt-2 space-y-1">{mpRoom.players.map((p) => <div key={p.id} className="text-xs text-white/80">✦ {p.name}{p.id === mpRoom.hostId ? " · HOST" : ""}</div>)}</div>
                <button disabled={mpBusy} onClick={startRoom} className="mt-3 w-full rounded-lg border border-amber-300/60 bg-amber-500/15 px-3 py-2 text-xs font-black text-amber-100 disabled:opacity-40">▶ เริ่มห้อง (HOST)</button>
                <button onClick={() => { mp.leave(); setMpRoom(null); }} className="mt-2 w-full rounded-lg bg-white/10 px-3 py-2 text-xs">ออกจากห้อง</button>
              </div>}
              {mpError && <p className="mt-2 text-xs text-red-300">{mpError}</p>}
            </div>
            <button
              onClick={() => { setChooseMode(false); setDeviceMode("desktop"); gameRef.current?.start(); }}
              className="mt-6 cursor-pointer px-12 py-4 text-xl font-black tracking-widest bg-gradient-to-b from-red-500 to-red-700 border-2 border-amber-300 hover:scale-105 active:scale-95 transition shadow-[0_0_30px_rgba(239,68,68,0.6)]"
            >
              ▶ เริ่มเกม
            </button>
            <div className="mt-5">
    
            </div>
          </div>
        </div>
      )}


      {chooseMode && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/95 p-5">
          <div className="w-full max-w-xl border border-amber-300/50 bg-slate-950/95 p-6 text-center shadow-2xl">
            <div className="text-amber-300 text-xs font-black tracking-[0.35em]">SELECT CONTROL MODE</div>
            <h2 className="mt-3 text-2xl sm:text-3xl font-black">เล่นบนอุปกรณ์ไหน?</h2>
            <p className="mt-2 text-sm text-white/60">เลือกวิธีควบคุมก่อนเข้าสู่สนาม</p>
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button onClick={() => { setDeviceMode("desktop"); setChooseMode(false); gameRef.current?.start(); }}
                className="border border-cyan-300/60 bg-cyan-500/10 p-5 text-left hover:bg-cyan-500/20 active:scale-95">
                <div className="text-4xl">🖥️</div><div className="mt-2 text-lg font-black">คอมพิวเตอร์</div>
                <div className="text-xs text-white/60">คีย์บอร์ด + เมาส์</div>
              </button>
              <button onClick={() => { setDeviceMode("mobile"); setChooseMode(false); gameRef.current?.start(); }}
                className="border border-amber-300/60 bg-amber-500/10 p-5 text-left hover:bg-amber-500/20 active:scale-95">
                <div className="text-4xl">📱</div><div className="mt-2 text-lg font-black">โทรศัพท์</div>
                <div className="text-xs text-white/60">ปุ่มสัมผัสบนหน้าจอ</div>
              </button>
            </div>
            <button onClick={() => setChooseMode(false)} className="mt-5 px-5 py-2 text-sm text-white/60 hover:text-white">← กลับ</button>
          </div>
        </div>
      )}

      {/* ---------------- PAUSE ---------------- */}
      {hud.status === "paused" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 bg-black/65 pointer-events-auto">
          <div className="text-4xl font-black tracking-[0.3em]">PAUSED</div>
          <button
            onClick={() => gameRef.current?.resume()}
            className="cursor-pointer px-10 py-3 text-lg font-black tracking-widest bg-gradient-to-b from-red-500 to-red-700 border-2 border-amber-300 hover:scale-105 transition"
          >
            ▶ เล่นต่อ
          </button>

        </div>
      )}

      {/* ---------------- WIN / LOSE ---------------- */}
      {(hud.status === "won" || hud.status === "lost") && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/70 text-center px-4 pointer-events-auto">
          {hud.status === "won" ? (
            <>
              <div className="text-amber-300 tracking-[0.4em] text-xs font-bold">THANOS DEFEATED</div>
              <div className="text-5xl sm:text-6xl font-black text-amber-300 drop-shadow-[0_0_30px_rgba(251,191,36,0.7)]">ชัยชนะ!</div>
              <p className="text-white/80 max-w-md">
                “ฉันคือ Iron Man…” — คุณโค่นธานอสได้ภายในเวลา <b className="text-cyan-200">{fmt(hud.time)}</b>
              </p>
            </>
          ) : (
            <>
              <div className="text-red-400 tracking-[0.4em] text-xs font-bold">ARMOR OFFLINE</div>
              <div className="text-5xl sm:text-6xl font-black text-red-500 drop-shadow-[0_0_30px_rgba(239,68,68,0.7)]">พ่ายแพ้</div>
              <p className="text-white/80 max-w-md">
                ธานอสยังเหลือพลังชีวิต {Math.round(bossPct * 100)}% — ลองใช้ PARRY ด้วยโล่ และปัดลูกพลังงานกลับด้วยดาบ
              </p>
            </>
          )}
          <button
            onClick={() => gameRef.current?.start()}
            className="cursor-pointer mt-2 px-10 py-3 text-lg font-black tracking-widest bg-gradient-to-b from-red-500 to-red-700 border-2 border-amber-300 hover:scale-105 transition"
          >
            ↻ เล่นอีกครั้ง
          </button>

        </div>
      )}
    </div>
  );
}
