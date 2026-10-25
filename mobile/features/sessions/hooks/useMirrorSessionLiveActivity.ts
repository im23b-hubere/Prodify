import { useEffect } from "react";

import { syncSessionLiveActivity } from "../../../lib/sessionLiveActivity";
import type { SessionDto } from "../../../types/session";

/**
 * Keeps the Live Activity in step with the session open on screen. A null session means the
 * screen failed to load it, not that it ended, so the Live Activity stays; stopping ends it.
 */
export function useMirrorSessionLiveActivity(session: SessionDto | null) {
  useEffect(() => {
    if (session) syncSessionLiveActivity(session);
  }, [session]);
}
