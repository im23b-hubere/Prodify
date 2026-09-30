import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";

import { apiJson } from "../../../lib/client";
import { tryParseSkillProfile } from "../../../lib/skillProfileDto";
import type { SkillProfileDto } from "../../../types/skillProfile";

export type SkillProfileLoadState = "loading" | "ready" | "error";

/**
 * The user's skill tree, refetched whenever the screen gains focus. A loaded profile stays
 * on screen during refetches, so only the very first load shows a loading state.
 */
export function useSkillProfile(token: string | null | undefined) {
  const [profile, setProfile] = useState<SkillProfileDto | null>(null);
  const [loadState, setLoadState] = useState<SkillProfileLoadState>("loading");
  const latestRequest = useRef(0);

  const reload = useCallback(() => {
    if (!token) return;
    const request = ++latestRequest.current;
    apiJson<unknown>("/skills/profile", { token }).then(
      (raw) => {
        if (request !== latestRequest.current) return;
        const parsed = tryParseSkillProfile(raw);
        if (parsed) setProfile(parsed);
        setLoadState(parsed ? "ready" : "error");
      },
      () => {
        if (request === latestRequest.current) setLoadState("error");
      },
    );
  }, [token]);

  const retry = useCallback(() => {
    setLoadState("loading");
    reload();
  }, [reload]);

  useFocusEffect(
    useCallback(() => {
      reload();
      return () => {
        latestRequest.current += 1;
      };
    }, [reload]),
  );

  return { profile, loadState, reload, retry };
}

export type SkillProfileState = ReturnType<typeof useSkillProfile>;
