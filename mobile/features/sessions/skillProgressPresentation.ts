import type { SkillProgressDto } from "../../types/skillProgress";

export type SkillProgressView = {
  gainedMinutes: number;
  level: number;
  isLevelUp: boolean;
  /** Bar fill before this session, 0–1 within the current level. */
  fromFraction: number;
  /** Bar fill after this session, 0–1 within the current level. */
  toFraction: number;
  /** Null once the top level is reached. */
  secondsToNextLevel: number | null;
};

export function levelFraction(seconds: number, levelStart: number, nextLevel: number | null): number {
  if (nextLevel === null) return 1;
  const span = nextLevel - levelStart;
  if (span <= 0) return 1;
  return Math.min(1, Math.max(0, (seconds - levelStart) / span));
}

/** New level after this session, or null if the focus did not level up. */
export function leveledUpTo(progress: SkillProgressDto | undefined): number | null {
  if (!progress || progress.level <= progress.previous_level) return null;
  return progress.level;
}

export function skillProgressView(progress: SkillProgressDto): SkillProgressView {
  const { total_seconds, gained_seconds, level_start_seconds, next_level_seconds } = progress;
  const isLevelUp = progress.level > progress.previous_level;
  return {
    gainedMinutes: Math.round(gained_seconds / 60),
    level: progress.level,
    isLevelUp,
    fromFraction: isLevelUp
      ? 0
      : levelFraction(total_seconds - gained_seconds, level_start_seconds, next_level_seconds),
    toFraction: levelFraction(total_seconds, level_start_seconds, next_level_seconds),
    secondsToNextLevel:
      next_level_seconds === null ? null : Math.max(0, next_level_seconds - total_seconds),
  };
}

/** Compact duration for tight tiles, e.g. "45m" or "1h 20m". */
export function formatCompactDuration(totalSeconds: number): string {
  const minutes = Math.max(0, Math.round(totalSeconds / 60));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${minutes}m`;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}
