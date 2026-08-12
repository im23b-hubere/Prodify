import { useCallback, useRef, useState } from "react";
import type { TFunction } from "i18next";

import { apiJson } from "../../../lib/client";
import { parseSessionList, tryParseSessionDto } from "../../../lib/sessionDto";
import type { SessionDto } from "../../../types/session";

export function useDashboardSessionsData(token: string | null, t: TFunction) {
  const [sessions, setSessions] = useState<SessionDto[]>([]);
  const [active, setActive] = useState<SessionDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const loadSequence = useRef(0);

  const loadSessions = useCallback(async () => {
    if (!token) return;
    const sequence = ++loadSequence.current;
    try {
      const rawList = await apiJson<unknown>("/sessions/list?limit=200", { token });
      if (sequence !== loadSequence.current) return;

      const parsedSessions = parseSessionList(rawList);
      setSessions(parsedSessions);
      const activeSession = await resolveActiveSession(parsedSessions, token);
      if (sequence !== loadSequence.current) return;

      setActive(activeSession);
      setLastUpdated(new Date());
    } catch (error) {
      if (sequence !== loadSequence.current) return;
      setError(error instanceof Error ? error.message : t("dashboard.loadSessionsFailed"));
    }
  }, [token, t]);

  return { sessions, setSessions, active, setActive, error, setError, lastUpdated, loadSessions };
}

async function resolveActiveSession(
  sessions: SessionDto[],
  token: string,
): Promise<SessionDto | null> {
  const listedActiveSession = sessions.find((session) => session.stopped_at === null);
  if (listedActiveSession) return listedActiveSession;

  try {
    return tryParseSessionDto(await apiJson<unknown>("/sessions/active", { token }));
  } catch {
    return null;
  }
}
