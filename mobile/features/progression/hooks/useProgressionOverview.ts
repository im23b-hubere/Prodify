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
      if (
        _hasFreshData(
          force,
          silent,
          lastFetchRef.current,
          progressionRef.current,
          catalogLengthRef.current,
        )
      ) {
        return;
      }
      setLoadError(null);
      if (!token) {
        _clearState(
          setProgression,
          setLevelCatalog,
          setLoadingProgression,
          setLoadingCatalog,
          setRefreshing,
        );
        return;
      }
      prefetchLevelCatalog();
      _startLoading(
        silent,
        progressionRef.current,
        catalogLengthRef.current,
        setRefreshing,
        setLoadingProgression,
        setLoadingCatalog,
      );
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

  useFocusEffect(
    useCallback(() => {
      prefetchLevelCatalog();
      void load();
    }, [load]),
  );

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

function _hasFreshData(
  force: boolean,
  silent: boolean,
  lastFetch: number,
  progression: ProgressionDto | null,
  catalogLength: number,
) {
  return (
    !force && !silent && !isScreenDataStale(lastFetch) && progression !== null && catalogLength > 0
  );
}

function _startLoading(
  silent: boolean,
  progression: ProgressionDto | null,
  catalogLength: number,
  setRefreshing: (value: boolean) => void,
  setLoadingProgression: (value: boolean) => void,
  setLoadingCatalog: (value: boolean) => void,
) {
  if (silent) {
    setRefreshing(true);
    return;
  }
  if (!progression) setLoadingProgression(true);
  if (catalogLength === 0) setLoadingCatalog(true);
}

function _clearState(
  setProgression: (value: ProgressionDto | null) => void,
  setCatalog: (value: ProgressionLevelItem[]) => void,
  setLoadingProgression: (value: boolean) => void,
  setLoadingCatalog: (value: boolean) => void,
  setRefreshing: (value: boolean) => void,
) {
  setProgression(null);
  setCatalog([]);
  setLoadingProgression(false);
  setLoadingCatalog(false);
  setRefreshing(false);
}
