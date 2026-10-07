import { countedSkillSeconds } from "./focusTime";

export function countedMinutes(durationSeconds: number): number {
  return Math.floor(countedSkillSeconds(durationSeconds) / 60);
}

export function showsHoursColumn(maxMinutes: number): boolean {
  return maxMinutes >= 60;
}

export function durationParts(totalMinutes: number): { hours: number; minutes: number } {
  const safe = Math.max(0, Math.floor(totalMinutes));
  return { hours: Math.floor(safe / 60), minutes: safe % 60 };
}

export function clampDurationMinutes(totalMinutes: number, maxMinutes: number): number {
  return Math.max(0, Math.min(Math.floor(totalMinutes), maxMinutes));
}
