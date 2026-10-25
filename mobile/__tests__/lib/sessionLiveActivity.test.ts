import { syncSessionLiveActivity } from "../../lib/sessionLiveActivity";
import type { SessionDto } from "../../types/session";
import SessionActivity from "../../widgets/SessionActivity";

jest.mock("../../widgets/SessionActivity", () => ({
  __esModule: true,
  default: { start: jest.fn(), getInstances: jest.fn(() => []) },
}));

const mockStart = SessionActivity.start as jest.Mock;
const mockGetInstances = SessionActivity.getInstances as jest.Mock;

function liveActivity() {
  return {
    update: jest.fn().mockResolvedValue(undefined),
    end: jest.fn().mockResolvedValue(undefined),
  };
}

const running: SessionDto = {
  id: 42,
  user_id: 7,
  started_at: "2026-08-12T10:00:00Z",
  stopped_at: null,
  duration_seconds: null,
  session_type: "mixing",
  notes: null,
  paused_duration_seconds: 0,
  pause_started_at: null,
};

const paused: SessionDto = { ...running, pause_started_at: "2026-08-12T10:30:00Z" };

describe("syncSessionLiveActivity", () => {
  beforeEach(() => {
    mockGetInstances.mockReturnValue([]);
    syncSessionLiveActivity(null);
    jest.clearAllMocks();
    mockGetInstances.mockReturnValue([]);
  });

  it("starts a Live Activity that opens the running session", () => {
    syncSessionLiveActivity(running);

    expect(mockStart).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: 42, isPaused: false }),
      "prodify://session/active",
    );
  });

  it("updates the Live Activity on screen instead of starting a second one", () => {
    const showing = liveActivity();
    mockGetInstances.mockReturnValue([showing]);

    syncSessionLiveActivity(paused);

    expect(showing.update).toHaveBeenCalledWith(expect.objectContaining({ isPaused: true }));
    expect(mockStart).not.toHaveBeenCalled();
  });

  it("skips the update when the session did not change", () => {
    const showing = liveActivity();
    mockGetInstances.mockReturnValue([showing]);

    syncSessionLiveActivity(running);
    syncSessionLiveActivity(running);

    expect(showing.update).toHaveBeenCalledTimes(1);
  });

  it("ends duplicate Live Activities left over from earlier runs", () => {
    const kept = liveActivity();
    const duplicate = liveActivity();
    mockGetInstances.mockReturnValue([kept, duplicate]);

    syncSessionLiveActivity(running);

    expect(duplicate.end).toHaveBeenCalledWith("immediate");
    expect(kept.end).not.toHaveBeenCalled();
  });

  it("ends every Live Activity once no session is running", () => {
    const first = liveActivity();
    const second = liveActivity();
    mockGetInstances.mockReturnValue([first, second]);

    syncSessionLiveActivity(null);

    expect(first.end).toHaveBeenCalledWith("immediate");
    expect(second.end).toHaveBeenCalledWith("immediate");
  });

  it("shows translated status and session type text", () => {
    syncSessionLiveActivity(running);
    syncSessionLiveActivity(null);
    syncSessionLiveActivity(paused);

    for (const [props] of mockStart.mock.calls) {
      expect(props.statusLabel).not.toMatch(/^sessionLiveActivity\./);
      expect(props.title).not.toMatch(/^sessionTypes\./);
    }
  });

  it("keeps the app working when Live Activities are turned off", () => {
    mockStart.mockImplementationOnce(() => {
      throw new Error("Live Activities are disabled");
    });

    expect(() => syncSessionLiveActivity(running)).not.toThrow();
  });
});
