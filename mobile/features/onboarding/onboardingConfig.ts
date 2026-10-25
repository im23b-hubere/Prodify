import {
  BookOpen,
  Disc3,
  Flame,
  Headphones,
  Mic2,
  Music2,
  Target,
  TrendingUp,
  type LucideIcon,
} from "lucide-react-native";

import type { ProducerGenre, ProducerGoal } from "../../lib/onboardingQuiz";

export const WEEKLY_GOALS = [3, 5, 7, 10, 14] as const;

/**
 * How a weekly target spreads over Monday–Sunday: every day gets the same base, and the rest
 * go to weekdays, evenly spaced (3 → Mon/Wed/Fri, 5 → Mon–Fri, 10 → every day + Mon/Wed/Fri).
 * Raising the target only ever adds sessions, so the week grows instead of reshuffling.
 */
export function sessionsPerWeekday(weeklyGoal: number): number[] {
  const base = Math.floor(weeklyGoal / 7);
  const extra = weeklyGoal % 7;
  const days = Array.from({ length: 7 }, () => base);
  if (extra === 0) return days;
  if (extra > 5) {
    for (let day = 0; day < extra; day += 1) days[day]! += 1;
    return days;
  }
  for (let index = 0; index < extra; index += 1) {
    const day = extra === 1 ? 0 : Math.round((index * 4) / (extra - 1));
    days[day]! += 1;
  }
  return days;
}
export const INTRO_SLIDE_COUNT = 3;
/** The looping app recording above each intro slide's text, in slide order. */
export const ONBOARDING_VIDEOS: readonly number[] = [
  require("../../assets/onboarding/demo_01.mp4"),
  require("../../assets/onboarding/demo_02.mp4"),
  require("../../assets/onboarding/demo_03.mp4"),
];

export const QUIZ_STEPS = ["experience", "genre", "producerGoal", "weeklyGoal"] as const;

/** After the quiz, "building" plays the profile animation while the answers are saved. */
export type OnboardingStep = "intro" | (typeof QUIZ_STEPS)[number] | "building";

export const GENRE_OPTIONS: { id: ProducerGenre; icon: LucideIcon }[] = [
  { id: "hip_hop", icon: Mic2 },
  { id: "edm", icon: Disc3 },
  { id: "pop", icon: Headphones },
  { id: "other", icon: Music2 },
];

export const PRODUCER_GOAL_OPTIONS: { id: ProducerGoal; icon: LucideIcon }[] = [
  { id: "more_output", icon: TrendingUp },
  { id: "consistency", icon: Flame },
  { id: "finish_tracks", icon: Target },
  { id: "learn_skills", icon: BookOpen },
];
