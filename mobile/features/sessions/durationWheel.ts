import { countedSkillSeconds } from "./focusTime";

export const WHEEL_ROW_HEIGHT = 34;
export const WHEEL_VISIBLE_ROWS = 7;
export const WHEEL_HEIGHT = WHEEL_ROW_HEIGHT * WHEEL_VISIBLE_ROWS;

/** Radius of the drum the rows are printed on; three rows each way reach about 75°. */
const DRUM_RADIUS = 78;
/** How far the rows next to the centre fall back from full brightness. */
const NEIGHBOUR_DIMMING = 0.55;

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

/** The highest minute the drum may rest on with `hours` selected, so the total stays in the cap. */
export function minuteLimit(hours: number, maxMinutes: number): number {
  const lastMinute = showsHoursColumn(maxMinutes) ? 59 : maxMinutes;
  return Math.max(0, Math.min(lastMinute, maxMinutes - hours * 60));
}

/** The row under the selection band for a scroll offset. */
export function wheelIndexAt(offsetY: number, rowCount: number): number {
  "worklet";
  const index = Math.round(offsetY / WHEEL_ROW_HEIGHT);
  return Math.max(0, Math.min(rowCount - 1, index));
}

export type WheelRowPose = { rotateX: number; translateY: number; opacity: number };

/**
 * Where a row sits on the drum, `distance` rows away from the centre: tilted away (radians),
 * pulled in towards the centre as the drum curves, and dimmed until it turns out of sight.
 */
export function wheelRowPose(distance: number): WheelRowPose {
  "worklet";
  const angle = (distance * WHEEL_ROW_HEIGHT) / DRUM_RADIUS;
  if (Math.abs(angle) >= Math.PI / 2) {
    return { rotateX: -angle, translateY: 0, opacity: 0 };
  }
  const brightness = 1 - NEIGHBOUR_DIMMING * Math.min(Math.abs(distance), 1);
  return {
    rotateX: -angle,
    translateY: DRUM_RADIUS * Math.sin(angle) - distance * WHEEL_ROW_HEIGHT,
    opacity: Math.cos(angle) * brightness,
  };
}
