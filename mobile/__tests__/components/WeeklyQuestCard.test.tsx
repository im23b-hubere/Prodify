import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import type { TFunction } from "i18next";

import { WeeklyQuestCard } from "../../components/studio/WeeklyQuestCard";
import type { SessionFeedbackComputed } from "../../lib/sessionFeedbackEngine";

jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn().mockResolvedValue(undefined),
  selectionAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Light: "Light" },
}));

const t = ((key: string, options?: Record<string, unknown>) =>
  options ? `${key}:${JSON.stringify(options)}` : key) as unknown as TFunction;

const feedback = {
  remainingSessionsToGoal: 2,
  progressPercent: 40,
  newStatus: "on_track",
} as SessionFeedbackComputed;

describe("WeeklyQuestCard", () => {
  it("saves a selected setup target", async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    render(<WeeklyQuestCard mode="setup" t={t} onSave={onSave} />);

    fireEvent.press(screen.getByLabelText('dashboard.weeklyGoalChipA11y:{"count":5}'));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(5));
  });

  it("edits and closes the progress target picker after saving", async () => {
    const onChangeTarget = jest.fn().mockResolvedValue(undefined);
    render(
      <WeeklyQuestCard
        mode="progress"
        t={t}
        feedback={feedback}
        weekSessionsCount={2}
        weeklyGoalTarget={5}
        paceForecast={null}
        onChangeTarget={onChangeTarget}
      />,
    );

    fireEvent.press(screen.getByLabelText("dashboard.weeklyGoalEdit"));
    const sevenChoice = 'dashboard.weeklyGoalChipA11y:{"count":7}';
    fireEvent.press(screen.getByLabelText(sevenChoice));
    await waitFor(() => expect(onChangeTarget).toHaveBeenCalledWith(7));
    await waitFor(() => expect(screen.queryByLabelText(sevenChoice)).toBeNull());
  });
});
