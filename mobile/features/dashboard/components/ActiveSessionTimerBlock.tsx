import { useEffect, useMemo, useState } from "react";

import { ActiveSessionBlock } from "./ActiveSessionBlock";
import { effectiveElapsedSeconds } from "../../../lib/sessionTime";
import type { SessionDto } from "../../../types/session";

type Props = {
  active: SessionDto;
  onOpenFullscreen: () => void;
  onStopNow: () => void;
  onPause: () => void;
  onResume: () => void;
  stopBusy: boolean;
  pauseBusy: boolean;
  resumeBusy: boolean;
};

export function ActiveSessionTimerBlock({
  active,
  onOpenFullscreen,
  onStopNow,
  onPause,
  onResume,
  stopBusy,
  pauseBusy,
  resumeBusy,
}: Props) {
  const [nowMs, setNowMs] = useState(() => Date.now());

  const isPaused = !!active.pause_started_at;

  useEffect(() => {
    if (isPaused) return;
    const tick = () => setNowMs(Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [isPaused]);

  const activeSeconds = useMemo(() => effectiveElapsedSeconds(active, nowMs), [active, nowMs]);

  return (
    <ActiveSessionBlock
      active={active}
      activeSeconds={activeSeconds}
      isPaused={isPaused}
      onOpenFullscreen={onOpenFullscreen}
      onStopNow={onStopNow}
      onPause={onPause}
      onResume={onResume}
      stopBusy={stopBusy}
      pauseBusy={pauseBusy}
      resumeBusy={resumeBusy}
    />
  );
}
