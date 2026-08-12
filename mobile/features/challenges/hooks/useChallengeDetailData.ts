import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";

import { fetchChallenge } from "../../../lib/social";
import type { SocialChallengeDto } from "../../../types/friends";

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
    async (options?: { silent?: boolean }) => {
      if (!token || challengeId == null) {
        setChallenge(null);
        setError(challengeId == null ? t("challengeDetail.invalidChallenge") : null);
        setLoading(false);
        setRefreshing(false);
        return;
      }
      const silent = options?.silent ?? false;
      setError(null);
      if (silent) setRefreshing(true);
      else setLoading(true);
      try {
        setChallenge(await fetchChallenge(token, challengeId));
      } catch (loadError) {
        setChallenge(null);
        setError(loadError instanceof Error ? loadError.message : t("challengeDetail.loadError"));
      } finally {
        if (!silent) setLoading(false);
        setRefreshing(false);
      }
    },
    [challengeId, t, token],
  );

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return { challenge, setChallenge, loading, refreshing, error, load };
}
