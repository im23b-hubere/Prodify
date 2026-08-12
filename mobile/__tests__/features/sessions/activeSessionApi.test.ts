import { apiJson } from "../../../lib/client";
import {
  fetchActiveSession,
  fetchLongestCompletedSessionSeconds,
  pauseActiveSession,
  resolveActiveSessionId,
  stopActiveSession,
  updateActiveSession,
} from "../../../features/sessions/services/activeSessionApi";

jest.mock("../../../lib/client", () => ({ apiJson: jest.fn() }));

const mockApiJson = apiJson as jest.MockedFunction<typeof apiJson>;
const session = {
  id: 7,
  user_id: 1,
  started_at: "2026-08-12T10:00:00Z",
  stopped_at: null,
  duration_seconds: null,
  session_type: "beat_making",
  notes: null,
};

describe("active session API", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("uses a valid requested id without querying the active-session endpoint", async () => {
    await expect(resolveActiveSessionId("token", "7")).resolves.toBe(7);
    expect(mockApiJson).not.toHaveBeenCalled();
  });

  it("resolves the active session when no id was requested", async () => {
    mockApiJson.mockResolvedValueOnce({ id: 9 });

    await expect(resolveActiveSessionId("token", undefined)).resolves.toBe(9);
    expect(mockApiJson).toHaveBeenCalledWith("/sessions/active", { token: "token" });
  });

  it("rejects invalid session payloads at the API boundary", async () => {
    mockApiJson.mockResolvedValueOnce({ id: 7 });

    await expect(fetchActiveSession("token", 7)).resolves.toBeNull();
  });

  it("calculates the longest completed session from valid rows", async () => {
    mockApiJson.mockResolvedValueOnce([
      { ...session, stopped_at: "2026-08-12T10:30:00Z", duration_seconds: 1800 },
      { ...session, id: 8, stopped_at: "2026-08-12T11:00:00Z", duration_seconds: 2400 },
      { ...session, id: 9, stopped_at: null, duration_seconds: null },
    ]);

    await expect(fetchLongestCompletedSessionSeconds("token")).resolves.toBe(2400);
  });

  it("maps session mutations to explicit endpoints", async () => {
    mockApiJson.mockResolvedValue(session);

    await pauseActiveSession("token", 7);
    await updateActiveSession("token", 7, { notes: "idea" });
    await stopActiveSession("token", 7);

    expect(mockApiJson).toHaveBeenNthCalledWith(1, "/sessions/item/7/pause", {
      token: "token",
      method: "POST",
    });
    expect(mockApiJson).toHaveBeenNthCalledWith(2, "/sessions/item/7", {
      token: "token",
      method: "PATCH",
      body: { notes: "idea" },
    });
    expect(mockApiJson).toHaveBeenNthCalledWith(3, "/sessions/stop", {
      token: "token",
      method: "POST",
      body: { session_id: 7 },
    });
  });
});
