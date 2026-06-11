import { HEATMAP_CELL_COLORS, heatmapCellColor } from "../../lib/heatmapStyle";

describe("heatmapCellColor", () => {
  it("maps intensity levels 0–4 to the orange scale", () => {
    expect(heatmapCellColor(0)).toBe(HEATMAP_CELL_COLORS[0]);
    expect(heatmapCellColor(4)).toBe(HEATMAP_CELL_COLORS[4]);
  });

  it("uses brighter colors for higher intensity", () => {
    expect(heatmapCellColor(0)).toBe(HEATMAP_CELL_COLORS[0]);
    expect(heatmapCellColor(4)).toBe(HEATMAP_CELL_COLORS[4]);
    expect(heatmapCellColor(4)).not.toBe(heatmapCellColor(0));
  });
});
