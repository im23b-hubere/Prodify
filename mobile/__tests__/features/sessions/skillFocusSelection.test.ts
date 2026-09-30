import {
  focusesAllowedForSessionType,
  focusesInBranch,
  isFocusSelectionFull,
  toggleFocus,
} from "../../../features/sessions/skillFocusSelection";

describe("toggleFocus", () => {
  it("adds a focus while there is room", () => {
    expect(toggleFocus(["mixing.eq"], "mixing.dynamics")).toEqual(["mixing.eq", "mixing.dynamics"]);
  });

  it("removes a focus that is already selected", () => {
    expect(toggleFocus(["mixing.eq", "mixing.dynamics"], "mixing.eq")).toEqual(["mixing.dynamics"]);
  });

  it("ignores a new focus once the limit is reached", () => {
    expect(toggleFocus(["mixing.eq", "mixing.dynamics"], "mixing.space")).toEqual([
      "mixing.eq",
      "mixing.dynamics",
    ]);
  });
});

describe("isFocusSelectionFull", () => {
  it("is full at two focuses", () => {
    expect(isFocusSelectionFull(["mixing.eq"])).toBe(false);
    expect(isFocusSelectionFull(["mixing.eq", "mixing.dynamics"])).toBe(true);
  });
});

describe("focusesAllowedForSessionType", () => {
  it("keeps only focuses of the session type's branch", () => {
    expect(focusesAllowedForSessionType(["mixing.eq", "beat_making.drums"], "beat_making")).toEqual([
      "beat_making.drums",
    ]);
  });

  it("allows mixing and mastering focuses for mix & master", () => {
    expect(
      focusesAllowedForSessionType(["mixing.eq", "mastering.loudness", "recording.room"], "mix_and_master"),
    ).toEqual(["mixing.eq", "mastering.loudness"]);
  });

  it("allows every branch for learning", () => {
    expect(focusesAllowedForSessionType(["recording.room", "songwriting.hooks"], "learning")).toEqual([
      "recording.room",
      "songwriting.hooks",
    ]);
  });
});

describe("focusesInBranch", () => {
  it("filters focuses to one branch", () => {
    expect(focusesInBranch(["mixing.eq", "mastering.loudness"], "mastering")).toEqual([
      "mastering.loudness",
    ]);
  });
});
