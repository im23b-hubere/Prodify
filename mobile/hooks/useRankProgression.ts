import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAuth } from "../context/AuthContext";
import { prefetchLevelCatalog } from "../lib/progressionLevelCatalog";
import { progressionLevelName } from "../lib/progressionLevels";
import { fetchProgression } from "../lib/progressionSync";

export function useRankProgression(enabled = true) {
  const { t } = useTranslation();
  const { token, user } = useAuth();
  const [xp, setXp] = useState<number | null>(null);
  const [level, setLevel] = useState<number | null>(null);
  const [progressPercent, setProgressPercent] = useState(0);
  const [xpToNext, setXpToNext] = useState<number | null>(null);

  useEffect(() => {
    if (!token || !enabled) {
      setXp(null);
      setLevel(null);
      setProgressPercent(0);
      setXpToNext(null);
    }
  }, [enabled, token, user?.id]);

  useEffect(() => {
    if (token && enabled) {
      prefetchLevelCatalog();
    }
  }, [enabled, token]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!token || !enabled) return;
      try {
        const parsed = await fetchProgression(token, { ttlMs: 45_000 });
        if (!cancelled && parsed) {
          setXp(parsed.xp_total);
          setLevel(parsed.current_level);
          setProgressPercent(Math.max(0, Math.min(100, parsed.progress_percent ?? 0)));
          setXpToNext(Math.max(0, parsed.xp_to_next_level ?? 0));
        }
      } catch {
        if (!cancelled) {
          setXp(null);
          setLevel(null);
          setXpToNext(null);
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [enabled, token, user?.id]);

  const rankName = useMemo(
    () => (level != null ? progressionLevelName(t, level) : ""),
    [level, t],
  );
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
