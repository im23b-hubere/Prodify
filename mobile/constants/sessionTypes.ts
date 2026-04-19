/**
 * Canonical session type ids (API + storage). Labels and colors are defaults for UI;
 * copy is localized via `sessionTypes.*` in locales/en.json.
 */
export const SESSION_TYPES = [
  { id: "beat_making", label: "Beat Making", icon: "🎹", color: "#FF3D00" },
  { id: "mixing", label: "Mixing", icon: "🎛️", color: "#a259ff" },
  { id: "mastering", label: "Mastering", icon: "💿", color: "#00ff88" },
  { id: "mix_and_master", label: "Mix & Master", icon: "🎚️", color: "#ffaa00" },
  { id: "sound_design", label: "Sound Design", icon: "🔊", color: "#ff4444" },
  { id: "recording", label: "Recording", icon: "🎙️", color: "#4488ff" },
  { id: "songwriting", label: "Songwriting", icon: "✍️", color: "#ff88dd" },
  { id: "arrangement", label: "Arrangement", icon: "🎼", color: "#88ffcc" },
  { id: "vocal_production", label: "Vocal Production", icon: "🎤", color: "#ffcc44" },
  { id: "learning", label: "Learning/Practice", icon: "📚", color: "#cc88ff" },
] as const;

export type SessionType = (typeof SESSION_TYPES)[number]["id"];

export const SESSION_TYPE_IDS: readonly SessionType[] = SESSION_TYPES.map((s) => s.id);

export const DEFAULT_SESSION_TYPE: SessionType = "beat_making";
