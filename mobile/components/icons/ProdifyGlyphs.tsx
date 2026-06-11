import {
  Calendar,
  Clock,
  Crown,
  Flame,
  Frown,
  Laugh,
  Medal,
  Moon,
  Music2,
  Smile,
  Star,
  Trophy,
  Zap,
  type LucideIcon,
} from "lucide-react-native";
import { StyleSheet } from "react-native";

import { colors } from "../../constants/theme";

export const MOOD_LEVELS = [1, 2, 3, 4, 5] as const;
export type MoodLevel = (typeof MOOD_LEVELS)[number];

const MOOD_ICONS: Record<MoodLevel, LucideIcon> = {
  1: Moon,
  2: Frown,
  3: Smile,
  4: Laugh,
  5: Flame,
};

const RECORD_ICONS: Record<string, LucideIcon> = {
  longest_session: Clock,
  most_sessions_day: Calendar,
  longest_streak: Flame,
  current_streak: Zap,
  productive_week: Trophy,
};

const ACHIEVEMENT_ICONS: Record<string, LucideIcon> = {
  first_session: Music2,
  sessions_10: Flame,
  sessions_50: Medal,
  streak_7: Zap,
  marathon_2h: Crown,
  night_owl: Moon,
};

type GlyphProps = {
  size?: number;
  color?: string;
  filled?: boolean;
};

export function isMoodLevel(value: number): value is MoodLevel {
  return value >= 1 && value <= 5;
}

export function MoodIcon({
  level,
  size = 24,
  color,
  active = true,
}: GlyphProps & { level: MoodLevel; active?: boolean }) {
  const Icon = MOOD_ICONS[level];
  const tint = color ?? (active ? colors.primary : colors.textSecondary);
  const filled = level === 5 && active;
  return <Icon size={size} color={tint} strokeWidth={2.2} fill={filled ? tint : "none"} />;
}

export function AppFlame({ size = 20, color = colors.primary, filled = true }: GlyphProps) {
  return <Flame size={size} color={color} strokeWidth={2.2} fill={filled ? color : "none"} />;
}

export function RecordGlyph({
  recordKey,
  size = 16,
  color = colors.primary,
}: GlyphProps & { recordKey: string }) {
  const Icon = RECORD_ICONS[recordKey] ?? Star;
  const filled = recordKey === "longest_streak" || recordKey === "productive_week";
  return <Icon size={size} color={color} strokeWidth={2.2} fill={filled ? color : "none"} />;
}

export function AchievementGlyph({
  achievementId,
  size = 18,
  color = colors.primary,
}: GlyphProps & { achievementId: string }) {
  const Icon = ACHIEVEMENT_ICONS[achievementId] ?? Star;
  const filled =
    achievementId === "sessions_10" ||
    achievementId === "marathon_2h" ||
    achievementId === "first_session";
  return <Icon size={size} color={color} strokeWidth={2.2} fill={filled ? color : "none"} />;
}

export const glyphRowStyle = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
}).row;
