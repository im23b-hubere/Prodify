import { renderHook } from "@testing-library/react-native";

import { useMirrorSessionLiveActivity } from "../../../features/sessions/hooks/useMirrorSessionLiveActivity";
import { syncSessionLiveActivity } from "../../../lib/sessionLiveActivity";
import type { SessionDto } from "../../../types/session";

jest.mock("../../../lib/sessionLiveActivity", () => ({ syncSessionLiveActivity: jest.fn() }));

const running: SessionDto = {
  id: 42,
  user_id: 7,
  started_at: "2026-08-12T10:00:00Z",
  stopped_at: null,
  duration_seconds: null,
  session_type: "mixing",
  notes: null,
};

const renderMirror = (session: SessionDto | null) =>
  renderHook(
    ({ session: current }: { session: SessionDto | null }) =>
      useMirrorSessionLiveActivity(current),
    { initialProps: { session } },
  );

describe("useMirrorSessionLiveActivity", () => {
  beforeEach(() => jest.clearAllMocks());

  it("mirrors every change of the open session", () => {
    const paused = { ...running, pause_started_at: "2026-08-12T10:30:00Z" };
    const { rerender } = renderMirror(running);

    rerender({ session: paused });

    expect(syncSessionLiveActivity).toHaveBeenNthCalledWith(1, running);
    expect(syncSessionLiveActivity).toHaveBeenNthCalledWith(2, paused);
  });

  it("keeps the Live Activity when the screen loses the session to a load error", () => {
    const { rerender } = renderMirror(running);

    rerender({ session: null });

    expect(syncSessionLiveActivity).toHaveBeenCalledTimes(1);
  });
});
