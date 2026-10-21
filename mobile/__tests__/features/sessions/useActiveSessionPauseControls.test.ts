import { act, renderHook } from "@testing-library/react-native";

import { useActiveSessionPauseControls } from "../../../features/sessions/hooks/useActiveSessionPauseControls";
import { resumeActiveSession } from "../../../features/sessions/services/activeSessionApi";
import { ApiError } from "../../../lib/apiErrors";
import type { SessionDto } from "../../../types/session";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Medium: "medium" },
}));

jest.mock("../../../features/sessions/services/activeSessionApi", () => ({
  pauseActiveSession: jest.fn(),
  resumeActiveSession: jest.fn(),
}));

const pausedSession: SessionDto = {
  id: 9,
  user_id: 1,
  started_at: "2026-10-06T12:00:00.000Z",
  stopped_at: null,
  duration_seconds: null,
  session_type: "beat_making",
  notes: null,
  pause_started_at: "2026-10-06T12:20:00.000Z",
  paused_duration_seconds: 0,
};

describe("useActiveSessionPauseControls", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("reloads instead of restoring a paused session that the server already stopped", async () => {
    jest.mocked(resumeActiveSession).mockRejectedValue(new ApiError(400, "Session already stopped"));
    const setSession = jest.fn();
    const setError = jest.fn();
    const onStaleSession = jest.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useActiveSessionPauseControls({
        token: "token",
        session: pausedSession,
        setSession,
        setError,
        setNowMs: jest.fn(),
        onStaleSession,
      }),
    );

    await act(async () => {
      await result.current.resume();
    });

    expect(onStaleSession).toHaveBeenCalledTimes(1);
    expect(setError).not.toHaveBeenCalled();
    expect(setSession).not.toHaveBeenCalledWith(pausedSession);
  });
});
