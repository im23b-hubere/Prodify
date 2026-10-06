import { useEffect, useState } from "react";

import { effectiveElapsedSeconds } from "../../../lib/sessionTime";
import type { SessionDto } from "../../../types/session";

export function useActiveSessionClock(session: SessionDto | null) {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!session || session.pause_started_at) return;
    const tick = () => setNowMs(Date.now());
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [session?.id, session?.pause_started_at]);

  const elapsed = session ? effectiveElapsedSeconds(session, nowMs) : 0;
  return { elapsed, setNowMs };
}
