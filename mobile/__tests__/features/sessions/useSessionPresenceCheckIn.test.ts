import * as Haptics from "expo-haptics";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { Alert, AppState } from "react-native";

import { useSessionPresenceCheckIn } from "../../../features/sessions/hooks/useSessionPresenceCheckIn";
import {
  resetSessionPresenceStateForTests,
  SESSION_IDLE_AWAY_MS,
  SESSION_LONG_RUN_SECONDS,
} from "../../../lib/sessionPresence";
import type { SessionDto } from "../../../types/session";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock("expo-haptics", () => ({
  notificationAsync: jest.fn(() => Promise.resolve()),
  NotificationFeedbackType: { Warning: "warning" },
}));

const START_MS = Date.parse("2026-10-06T20:00:00.000Z");

const runningSession: SessionDto = {
  id: 7,
  user_id: 1,
  started_at: new Date(START_MS - 120_000).toISOString(),
  stopped_at: null,
  duration_seconds: null,
  session_type: "beat_making",
  notes: null,
  pause_started_at: null,
  paused_duration_seconds: 0,
};

const longRunSession: SessionDto = {
  ...runningSession,
  started_at: new Date(START_MS - SESSION_LONG_RUN_SECONDS * 1000).toISOString(),
};

type AppStateListener = (state: string) => void;

let listener: AppStateListener | undefined;
let nowMs = START_MS;

function setAppState(state: "active" | "background" | "inactive") {
  Object.defineProperty(AppState, "currentState", {
    configurable: true,
    writable: true,
    value: state,
  });
  listener?.(state);
}

function renderPresence(
  overrides: Partial<Parameters<typeof useSessionPresenceCheckIn>[0]> = {},
) {
  const pauseAt = jest.fn(async () => undefined);
  const resume = jest.fn(async () => undefined);
  const endSession = jest.fn();
  const initialProps = {
    session: runningSession as SessionDto | null,
    sessionResolved: true,
    pauseAt,
    resume,
    endSession,
    ...overrides,
  };
  const view = renderHook((props) => useSessionPresenceCheckIn(props), { initialProps });
  return { ...view, pauseAt, resume, endSession };
}

beforeEach(() => {
  resetSessionPresenceStateForTests();
  jest.clearAllMocks();
  listener = undefined;
  nowMs = START_MS;
  jest.spyOn(Date, "now").mockImplementation(() => nowMs);
  setAppState("active");
  jest.spyOn(AppState, "addEventListener").mockImplementation((_event, handler) => {
    listener = handler as AppStateListener;
    return { remove: jest.fn() } as never;
  });
  jest.spyOn(Alert, "alert").mockImplementation(jest.fn());
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("useSessionPresenceCheckIn", () => {
  it("pauses from leftAt and asks once after a long background trip", async () => {
    const { pauseAt } = renderPresence();
    const leftAt = nowMs;

    act(() => setAppState("background"));
    nowMs += SESSION_IDLE_AWAY_MS;
    act(() => setAppState("active"));

    await waitFor(() => expect(pauseAt).toHaveBeenCalledWith(leftAt));
    expect(pauseAt).toHaveBeenCalledTimes(1);
    expect(Alert.alert).toHaveBeenCalledTimes(1);
    expect(Haptics.notificationAsync).toHaveBeenCalledTimes(1);
  });

  it("does not pause after a short background trip", async () => {
    const { pauseAt } = renderPresence();

    act(() => setAppState("background"));
    nowMs += SESSION_IDLE_AWAY_MS - 1;
    act(() => setAppState("active"));
    await act(async () => undefined);

    expect(pauseAt).not.toHaveBeenCalled();
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it("skips check-in when the session is already paused", async () => {
    const { pauseAt } = renderPresence({
      session: { ...runningSession, pause_started_at: "2026-10-06T19:50:00.000Z" },
    });

    act(() => setAppState("background"));
    nowMs += SESSION_IDLE_AWAY_MS;
    act(() => setAppState("active"));
    await act(async () => undefined);

    expect(pauseAt).not.toHaveBeenCalled();
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it("only one surface pauses when dashboard and fullscreen both listen", async () => {
    const first = renderPresence();
    const second = renderPresence();
    const leftAt = nowMs;

    act(() => setAppState("background"));
    nowMs += SESSION_IDLE_AWAY_MS;
    act(() => setAppState("active"));

    await waitFor(() =>
      expect(first.pauseAt.mock.calls.length + second.pauseAt.mock.calls.length).toBe(1),
    );
    expect([...first.pauseAt.mock.calls, ...second.pauseAt.mock.calls][0][0]).toBe(leftAt);
    expect(Alert.alert).toHaveBeenCalledTimes(1);
  });

  it("pauses now after a long foreground run without leaving", async () => {
    const { pauseAt } = renderPresence({ session: longRunSession });

    await waitFor(() => expect(pauseAt).toHaveBeenCalledWith(START_MS));
    expect(Alert.alert).toHaveBeenCalledTimes(1);
  });

  it("does not repeat the long-run check-in after Continue", async () => {
    const { pauseAt, rerender, resume, endSession } = renderPresence({
      session: longRunSession,
    });
    await waitFor(() => expect(Alert.alert).toHaveBeenCalledTimes(1));

    const buttons = (Alert.alert as jest.Mock).mock.calls[0][2] as {
      text: string;
      onPress?: () => void;
    }[];
    act(() => buttons.find((button) => button.text === "sessionActive.stillThereContinue")?.onPress?.());

    rerender({
      session: longRunSession,
      sessionResolved: true,
      pauseAt,
      resume,
      endSession,
    });
    await act(async () => undefined);

    expect(resume).toHaveBeenCalledTimes(1);
    expect(pauseAt).toHaveBeenCalledTimes(1);
    expect(Alert.alert).toHaveBeenCalledTimes(1);
  });

  it("keeps leftAt while the session is still loading, then pauses from that moment", async () => {
    const pauseAt = jest.fn(async () => undefined);
    const resume = jest.fn(async () => undefined);
    const endSession = jest.fn();
    const { rerender } = renderHook(
      (props: Parameters<typeof useSessionPresenceCheckIn>[0]) => useSessionPresenceCheckIn(props),
      {
        initialProps: {
          session: null,
          sessionResolved: false,
          pauseAt,
          resume,
          endSession,
        },
      },
    );

    act(() => setAppState("background"));
    const leftAt = nowMs;
    nowMs += SESSION_IDLE_AWAY_MS;
    act(() => setAppState("active"));
    await act(async () => undefined);
    expect(pauseAt).not.toHaveBeenCalled();

    rerender({
      session: runningSession,
      sessionResolved: true,
      pauseAt,
      resume,
      endSession,
    });

    await waitFor(() => expect(pauseAt).toHaveBeenCalledWith(leftAt));
  });

  it("does not apply a leftover trip to a session started after return", async () => {
    const pauseAt = jest.fn(async () => undefined);
    const resume = jest.fn(async () => undefined);
    const endSession = jest.fn();
    const { rerender } = renderHook(
      (props: Parameters<typeof useSessionPresenceCheckIn>[0]) => useSessionPresenceCheckIn(props),
      {
        initialProps: {
          session: null,
          sessionResolved: true,
          pauseAt,
          resume,
          endSession,
        },
      },
    );

    act(() => setAppState("background"));
    nowMs += SESSION_IDLE_AWAY_MS;
    act(() => setAppState("active"));
    await act(async () => undefined);

    rerender({
      session: {
        ...runningSession,
        started_at: new Date(nowMs).toISOString(),
      },
      sessionResolved: true,
      pauseAt,
      resume,
      endSession,
    });
    await act(async () => undefined);

    expect(pauseAt).not.toHaveBeenCalled();
  });

  it("Continue uses the resume from after the session was paused", async () => {
    const firstResume = jest.fn();
    const secondResume = jest.fn();
    const { pauseAt, rerender, endSession } = renderPresence({ resume: firstResume });

    act(() => setAppState("background"));
    nowMs += SESSION_IDLE_AWAY_MS;
    act(() => setAppState("active"));
    await waitFor(() => expect(Alert.alert).toHaveBeenCalledTimes(1));

    rerender({
      session: runningSession,
      sessionResolved: true,
      pauseAt,
      resume: secondResume,
      endSession,
    });

    const buttons = (Alert.alert as jest.Mock).mock.calls[0][2] as {
      text: string;
      onPress?: () => void;
    }[];
    act(() =>
      buttons.find((button) => button.text === "sessionActive.stillThereContinue")?.onPress?.(),
    );

    expect(secondResume).toHaveBeenCalledTimes(1);
    expect(firstResume).not.toHaveBeenCalled();
  });

  it("does not ask if pausing the session fails", async () => {
    const pauseAt = jest.fn(async () => false);
    renderPresence({ pauseAt });

    act(() => setAppState("background"));
    nowMs += SESSION_IDLE_AWAY_MS;
    act(() => setAppState("active"));
    await waitFor(() => expect(pauseAt).toHaveBeenCalled());
    await act(async () => undefined);

    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it("still pauses from leftAt if a surface had no session while away", async () => {
    const pauseAt = jest.fn(async () => undefined);
    const resume = jest.fn(async () => undefined);
    const endSession = jest.fn();
    const { rerender } = renderHook(
      (props: Parameters<typeof useSessionPresenceCheckIn>[0]) => useSessionPresenceCheckIn(props),
      {
        initialProps: {
          session: null,
          sessionResolved: true,
          pauseAt,
          resume,
          endSession,
        },
      },
    );

    act(() => setAppState("background"));
    const leftAt = nowMs;
    nowMs += SESSION_IDLE_AWAY_MS;
    act(() => setAppState("active"));
    await act(async () => undefined);

    rerender({
      session: runningSession,
      sessionResolved: true,
      pauseAt,
      resume,
      endSession,
    });

    await waitFor(() => expect(pauseAt).toHaveBeenCalledWith(leftAt));
  });
});
