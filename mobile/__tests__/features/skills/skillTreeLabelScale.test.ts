import { areaFitCamera, overviewCamera } from "../../../features/skills/skillTreeCamera";
import { labelCounterScale, labelOpacity } from "../../../features/skills/skillTreeLabelScale";
import { SKILL_TREE_LAYOUT } from "../../../features/skills/skillTreeLayout";

const PHONE = { width: 390, height: 800 };

function onScreenRatio(cameraScale: number) {
  return cameraScale * labelCounterScale(cameraScale);
}

describe("labelCounterScale", () => {
  it("shows names at their designed size when the tree is at full size", () => {
    expect(onScreenRatio(1)).toBeCloseTo(1);
  });

  it("keeps names at their designed size instead of blowing them up when zoomed in", () => {
    expect(onScreenRatio(1.15)).toBeCloseTo(1);
  });

  it("shrinks names with the tree when zoomed out so neighbouring names never collide", () => {
    expect(onScreenRatio(0.6)).toBeCloseTo(0.6);
  });
});

describe("labelOpacity", () => {
  it("shows names when an area fills the phone and hides focus names in the overview", () => {
    const overview = overviewCamera(SKILL_TREE_LAYOUT, PHONE).scale;
    const area = areaFitCamera(SKILL_TREE_LAYOUT, "mixing", PHONE).scale;

    expect(labelOpacity(overview, "focus")).toBe(0);
    expect(labelOpacity(area, "focus")).toBe(1);
    expect(labelOpacity(area, "branch")).toBe(1);
  });
});
