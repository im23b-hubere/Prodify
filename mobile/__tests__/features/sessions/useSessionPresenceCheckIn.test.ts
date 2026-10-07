import * as Haptics from "expo-haptics";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { Alert, AppState } from "react-native";

import { useSessionPresenceCheckIn } from "../../../features/sessions/hooks/useSessionPresenceCheckIn";
import {
  resetSessionPresenceStateForTests,
  SESSION_AUTO_STOP_SECONDS,
  SESSION_STILL_THERE_SECONDS,
} from "../../../lib/sessionPresence";
import { syncSessionPresenceNotifications } from "../../../lib/sessionPresenceNotifications";
import type { SessionDto } from "../../../types/session";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock("expo-haptics", () => ({
  notificationAsync: jest.fn(() => Promise.resolve()),
  NotificationFeedbackType: { Warning: "warning" },
}));

jest.mock("../../../lib/sessionPresenceNotifications", () => ({
  syncSessionPresenceNotifications: jest.fn(() => Promise.resolve()),
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

const stillThereSession: SessionDto = {
  ...runningSession,
  started_at: new Date(START_MS - SESSION_STILL_THERE_SECONDS * 1000).toISOString(),
};

const autoStopSession: SessionDto = {
  ...runningSession,
  started_at: new Date(START_MS - SESSION_AUTO_STOP_SECONDS * 1000).toISOString(),
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
  const endSession = jest.fn();
  const initialProps = {
    session: runningSession as SessionDto | null,
    sessionResolved: true,
    endSession,
    ...overrides,
  };
  const view = renderHook((props) => useSessionPresenceCheckIn(props), { initialProps });
  return { ...view, endSession };
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
  it("keeps the session running after the phone is off for a long time", async () => {
    const { endSession } = renderPresence();

    act(() => setAppState("background"));
    nowMs += 40 * 60 * 1000;
    act(() => setAppState("active"));
    await act(async () => undefined);

    expect(Alert.alert).not.toHaveBeenCalled();
    expect(endSession).not.toHaveBeenCalled();
  });

  it("skips while the session is paused", async () => {
    const { endSession } = renderPresence({
      session: { ...stillThereSession, pause_started_at: "2026-10-06T19:50:00.000Z" },
    });
    await act(async () => undefined);

    expect(Alert.alert).not.toHaveBeenCalled();
    expect(endSession).not.toHaveBeenCalled();
  });

  it("asks still-there after three hours without pausing", async () => {
    renderPresence({ session: stillThereSession });

    await waitFor(() => expect(Alert.alert).toHaveBeenCalledTimes(1));
    expect(Haptics.notificationAsync).toHaveBeenCalledTimes(1);
  });

  it("Continue keeps the session running", async () => {
    const { endSession, rerender } = renderPresence({ session: stillThereSession });
    await waitFor(() => expect(Alert.alert).toHaveBeenCalledTimes(1));

    const buttons = (Alert.alert as jest.Mock).mock.calls[0][2] as {
      text: string;
      onPress?: () => void;
    }[];
    act(() => buttons.find((button) => button.text === "sessionActive.stillThereContinue")?.onPress?.());

    rerender({
      session: stillThereSession,
      sessionResolved: true,
      endSession,
    });
    await act(async () => undefined);

    expect(endSession).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledTimes(1);
  });

  it("End stops the session from the latest callback", async () => {
    const firstEnd = jest.fn();
    const secondEnd = jest.fn();
    const { rerender } = renderPresence({ session: stillThereSession, endSession: firstEnd });
    await waitFor(() => expect(Alert.alert).toHaveBeenCalledTimes(1));

    rerender({
      session: stillThereSession,
      sessionResolved: true,
      endSession: secondEnd,
    });

    const buttons = (Alert.alert as jest.Mock).mock.calls[0][2] as {
      text: string;
      onPress?: () => void;
    }[];
    act(() => buttons.find((button) => button.text === "sessionActive.stillThereEnd")?.onPress?.());

    expect(secondEnd).toHaveBeenCalledTimes(1);
    expect(firstEnd).not.toHaveBeenCalled();
  });

  it("only one surface asks still-there", async () => {
    renderPresence({ session: stillThereSession });
    renderPresence({ session: stillThereSession });

    await waitFor(() => expect(Alert.alert).toHaveBeenCalledTimes(1));
  });

  it("stops after eight hours without an extra prompt", async () => {
    const { endSession } = renderPresence({ session: autoStopSession });

    await waitFor(() => expect(endSession).toHaveBeenCalledTimes(1));
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it("only one surface auto-stops", async () => {
    const first = renderPresence({ session: autoStopSession });
    const second = renderPresence({ session: autoStopSession });

    await waitFor(() =>
      expect(first.endSession.mock.calls.length + second.endSession.mock.calls.length).toBe(1),
    );
  });

  it("retries auto-stop if ending the session fails", async () => {
    const endSession = jest.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const { rerender } = renderPresence({ session: autoStopSession, endSession });

    await waitFor(() => expect(endSession).toHaveBeenCalledTimes(1));

    rerender({
      session: { ...autoStopSession },
      sessionResolved: true,
      endSession,
    });

    await waitFor(() => expect(endSession).toHaveBeenCalledTimes(2));
  });

  it("schedules local presence notifications while the session is running", async () => {
    renderPresence();
    await waitFor(() => expect(syncSessionPresenceNotifications).toHaveBeenCalledWith(runningSession));
  });
});
