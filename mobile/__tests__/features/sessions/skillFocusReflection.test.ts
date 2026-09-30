import { focusesForBranch } from "../../../constants/skills";
import {
  isFullPass,
  isSameReflection,
  restrictToBranches,
  toggleFullPass,
  toggleMainFocus,
  toggleTouchedFocus,
  type FocusReflection,
} from "../../../features/sessions/skillFocusReflection";

const none: FocusReflection = { focusIds: [], primaryFocusId: null };
const mixingIds = focusesForBranch("mixing").map(({ id }) => id);

describe("toggleTouchedFocus", () => {
  it("adds any number of touched focuses", () => {
    const reflection = mixingIds.reduce(toggleTouchedFocus, none);

    expect(reflection.focusIds).toEqual(mixingIds);
  });

  it("removes the star together with its focus", () => {
    const starred = toggleMainFocus(none, "mixing.eq");

    expect(toggleTouchedFocus(starred, "mixing.eq")).toEqual(none);
  });
});

describe("toggleMainFocus", () => {
  it("marks an untouched focus as touched and main", () => {
    expect(toggleMainFocus(none, "mixing.eq")).toEqual({
      focusIds: ["mixing.eq"],
      primaryFocusId: "mixing.eq",
    });
  });

  it("moves the star instead of keeping two main focuses", () => {
    const first = toggleMainFocus(none, "mixing.eq");

    expect(toggleMainFocus(first, "mixing.space").primaryFocusId).toBe("mixing.space");
  });

  it("unstars the main focus but keeps it touched", () => {
    const starred = toggleMainFocus(none, "mixing.eq");

    expect(toggleMainFocus(starred, "mixing.eq")).toEqual({
      focusIds: ["mixing.eq"],
      primaryFocusId: null,
    });
  });
});

describe("toggleFullPass", () => {
  it("selects the whole branch and keeps the main focus", () => {
    const starred = toggleMainFocus(none, "mixing.dynamics");

    const fullPass = toggleFullPass(starred, "mixing");

    expect(isFullPass(fullPass.focusIds, "mixing")).toBe(true);
    expect(fullPass.primaryFocusId).toBe("mixing.dynamics");
  });

  it("clears the branch when it is already complete", () => {
    const fullPass = toggleFullPass(none, "mixing");

    expect(toggleFullPass(fullPass, "mixing")).toEqual(none);
  });

  it("leaves focuses of other branches untouched", () => {
    const withMastering = toggleTouchedFocus(none, "mastering.loudness");

    const cleared = toggleFullPass(toggleFullPass(withMastering, "mixing"), "mixing");

    expect(cleared.focusIds).toEqual(["mastering.loudness"]);
  });
});

describe("restrictToBranches", () => {
  it("hides focuses and the star from other branches", () => {
    const reflection: FocusReflection = {
      focusIds: ["mixing.eq", "recording.room"],
      primaryFocusId: "recording.room",
    };

    expect(restrictToBranches(reflection, ["mixing"])).toEqual({
      focusIds: ["mixing.eq"],
      primaryFocusId: null,
    });
  });
});

describe("isSameReflection", () => {
  it("ignores the order of focuses", () => {
    expect(
      isSameReflection(
        { focusIds: ["mixing.eq", "mixing.space"], primaryFocusId: null },
        { focusIds: ["mixing.space", "mixing.eq"], primaryFocusId: null },
      ),
    ).toBe(true);
  });

  it("treats a different main focus as a change", () => {
    expect(
      isSameReflection(
        { focusIds: ["mixing.eq"], primaryFocusId: "mixing.eq" },
        { focusIds: ["mixing.eq"], primaryFocusId: null },
      ),
    ).toBe(false);
  });
});
