import {
  addCreditedFocus,
  ensureCredited,
  remainingFocuses,
  removeCreditedFocus,
  setCreditedSeconds,
} from "../../../features/sessions/creditList";
import type { FocusReflection } from "../../../features/sessions/skillFocusReflection";

const NINETY_TWO_MIN = 92 * 60;
const empty: FocusReflection = { focusIds: [], primaryFocusId: null, areaWeights: {} };

describe("credit list", () => {
  it("even-splits a 92 minute session across two focuses", () => {
    const credited = addCreditedFocus(
      addCreditedFocus(empty, "mixing.stereo", NINETY_TWO_MIN),
      "mixing.eq",
      NINETY_TWO_MIN,
    );

    expect(credited.focusIds).toEqual(["mixing.stereo", "mixing.eq"]);
    expect(credited.assignedSeconds).toEqual({
      "mixing.stereo": 46 * 60,
      "mixing.eq": 46 * 60,
    });
  });

  it("rebalances the other rows when one focus takes 60 of 92 minutes", () => {
    const split = addCreditedFocus(
      addCreditedFocus(empty, "mixing.stereo", NINETY_TWO_MIN),
      "mixing.eq",
      NINETY_TWO_MIN,
    );

    expect(setCreditedSeconds(split, "mixing.eq", 60 * 60, NINETY_TWO_MIN).assignedSeconds).toEqual({
      "mixing.stereo": 32 * 60,
      "mixing.eq": 60 * 60,
    });
  });

  it("gives the whole session to the last remaining focus", () => {
    const split = addCreditedFocus(
      addCreditedFocus(empty, "mixing.stereo", NINETY_TWO_MIN),
      "mixing.eq",
      NINETY_TWO_MIN,
    );

    expect(removeCreditedFocus(split, "mixing.stereo", NINETY_TWO_MIN)).toEqual({
      ...empty,
      focusIds: ["mixing.eq"],
      assignedSeconds: { "mixing.eq": NINETY_TWO_MIN },
    });
  });

  it("clears assigned time when the list is empty", () => {
    const onlyEq = addCreditedFocus(empty, "mixing.eq", NINETY_TWO_MIN);

    expect(removeCreditedFocus(onlyEq, "mixing.eq", NINETY_TWO_MIN)).toEqual({
      focusIds: [],
      primaryFocusId: null,
      areaWeights: {},
      assignedSeconds: {},
    });
  });

  it("fills planned focuses with an even split when nothing was assigned yet", () => {
    expect(
      ensureCredited(
        { ...empty, focusIds: ["mixing.stereo", "mixing.eq"] },
        NINETY_TWO_MIN,
      ).assignedSeconds,
    ).toEqual({
      "mixing.stereo": 46 * 60,
      "mixing.eq": 46 * 60,
    });
  });

  it("leaves stored assigned minutes alone", () => {
    const stored = {
      ...empty,
      focusIds: ["mixing.eq"],
      assignedSeconds: { "mixing.eq": 20 * 60 },
    };

    expect(ensureCredited(stored, NINETY_TWO_MIN)).toBe(stored);
  });

  it("lists leftover focuses for the session type, skipping ones already on the list", () => {
    const groups = remainingFocuses("beat_making", ["beat_making.drums"]);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.branch).toBe("beat_making");
    expect(groups[0]?.ids).not.toContain("beat_making.drums");
    expect(groups[0]?.ids).toContain("beat_making.groove");
  });
});
