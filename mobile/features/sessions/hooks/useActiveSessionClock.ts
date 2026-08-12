import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert } from "react-native";

import { effectiveElapsedSeconds } from "../../../lib/sessionTime";
import type { SessionDto } from "../../../types/session";

const LONG_SESSION_WARNING_SECONDS = 8 * 3600;

export function useActiveSessionClock(session: SessionDto | null) {
  const { t } = useTranslation();
  const [nowMs, setNowMs] = useState(Date.now());
  const warnedForSessionId = useRef<number | null>(null);

  useEffect(() => {
    if (session?.pause_started_at) return;
    const tick = () => setNowMs(Date.now());
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [session?.pause_started_at]);

  const elapsed = session ? effectiveElapsedSeconds(session, nowMs) : 0;
  useEffect(() => {
    if (!session || elapsed < LONG_SESSION_WARNING_SECONDS) return;
    if (warnedForSessionId.current === session.id) return;
    warnedForSessionId.current = session.id;
    Alert.alert(t("sessionActive.longSessionTitle"), t("sessionActive.longSessionBody"));
  }, [elapsed, session, t]);

  return { elapsed, setNowMs };
}
