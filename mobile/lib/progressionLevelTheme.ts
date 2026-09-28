export type LevelTierId = "starter" | "builder" | "engineer" | "pro" | "legend";

export type LevelTierTheme = {
  id: LevelTierId;
  labelKey: string;
  accent: string;
  accentSoft: string;
  gradient: readonly [string, string];
  glow: string;
};

const TIERS: LevelTierTheme[] = [
  {
    id: "starter",
    labelKey: "progression.levelTiers.starter",
    accent: "#e8a35c",
    accentSoft: "rgba(232,163,92,0.18)",
    gradient: ["#5c3d1e", "#e8a35c"],
    glow: "rgba(232,163,92,0.35)",
  },
  {
    id: "builder",
    labelKey: "progression.levelTiers.builder",
    accent: "#45c9b3",
    accentSoft: "rgba(69,201,179,0.18)",
    gradient: ["#1a4a42", "#45c9b3"],
    glow: "rgba(69,201,179,0.35)",
  },
  {
    id: "engineer",
    labelKey: "progression.levelTiers.engineer",
    accent: "#6b9bff",
    accentSoft: "rgba(107,155,255,0.18)",
    gradient: ["#1e3260", "#6b9bff"],
    glow: "rgba(107,155,255,0.35)",
  },
  {
    id: "pro",
    labelKey: "progression.levelTiers.pro",
    accent: "#b07cff",
    accentSoft: "rgba(176,124,255,0.2)",
    gradient: ["#3b1f66", "#b07cff"],
    glow: "rgba(176,124,255,0.38)",
  },
  {
    id: "legend",
    labelKey: "progression.levelTiers.legend",
    accent: "#f5d547",
    accentSoft: "rgba(245,213,71,0.2)",
    gradient: ["#5c4a12", "#f5d547"],
    glow: "rgba(245,213,71,0.4)",
  },
];

export function levelTierFor(level: number): LevelTierTheme {
  const safe = Math.max(1, Math.floor(level));
  const index = Math.min(TIERS.length - 1, Math.floor((safe - 1) / 4));
  return TIERS[index]!;
}
