import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAuth } from "../context/AuthContext";
import { prefetchLevelCatalog } from "../lib/progressionLevelCatalog";
import { progressionLevelName } from "../lib/progressionLevels";
import { fetchProgression } from "../lib/progressionSync";

type RankSnapshot = {
  xp: number | null;
  level: number | null;
  progressPercent: number;
  xpToNext: number | null;
};

const EMPTY_RANK: RankSnapshot = { xp: null, level: null, progressPercent: 0, xpToNext: null };

export function useRankProgression(enabled = true) {
  const { t } = useTranslation();
  const { token, user } = useAuth();
  const [loaded, setLoaded] = useState<RankSnapshot | null>(null);

  // Rank only exists for a signed-in user who asked for it. Deriving that beats an effect
  // that blanks four state variables after the fact.
  const active = Boolean(token) && enabled;
  const { xp, level, progressPercent, xpToNext } = active ? loaded ?? EMPTY_RANK : EMPTY_RANK;

  useEffect(() => {
    if (token && enabled) {
      prefetchLevelCatalog(token);
    }
  }, [enabled, token]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!token || !enabled) return;
      try {
        const parsed = await fetchProgression(token, { ttlMs: 45_000 });
        if (!cancelled && parsed) {
          setLoaded({
            xp: parsed.xp_total,
            level: parsed.current_level,
            progressPercent: Math.max(0, Math.min(100, parsed.progress_percent ?? 0)),
            xpToNext: Math.max(0, parsed.xp_to_next_level ?? 0),
          });
        }
      } catch {
        if (!cancelled) setLoaded(null);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [enabled, token, user?.id]);

  const rankName = useMemo(() => (level != null ? progressionLevelName(t, level) : ""), [level, t]);
  const nextRankName = useMemo(
    () => (level != null ? progressionLevelName(t, level + 1) : ""),
    [level, t],
  );

  const ready = enabled && token != null && level != null && xp != null;

  return {
    ready,
    xp,
    level,
    progressPercent,
    xpToNext,
    rankName,
    nextRankName,
  };
}
