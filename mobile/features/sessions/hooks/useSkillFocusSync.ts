import { useCallback, useEffect, useRef, useState } from "react";

import { apiJson } from "../../../lib/client";
import { isSameReflection, type FocusReflection } from "../skillFocusReflection";

export type FocusSaveStatus = "idle" | "saving" | "saved" | "error";

/**
 * Persists a session's focus reflection as the user edits it. Requests run one at a time and
 * always send the latest selection, so rapid taps cannot land on the server out of order.
 */
export function useSkillFocusSync(
  token: string | null,
  sessionId: number,
  savedReflection: FocusReflection,
  onSaved: () => void,
) {
  const [status, setStatus] = useState<FocusSaveStatus>("idle");
  const desiredReflection = useRef(savedReflection);
  const persistedReflection = useRef(savedReflection);
  const isRequestInFlight = useRef(false);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const flush = useCallback(async () => {
    if (!token || isRequestInFlight.current) return;
    isRequestInFlight.current = true;
    setStatus("saving");
    try {
      while (!isSameReflection(desiredReflection.current, persistedReflection.current)) {
        const target = desiredReflection.current;
        await apiJson<unknown>(`/sessions/item/${sessionId}`, {
          token,
          method: "PATCH",
          body: {
            skill_focus_ids: target.focusIds,
            primary_skill_focus_id: target.primaryFocusId,
          },
        });
        persistedReflection.current = target;
      }
      if (!isMounted.current) return;
      setStatus("saved");
      onSaved();
    } catch {
      if (isMounted.current) setStatus("error");
    } finally {
      isRequestInFlight.current = false;
    }
  }, [onSaved, sessionId, token]);

  const save = useCallback(
    (reflection: FocusReflection) => {
      desiredReflection.current = reflection;
      void flush();
    },
    [flush],
  );

  const retry = useCallback(() => void flush(), [flush]);

  return { status, save, retry };
}
