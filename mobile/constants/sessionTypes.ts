/**
 * Canonical session type ids (API + storage). Colors/icons are UI chrome;
 * copy is localized via `sessionTypes.*` in locales/en.json (`sessionTypeLabel`).
 */
export const SESSION_TYPES = [
  { id: "production", icon: "🎧", color: "#f2f2f2" },
  { id: "beat_making", icon: "🎹", color: "#FF3D00" },
  { id: "mixing", icon: "🎛️", color: "#a259ff" },
  { id: "mastering", icon: "💿", color: "#00ff88" },
  { id: "mix_and_master", icon: "🎚️", color: "#ffaa00" },
  { id: "sound_design", icon: "🔊", color: "#ff4444" },
  { id: "recording", icon: "🎙️", color: "#4488ff" },
  { id: "songwriting", icon: "✍️", color: "#ff88dd" },
  { id: "arrangement", icon: "🎼", color: "#88ffcc" },
  { id: "vocal_production", icon: "🎤", color: "#ffcc44" },
  { id: "learning", icon: "📚", color: "#cc88ff" },
] as const;

export type SessionType = (typeof SESSION_TYPES)[number]["id"];

export const SESSION_TYPE_IDS: readonly SessionType[] = SESSION_TYPES.map((s) => s.id);

export const DEFAULT_SESSION_TYPE: SessionType = "beat_making";
