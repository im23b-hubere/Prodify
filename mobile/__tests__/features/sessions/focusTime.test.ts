import {
  allocateSkillTime,
  areaTimeFromSkillTime,
  mainFocusId,
  unassignedSeconds,
  wheelCapSeconds,
} from "../../../features/sessions/focusTime";

const HOUR = 3600;
const NINETY_TWO_MIN = 92 * 60;

describe("allocateSkillTime", () => {
  it("credits exactly the assigned minutes", () => {
    expect(
      allocateSkillTime(NINETY_TWO_MIN, ["mixing.stereo", "mixing.eq"], {
        "mixing.stereo": 40 * 60,
        "mixing.eq": 20 * 60,
      }),
    ).toEqual({ "mixing.stereo": 40 * 60, "mixing.eq": 20 * 60 });
  });

  it("leaves unassigned minutes out of the tree", () => {
    const allocation = allocateSkillTime(NINETY_TWO_MIN, ["mixing.stereo", "mixing.eq"], {
      "mixing.stereo": 40 * 60,
      "mixing.eq": 20 * 60,
    });

    expect(unassignedSeconds(NINETY_TWO_MIN, allocation)).toBe(32 * 60);
  });

  it("gives zero to tapped focuses without minutes once any assignment exists", () => {
    expect(
      allocateSkillTime(NINETY_TWO_MIN, ["mixing.stereo", "mixing.eq", "mixing.space"], {
        "mixing.stereo": NINETY_TWO_MIN,
      }),
    ).toEqual({
      "mixing.stereo": NINETY_TWO_MIN,
      "mixing.eq": 0,
      "mixing.space": 0,
    });
  });

  it("treats an explicit zero as budget mode, not an even split", () => {
    expect(allocateSkillTime(HOUR, ["mixing.eq", "mixing.space"], { "mixing.eq": 0 })).toEqual({
      "mixing.eq": 0,
      "mixing.space": 0,
    });
  });

  it("splits evenly when nothing is assigned", () => {
    expect(allocateSkillTime(HOUR, ["mixing.eq", "mixing.space", "mixing.dynamics"])).toEqual({
      "mixing.eq": 1200,
      "mixing.space": 1200,
      "mixing.dynamics": 1200,
    });
  });

  it("earns nothing for a session under the counted minimum", () => {
    expect(allocateSkillTime(4 * 60, ["mixing.eq"], { "mixing.eq": 4 * 60 })).toEqual({});
  });

  it("never credits more than the counted duration", () => {
    expect(
      allocateSkillTime(HOUR, ["mixing.eq", "mixing.space"], {
        "mixing.eq": 50 * 60,
        "mixing.space": 50 * 60,
      }),
    ).toEqual({ "mixing.eq": 50 * 60, "mixing.space": 10 * 60 });
  });
});

describe("areaTimeFromSkillTime", () => {
  it("sums assigned focus time per area", () => {
    expect(
      areaTimeFromSkillTime({
        "mixing.eq": 40 * 60,
        "beat_making.drums": 20 * 60,
      }),
    ).toEqual([
      { branch: "beat_making", seconds: 20 * 60 },
      { branch: "mixing", seconds: 40 * 60 },
    ]);
  });
});

describe("mainFocusId", () => {
  it("is the unique longest assignment", () => {
    expect(mainFocusId({ "mixing.stereo": 40 * 60, "mixing.eq": 20 * 60 })).toBe("mixing.stereo");
    expect(mainFocusId({ "mixing.eq": 1800, "mixing.space": 1800 })).toBeNull();
    expect(mainFocusId({ "mixing.eq": 0 })).toBeNull();
  });
});

describe("wheelCapSeconds", () => {
  it("is this focus plus what is still unassigned", () => {
    const assigned = { "mixing.stereo": 40 * 60, "mixing.eq": 20 * 60 };

    expect(wheelCapSeconds(NINETY_TWO_MIN, assigned, "mixing.eq")).toBe(20 * 60 + 32 * 60);
    expect(wheelCapSeconds(NINETY_TWO_MIN, assigned, "mixing.space")).toBe(32 * 60);
  });
});
