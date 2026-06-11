/** Discrete activity levels 0–4 — empty (dark) → brighter orange = more time. */
export const HEATMAP_CELL_COLORS = [
  "#1a1a1a",
  "#4a2a1c",
  "#8c3a18",
  "#d14a12",
  "#FF3D00",
] as const;

export function heatmapCellColor(intensity: number): string {
  const level = Math.max(0, Math.min(4, Math.floor(intensity)));
  return HEATMAP_CELL_COLORS[level] ?? HEATMAP_CELL_COLORS[0];
}
