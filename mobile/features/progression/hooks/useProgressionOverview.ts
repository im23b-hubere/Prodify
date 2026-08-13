import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useRef, useState } from "react";

import {
  fetchLevelCatalog,
  prefetchLevelCatalog,
  type ProgressionLevelItem,
} from "../../../lib/progressionLevelCatalog";
import { PROGRESSION_NAMED_LEVEL_MAX } from "../../../lib/progressionLevels";
import { isScreenDataStale } from "../../../lib/screenDataStale";
import { fetchProgression, syncProgression } from "../../../lib/progressionSync";
import type { ProgressionDto } from "../../../types/outcomes";

type LoadOptions = { silent?: boolean; sync?: boolean; force?: boolean };
type ProgressionSnapshot = {
  lastFetch: number;
  progression: ProgressionDto | null;
  catalogLength: number;
};
type LoadingControls = {
  setRefreshing: (value: boolean) => void;
  setLoadingProgression: (value: boolean) => void;
  setLoadingCatalog: (value: boolean) => void;
};

function useLoadProgressionOnFocus(load: () => Promise<void>) {
  useFocusEffect(
    useCallback(() => {
      prefetchLevelCatalog();
      void load();
    }, [load]),
  );
}

export function useProgressionOverview(token: string | null, loadErrorMessage: string) {
  const [progression, setProgression] = useState<ProgressionDto | null>(null);
  const [levelCatalog, setLevelCatalog] = useState<ProgressionLevelItem[]>([]);
  const [loadingProgression, setLoadingProgression] = useState(true);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const lastFetchRef = useRef(0);
  const progressionRef = useRef(progression);
  const catalogLengthRef = useRef(levelCatalog.length);
  progressionRef.current = progression;
  catalogLengthRef.current = levelCatalog.length;

  const load = useCallback(
    async (options: LoadOptions = {}) => {
      const silent = options.silent ?? false;
      const shouldSync = options.sync ?? false;
      const force = Boolean(options.force || shouldSync);
      const snapshot = {
        lastFetch: lastFetchRef.current,
        progression: progressionRef.current,
        catalogLength: catalogLengthRef.current,
      };
      if (hasFreshData(force, silent, snapshot)) {
        return;
      }
      setLoadError(null);
      if (!token) {
        clearState(setProgression, setLevelCatalog, {
          setLoadingProgression,
          setLoadingCatalog,
          setRefreshing,
        });
        return;
      }
      prefetchLevelCatalog();
      startLoading(silent, snapshot, { setRefreshing, setLoadingProgression, setLoadingCatalog });
      try {
        const progressionRequest = shouldSync
          ? syncProgression(token, { force: true })
          : fetchProgression(token, { force });
        const [nextProgression, catalog] = await Promise.all([
          progressionRequest,
          fetchLevelCatalog(PROGRESSION_NAMED_LEVEL_MAX),
        ]);
        setProgression(nextProgression);
        setLevelCatalog(catalog);
        lastFetchRef.current = Date.now();
      } catch (error) {
        setProgression(null);
        setLevelCatalog([]);
        setLoadError(error instanceof Error ? error.message : loadErrorMessage);
      } finally {
        setLoadingProgression(false);
        setLoadingCatalog(false);
        setRefreshing(false);
      }
    },
    [loadErrorMessage, token],
  );

  useLoadProgressionOnFocus(load);

  return {
    progression,
    levelCatalog,
    loadingProgression,
    loadingCatalog,
    refreshing,
    loadError,
    load,
  };
}

export type ProgressionOverviewState = ReturnType<typeof useProgressionOverview>;

function hasFreshData(force: boolean, silent: boolean, snapshot: ProgressionSnapshot) {
  return (
    !force &&
    !silent &&
    !isScreenDataStale(snapshot.lastFetch) &&
    snapshot.progression !== null &&
    snapshot.catalogLength > 0
  );
}

function startLoading(silent: boolean, snapshot: ProgressionSnapshot, controls: LoadingControls) {
  if (silent) {
    controls.setRefreshing(true);
    return;
  }
  if (!snapshot.progression) controls.setLoadingProgression(true);
  if (snapshot.catalogLength === 0) controls.setLoadingCatalog(true);
}

function clearState(
  setProgression: (value: ProgressionDto | null) => void,
  setCatalog: (value: ProgressionLevelItem[]) => void,
  controls: LoadingControls,
) {
  setProgression(null);
  setCatalog([]);
  controls.setLoadingProgression(false);
  controls.setLoadingCatalog(false);
  controls.setRefreshing(false);
}
