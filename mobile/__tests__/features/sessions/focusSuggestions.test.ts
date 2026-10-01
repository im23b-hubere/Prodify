import { focusesForBranch, type SkillFocusId } from "../../../constants/skills";
import {
  LEVEL_UP_WITHIN_SECONDS,
  suggestFocuses,
} from "../../../features/sessions/focusSuggestions";
import {
  NEGLECTED_AFTER_DAYS,
  buildSkillTreeModel,
  type SkillNodeState,
} from "../../../features/skills/skillTreePresentation";

const NOW = new Date("2026-09-30T12:00:00Z");
const DAY_MS = 24 * 60 * 60 * 1000;
const MINUTE = 60;

function daysAgo(days: number) {
  return new Date(NOW.getTime() - days * DAY_MS).toISOString();
}

/** Unlocked focuses default to "nothing special": far from a level-up, trained ten days ago. */
function modelWith(focuses: Partial<Record<SkillFocusId, Partial<SkillNodeState>>>) {
  const model = buildSkillTreeModel(null);
  for (const [id, state] of Object.entries(focuses) as [SkillFocusId, Partial<SkillNodeState>][]) {
    model.focuses[id] = {
      isUnlocked: true,
      level: 2,
      levelFraction: 0.2,
      totalSeconds: 3600,
      sessionCount: 1,
      secondsToNextLevel: 3 * 3600,
      lastTrainedAt: daysAgo(10),
      ...state,
    };
  }
  return model;
}

function summary(model: ReturnType<typeof modelWith>, type: Parameters<typeof suggestFocuses>[1]) {
  return suggestFocuses(model, type, NOW).map(({ id, reason }) => `${reason}:${id}`);
}

describe("suggestFocuses", () => {
  it("invites a new producer to discover the first skills of the area", () => {
    expect(summary(modelWith({}), "mixing")).toEqual([
      "discover:mixing.balance",
      "discover:mixing.eq",
    ]);
  });

  it("lets each area of a combined session offer a skill to discover", () => {
    expect(summary(modelWith({}), "mix_and_master")).toEqual([
      "discover:mixing.balance",
      `discover:${focusesForBranch("mastering")[0].id}`,
    ]);
  });

  it("puts the skill closest to its next level first", () => {
    const model = modelWith({
      "mixing.eq": { secondsToNextLevel: 30 * MINUTE },
      "mixing.dynamics": { secondsToNextLevel: 10 * MINUTE, level: 3 },
    });

    expect(suggestFocuses(model, "mixing", NOW)[0]).toEqual({
      id: "mixing.dynamics",
      reason: "levelUp",
      secondsToNextLevel: 10 * MINUTE,
      nextLevel: 4,
    });
  });

  it("ignores level-ups that need more than a session and skills at the top level", () => {
    const model = modelWith({
      "mixing.eq": { secondsToNextLevel: LEVEL_UP_WITHIN_SECONDS + MINUTE },
      "mixing.dynamics": { secondsToNextLevel: null },
    });

    expect(summary(model, "mixing").some((entry) => entry.startsWith("levelUp"))).toBe(false);
  });

  it("brings back the skill that has rested longest", () => {
    const model = modelWith({
      "mixing.eq": { lastTrainedAt: daysAgo(NEGLECTED_AFTER_DAYS) },
      "mixing.space": { lastTrainedAt: daysAgo(40) },
    });

    expect(suggestFocuses(model, "mixing", NOW)[0]).toEqual({
      id: "mixing.space",
      reason: "resting",
      days: 40,
    });
  });

  it("keeps the most recently trained skill going", () => {
    const model = modelWith({
      "mixing.eq": { lastTrainedAt: daysAgo(5) },
      "mixing.space": { lastTrainedAt: daysAgo(1), level: 3 },
    });

    expect(suggestFocuses(model, "mixing", NOW)[0]).toEqual({
      id: "mixing.space",
      reason: "keepGoing",
      level: 3,
    });
  });

  it("prefers two different reasons over the second-best of one reason", () => {
    const model = modelWith({
      "mixing.eq": { secondsToNextLevel: 10 * MINUTE },
      "mixing.dynamics": { secondsToNextLevel: 20 * MINUTE },
      "mixing.saturation": { lastTrainedAt: daysAgo(30) },
    });

    expect(summary(model, "mixing")).toEqual(["levelUp:mixing.eq", "resting:mixing.saturation"]);
  });

  it("repeats a reason before falling back to discovering new skills", () => {
    const model = modelWith({
      "mixing.eq": { secondsToNextLevel: 10 * MINUTE },
      "mixing.dynamics": { secondsToNextLevel: 20 * MINUTE },
    });

    expect(summary(model, "mixing")).toEqual(["levelUp:mixing.eq", "levelUp:mixing.dynamics"]);
  });

  it("never suggests the same skill twice", () => {
    const model = modelWith({
      "mixing.eq": { secondsToNextLevel: 10 * MINUTE, lastTrainedAt: daysAgo(1) },
      "mixing.space": { lastTrainedAt: daysAgo(2) },
    });

    expect(summary(model, "mixing")).toEqual(["levelUp:mixing.eq", "keepGoing:mixing.space"]);
  });

  it("only suggests skills the session type can train", () => {
    const model = modelWith({ "mixing.eq": { secondsToNextLevel: 10 * MINUTE } });

    expect(summary(model, "beat_making").every((entry) => entry.includes("beat_making."))).toBe(
      true,
    );
  });

  it("looks across every area for learning sessions", () => {
    const model = modelWith({
      "mixing.eq": { secondsToNextLevel: 10 * MINUTE },
      "recording.room": { lastTrainedAt: daysAgo(20) },
    });

    expect(summary(model, "learning")).toEqual(["levelUp:mixing.eq", "resting:recording.room"]);
  });
});
