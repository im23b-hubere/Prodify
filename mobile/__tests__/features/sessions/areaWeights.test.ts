import {
  areaTimeSplit,
  areaWeightsPayload,
  reflectedAreas,
  setAreaWeight,
  toggleArea,
  weightOfArea,
} from "../../../features/sessions/areaWeights";
import {
  fitReflectionToSessionType,
  type FocusReflection,
} from "../../../features/sessions/skillFocusReflection";

const none: FocusReflection = { focusIds: [], primaryFocusId: null, areaWeights: {} };
const HOUR = 3600;

describe("reflectedAreas", () => {
  it("lists weighted areas and areas of touched focuses in catalog order", () => {
    const reflection: FocusReflection = {
      focusIds: ["mixing.eq"],
      primaryFocusId: null,
      areaWeights: { mastering: 1, beat_making: 3 },
    };

    expect(reflectedAreas(reflection)).toEqual(["beat_making", "mixing", "mastering"]);
  });
});

describe("toggleArea", () => {
  it("adds an area as some work", () => {
    const reflection = toggleArea(none, "mixing");

    expect(reflectedAreas(reflection)).toEqual(["mixing"]);
    expect(weightOfArea(reflection, "mixing")).toBe(2);
  });

  it("removes the area together with its focuses and star", () => {
    const reflection: FocusReflection = {
      focusIds: ["mixing.eq", "beat_making.drums"],
      primaryFocusId: "mixing.eq",
      areaWeights: { mixing: 3 },
    };

    expect(toggleArea(reflection, "mixing")).toEqual({
      focusIds: ["beat_making.drums"],
      primaryFocusId: null,
      areaWeights: {},
    });
  });
});

describe("setAreaWeight", () => {
  it("keeps the focuses of the area", () => {
    const reflection: FocusReflection = { ...none, focusIds: ["mixing.eq"] };

    const weighted = setAreaWeight(reflection, "mixing", 3);

    expect(weighted).toEqual({ ...reflection, areaWeights: { mixing: 3 } });
  });
});

describe("areaTimeSplit", () => {
  it("splits the session by weight like the skill tree does", () => {
    const reflection: FocusReflection = {
      ...none,
      areaWeights: { beat_making: 3, mixing: 2, mastering: 1 },
    };

    expect(areaTimeSplit(2 * HOUR, reflection)).toEqual([
      { branch: "beat_making", seconds: 3600 },
      { branch: "mixing", seconds: 2400 },
      { branch: "mastering", seconds: 1200 },
    ]);
  });

  it("is empty until an area is chosen", () => {
    expect(areaTimeSplit(2 * HOUR, none)).toEqual([]);
  });
});

describe("areaWeightsPayload", () => {
  it("sends every reflected area with its effective weight", () => {
    const reflection: FocusReflection = {
      focusIds: ["beat_making.drums"],
      primaryFocusId: null,
      areaWeights: { mixing: 1 },
    };

    expect(areaWeightsPayload(reflection)).toEqual([
      { branch: "beat_making", weight: 2 },
      { branch: "mixing", weight: 1 },
    ]);
  });
});

describe("fitReflectionToSessionType", () => {
  const production: FocusReflection = {
    focusIds: ["mixing.eq", "recording.room"],
    primaryFocusId: "recording.room",
    areaWeights: { mixing: 3, recording: 1 },
  };

  it("keeps everything for production sessions", () => {
    expect(fitReflectionToSessionType(production, "production")).toEqual(production);
  });

  it("drops area weights and foreign focuses for single-area sessions", () => {
    expect(fitReflectionToSessionType(production, "mixing")).toEqual({
      focusIds: ["mixing.eq"],
      primaryFocusId: null,
      areaWeights: {},
    });
  });
});
