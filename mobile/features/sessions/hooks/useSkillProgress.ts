import { useCallback, useEffect, useRef, useState } from "react";

import type { SkillFocusId } from "../../../constants/skills";
import { apiJson } from "../../../lib/client";
import { parseSkillProgressList } from "../../../lib/skillProgressDto";
import type { SkillProgressDto } from "../../../types/skillProgress";

export type SkillProgressLoadState = "idle" | "loading" | "ready" | "error";

type ProgressBySkill = Partial<Record<SkillFocusId, SkillProgressDto>>;

function indexBySkill(raw: unknown): ProgressBySkill {
  return Object.fromEntries(parseSkillProgressList(raw).map((item) => [item.skill_id, item]));
}

/** Skill time for a session's focuses; earlier values stay visible while a refresh runs. */
export function useSkillProgress(token: string | null, sessionId: number, loadOnMount: boolean) {
  const [progressBySkill, setProgressBySkill] = useState<ProgressBySkill>({});
  const [loadState, setLoadState] = useState<SkillProgressLoadState>(
    loadOnMount && token ? "loading" : "idle",
  );
  const latestRequest = useRef(0);
  const isMounted = useRef(true);

  const fetchProgress = useCallback(() => {
    if (!token) return;
    const request = ++latestRequest.current;
    const isLatestRequest = () => isMounted.current && request === latestRequest.current;
    apiJson<unknown>(`/sessions/item/${sessionId}/skill-progress`, { token }).then(
      (raw) => {
        if (!isLatestRequest()) return;
        setProgressBySkill(indexBySkill(raw));
        setLoadState("ready");
      },
      () => {
        if (isLatestRequest()) setLoadState("error");
      },
    );
  }, [sessionId, token]);

  const refresh = useCallback(() => {
    setLoadState("loading");
    fetchProgress();
  }, [fetchProgress]);

  useEffect(() => {
    isMounted.current = true;
    if (loadOnMount) fetchProgress();
    return () => {
      isMounted.current = false;
    };
  }, [fetchProgress, loadOnMount]);

  return { progressBySkill, loadState, refresh };
}
