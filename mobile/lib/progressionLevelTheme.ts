import type { LucideIcon } from "lucide-react-native";
import {
  AudioWaveform,
  Check,
  CircleDot,
  Crown,
  Download,
  Expand,
  Gauge,
  Grid3x3,
  Headphones,
  Home,
  Layers,
  Lock,
  Monitor,
  Music2,
  Pencil,
  Rocket,
  Search,
  SlidersHorizontal,
  Sparkles,
  Trophy,
  Zap,
} from "lucide-react-native";

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

const LEVEL_ICON_MAP: Record<number, LucideIcon> = {
  1: Home,
  2: Pencil,
  3: Grid3x3,
  4: Search,
  5: Music2,
  6: Layers,
  7: SlidersHorizontal,
  8: Monitor,
  9: CircleDot,
  10: AudioWaveform,
  11: SlidersHorizontal,
  12: Zap,
  13: Expand,
  14: Gauge,
  15: Sparkles,
  16: Download,
  17: Rocket,
  18: Headphones,
  19: Crown,
  20: Trophy,
};

export type LevelRankState = "locked" | "current" | "unlocked";

export function levelTierFor(level: number): LevelTierTheme {
  const safe = Math.max(1, Math.floor(level));
  const index = Math.min(TIERS.length - 1, Math.floor((safe - 1) / 4));
  return TIERS[index]!;
}

export function levelIconFor(level: number): LucideIcon {
  const safe = Math.max(1, Math.floor(level));
  return LEVEL_ICON_MAP[safe] ?? Sparkles;
}

export function levelRankState(level: number, currentLevel: number): LevelRankState {
  const entry = Math.max(1, Math.floor(level));
  const current = Math.max(1, Math.floor(currentLevel));
  if (entry > current) return "locked";
  if (entry === current) return "current";
  return "unlocked";
}

export function groupLevelsByTier<T extends { level: number }>(
  entries: T[],
): {
  tier: LevelTierTheme;
  levels: T[];
}[] {
  const groups = new Map<LevelTierId, { tier: LevelTierTheme; levels: T[] }>();
  for (const entry of entries) {
    const tier = levelTierFor(entry.level);
    const existing = groups.get(tier.id);
    if (existing) {
      existing.levels.push(entry);
    } else {
      groups.set(tier.id, { tier, levels: [entry] });
    }
  }
  return TIERS.map((tier) => groups.get(tier.id)).filter(
    (group): group is { tier: LevelTierTheme; levels: T[] } => Boolean(group),
  );
}

export { Check as LevelUnlockedIcon, Lock as LevelLockedIcon };
