import { useCallback, useEffect, useState } from "react";

import { type EngagementDebug, fetchEngagementDebug } from "../../../lib/engagementDebug";

export type EngagementDebugStatus = "loading" | "ready" | "error";

/** Loads the engine's dry run; `evaluate` asks the server for a fresh decision. */
export function useEngagementDebug(token: string | null | undefined) {
  const [debug, setDebug] = useState<EngagementDebug | null>(null);
  const [status, setStatus] = useState<EngagementDebugStatus>("loading");
  const [isEvaluating, setIsEvaluating] = useState(false);

  const load = useCallback(() => {
    if (!token) return Promise.resolve();
    return fetchEngagementDebug(token).then(
      (result) => {
        setDebug(result);
        setStatus("ready");
      },
      () => setStatus("error"),
    );
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const retry = useCallback(() => {
    setStatus("loading");
    void load();
  }, [load]);

  const evaluate = useCallback(() => {
    setIsEvaluating(true);
    void load().finally(() => setIsEvaluating(false));
  }, [load]);

  return { debug, status, isEvaluating, retry, evaluate };
}
