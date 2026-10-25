import { act, renderHook } from "@testing-library/react-native";
import { Alert } from "react-native";

import { useStartSession } from "../../../features/sessions/hooks/useStartSession";
import { ApiError, apiJson } from "../../../lib/client";
import { mockTFunction } from "../../helpers/mockTFunction";

jest.mock("expo-haptics", () => ({
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  NotificationFeedbackType: { Success: "success", Error: "error" },
}));

jest.mock("../../../lib/client", () => {
  const actual = jest.requireActual("../../../lib/client");
  return { ...actual, apiJson: jest.fn() };
});

const mockApiJson = apiJson as jest.MockedFunction<typeof apiJson>;

const runningSession = {
  id: 9,
  user_id: 1,
  started_at: "2026-10-22T12:00:00Z",
  stopped_at: null,
  duration_seconds: null,
  session_type: "mixing",
  notes: null,
};

function startArgs(overrides: Partial<Parameters<typeof useStartSession>[0]> = {}) {
  return {
    token: "token",
    hydrated: true,
    selectedType: "mixing" as const,
    notes: "",
    mood: null,
    tags: [],
    skillFocusIds: [],
    suggestedFocusIds: [],
    t: mockTFunction(),
    onStarted: jest.fn(),
    onConflict: jest.fn(),
    ...overrides,
  };
}

describe("useStartSession", () => {
  beforeEach(() => {
    mockApiJson.mockReset();
    jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
  });

  it("opens the existing session after a 409 without an error dialog", async () => {
    const args = startArgs();
    mockApiJson
      .mockRejectedValueOnce(new ApiError(409, "active", { detail: { session_id: 9 } }))
      .mockResolvedValueOnce(runningSession);
    const { result } = renderHook(() => useStartSession(args));

    await act(async () => {
      await result.current.submit();
    });

    expect(Alert.alert).not.toHaveBeenCalled();
    expect(args.onStarted).toHaveBeenCalledWith(expect.objectContaining({ id: 9 }));
    expect(args.onConflict).not.toHaveBeenCalled();
    expect(result.current.error).toBeNull();
  });

  it("opens the session named in the server conflict envelope", async () => {
    const args = startArgs();
    mockApiJson
      .mockRejectedValueOnce(
        new ApiError(409, "Active session already exists", {
          error: {
            code: "ERROR_409",
            message: "Active session already exists",
            details: { session_id: 9 },
          },
        }),
      )
      .mockResolvedValueOnce(runningSession);
    const { result } = renderHook(() => useStartSession(args));

    await act(async () => {
      await result.current.submit();
    });

    expect(mockApiJson).toHaveBeenLastCalledWith("/sessions/item/9", { token: "token" });
    expect(args.onStarted).toHaveBeenCalledWith(expect.objectContaining({ id: 9 }));
    expect(result.current.error).toBeNull();
  });

  it("opens the known session when a 409 names an id the follow-up read misses", async () => {
    const args = startArgs();
    mockApiJson
      .mockRejectedValueOnce(new ApiError(409, "active", { session_id: 9 }))
      .mockRejectedValueOnce(new Error("missing"));
    const { result } = renderHook(() => useStartSession(args));

    await act(async () => {
      await result.current.submit();
    });

    expect(Alert.alert).not.toHaveBeenCalled();
    expect(args.onConflict).toHaveBeenCalledWith(9);
    expect(args.onStarted).not.toHaveBeenCalled();
    expect(result.current.error).toBeNull();
  });
});
