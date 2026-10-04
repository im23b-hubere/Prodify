import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { fetchChallenge } from "../../../lib/social";
import type { SocialChallengeDto } from "../../../types/friends";
import { subscribeChallengeSync } from "../sync/challengeSync";

/**
 * `silent` keeps the current challenge on screen (pull to refresh);
 * `background` additionally hides the refresh spinner (sync signal).
 */
type LoadOptions = { silent?: boolean; background?: boolean };

export function useChallengeDetailData(
  token: string | null | undefined,
  challengeId: number | null,
) {
  const { t } = useTranslation();
  const [challenge, setChallenge] = useState<SocialChallengeDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async ({ silent = false, background = false }: LoadOptions = {}) => {
      if (!token || challengeId == null) {
        setChallenge(null);
        setError(challengeId == null ? t("challengeDetail.invalidChallenge") : null);
        setLoading(false);
        setRefreshing(false);
        return;
      }
      const keepsContent = silent || background;
      if (!keepsContent) {
        setError(null);
        setLoading(true);
      } else if (!background) {
        setRefreshing(true);
      }
      try {
        setChallenge(await fetchChallenge(token, challengeId));
        setError(null);
      } catch (loadError) {
        if (keepsContent) return;
        setChallenge(null);
        setError(loadError instanceof Error ? loadError.message : t("challengeDetail.loadError"));
      } finally {
        if (!keepsContent) setLoading(false);
        if (!background) setRefreshing(false);
      }
    },
    [challengeId, t, token],
  );

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  useEffect(() => subscribeChallengeSync(() => void load({ background: true })), [load]);

  return { challenge, setChallenge, loading, refreshing, error, load };
}
