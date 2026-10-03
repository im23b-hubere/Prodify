import { labelCounterScale } from "../../../features/skills/skillTreeLabelScale";

function onScreenRatio(cameraScale: number) {
  return cameraScale * labelCounterScale(cameraScale);
}

describe("labelCounterScale", () => {
  it("shows names at their designed size when the tree is at full size", () => {
    expect(onScreenRatio(1)).toBeCloseTo(1);
  });

  it("keeps names at their designed size instead of blowing them up when zoomed in", () => {
    expect(onScreenRatio(1.4)).toBeCloseTo(1);
  });

  it("shrinks names with the tree when zoomed out so neighbouring names never collide", () => {
    expect(onScreenRatio(0.6)).toBeCloseTo(0.6);
  });
});
