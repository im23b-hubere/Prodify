import { useEffect, useMemo, useState } from "react";
import { useSharedValue, withRepeat, withSequence, withTiming } from "react-native-reanimated";

import { ActiveSessionBlock } from "./ActiveSessionBlock";
import { effectiveElapsedSeconds } from "../../../lib/sessionTime";
import type { SessionDto } from "../../../types/session";

type Props = {
  active: SessionDto;
  onOpenFullscreen: () => void;
  onConfirmStop: () => void;
  stopBusy: boolean;
};

export function ActiveSessionTimerBlock({
  active,
  onOpenFullscreen,
  onConfirmStop,
  stopBusy,
}: Props) {
  const [nowMs, setNowMs] = useState(Date.now());
  const ringPulse = useSharedValue(1);

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    ringPulse.value = withRepeat(
      withSequence(withTiming(1.06, { duration: 1100 }), withTiming(1, { duration: 1100 })),
      -1,
      true,
    );
  }, [ringPulse]);

  const activeSeconds = useMemo(() => effectiveElapsedSeconds(active, nowMs), [active, nowMs]);

  return (
    <ActiveSessionBlock
      active={active}
      activeSeconds={activeSeconds}
      ringPulse={ringPulse}
      onOpenFullscreen={onOpenFullscreen}
      onConfirmStop={onConfirmStop}
      stopBusy={stopBusy}
    />
  );
}
