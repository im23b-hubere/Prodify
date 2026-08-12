import {
  BookOpen,
  Disc3,
  Flame,
  Headphones,
  Mic2,
  Music2,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
  type LucideIcon,
} from "lucide-react-native";

import type { ProducerExperience, ProducerGenre, ProducerGoal } from "../../lib/onboardingQuiz";

export const WEEKLY_GOALS = [3, 5, 7, 10, 14] as const;
export const QUIZ_STEP_COUNT = 5;
export const INTRO_SLIDE_COUNT = 3;
export const ONBOARDING_VISUALS = [
  require("../../assets/onboarding/slide-2.png"),
  require("../../assets/onboarding/slide-1.png"),
  require("../../assets/onboarding/slide-3.png"),
] as const;

export type OnboardingStep =
  | "intro"
  | "experience"
  | "genre"
  | "producerGoal"
  | "weeklyGoal"
  | "plan";

export const EXPERIENCE_OPTIONS: {
  id: ProducerExperience;
  icon: LucideIcon;
  hintKey: string;
}[] = [
  { id: "under_1y", icon: Sparkles, hintKey: "onboarding.quiz.experience.hints.under_1y" },
  { id: "1_3y", icon: TrendingUp, hintKey: "onboarding.quiz.experience.hints.1_3y" },
  { id: "3_5y", icon: Music2, hintKey: "onboarding.quiz.experience.hints.3_5y" },
  { id: "5y_plus", icon: Trophy, hintKey: "onboarding.quiz.experience.hints.5y_plus" },
];

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
