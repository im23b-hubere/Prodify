export const TEMPLATE_IDS = ['photo', 'transparent', 'mono', 'timeline', 'isometric', 'echo'] as const;
export type TemplateId = typeof TEMPLATE_IDS[number];

export interface SessionActivity {
  label: string;
  /** Active, non-overlapping seconds. Do not pass XP or an estimate. */
  durationSeconds: number;
}

export interface SessionData {
  id: string;
  producerName: string;
  /** Already formatted in the user's timezone, e.g. '07 OCT 2026'. */
  dateLabel: string;
  /** Total active production time, excluding pauses. */
  durationSeconds: number;
  activities: readonly SessionActivity[];
  /** Omit when unknown. Never infer a streak from the single session. */
  streakDays?: number;
}

export interface CardOptions {
  template: TemplateId;
  accent?: string;
  /** @deprecated Use displayFont and bodyFont. Kept so older callers still compile. */
  fontFamily?: string;
  /** Syne on export; Syne_700Bold inside the Expo app. */
  displayFont?: string;
  /** DM Sans Regular. */
  bodyFont?: string;
  /** DM Sans Medium. Fontsource ships this as its own family name. */
  bodyMediumFont?: string;
  showActivities?: boolean;
  showStreak?: boolean;
  showIdentity?: boolean;
  photoPosition?: 'top' | 'bottom';
  /** Mono only: black card with white type, or a warm white card with dark type. */
  monoTheme?: 'dark' | 'light';
}
