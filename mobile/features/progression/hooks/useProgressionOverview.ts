import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";

import { useLatestRef } from "../../../hooks/useLatestRef";
import { fetchLevelCatalog, type ProgressionLevelItem } from "../../../lib/progressionLevelCatalog";
import { PROGRESSION_NAMED_LEVEL_MAX } from "../../../lib/progressionLevels";
import { fetchProgression, syncProgression } from "../../../lib/progressionSync";
import { isScreenDataStale } from "../../../lib/screenDataStale";
import { userFacingErrorOrFallback } from "../../../lib/userFacingErrorMessage";
import type { FriendProgressionEntryDto } from "../../../types/friends";
import type { ProgressionDto } from "../../../types/outcomes";
import { clusterFriendsByLevel } from "../clusterFriendsByLevel";
import { fetchFriendsProgression } from "../friendsProgressionApi";

type LoadOptions = { silent?: boolean; sync?: boolean; force?: boolean };
type ProgressionSnapshot = {
  lastFetch: number;
  progression: ProgressionDto | null;
  catalogLength: number;
  friendsReady: boolean;
};
type LoadingControls = {
  setRefreshing: (value: boolean) => void;
  setLoadingProgression: (value: boolean) => void;
  setLoadingCatalog: (value: boolean) => void;
};

function useLoadProgressionOnFocus(load: () => Promise<void>) {
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
}

export function useProgressionOverview(
  token: string | null,
  loadErrorMessage: string,
  viewerUserId: number | null = null,
) {
  const [progression, setProgression] = useState<ProgressionDto | null>(null);
  const [levelCatalog, setLevelCatalog] = useState<ProgressionLevelItem[]>([]);
  const [friendProgression, setFriendProgression] = useState<FriendProgressionEntryDto[]>([]);
  const [friendsReady, setFriendsReady] = useState(false);
  const [loadingProgression, setLoadingProgression] = useState(true);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const lastFetchRef = useRef(0);
  const progressionRef = useLatestRef(progression);
  const catalogLengthRef = useLatestRef(levelCatalog.length);
  const friendsReadyRef = useLatestRef(friendsReady);

  const load = useCallback(
    async (options: LoadOptions = {}) => {
      const silent = options.silent ?? false;
      const shouldSync = options.sync ?? false;
      const force = Boolean(options.force || shouldSync);
      const snapshot = {
        lastFetch: lastFetchRef.current,
        progression: progressionRef.current,
        catalogLength: catalogLengthRef.current,
        friendsReady: friendsReadyRef.current,
      };
      if (hasFreshData(force, silent, snapshot)) {
        return;
      }
      setLoadError(null);
      if (!token) {
        clearState(setProgression, setLevelCatalog, setFriendProgression, setFriendsReady, {
          setLoadingProgression,
          setLoadingCatalog,
          setRefreshing,
        });
        return;
      }
      startLoading(silent, snapshot, { setRefreshing, setLoadingProgression, setLoadingCatalog });
      try {
        const progressionRequest = shouldSync
          ? syncProgression(token, { force: true })
          : fetchProgression(token, { force });
        // Friends markers are optional polish: a failure must not hide the user's own path.
        const friendsResult = await Promise.all([
          progressionRequest,
          fetchLevelCatalog(token, PROGRESSION_NAMED_LEVEL_MAX).catch(
            () => [] as ProgressionLevelItem[],
          ),
          fetchFriendsProgression(token).then(
            (payload) => ({ ok: true as const, friends: payload.friends ?? [] }),
            () => ({ ok: false as const, friends: [] as FriendProgressionEntryDto[] }),
          ),
        ]);
        const [nextProgression, catalog, friendsPayload] = friendsResult;
        setProgression(nextProgression);
        setLevelCatalog(catalog);
        setFriendProgression(friendsPayload.friends);
        setFriendsReady(friendsPayload.ok);
        lastFetchRef.current = Date.now();
      } catch (error) {
        setProgression(null);
        setLevelCatalog([]);
        setFriendProgression([]);
        setFriendsReady(false);
        setLoadError(userFacingErrorOrFallback(error, loadErrorMessage));
      } finally {
        setLoadingProgression(false);
        setLoadingCatalog(false);
        setRefreshing(false);
      }
    },
    [loadErrorMessage, token],
  );

  useLoadProgressionOnFocus(load);

  const friendClusters = clusterFriendsByLevel(friendProgression, {
    excludeUserId: viewerUserId,
  });

  return {
    progression,
    levelCatalog,
    friendProgression,
    friendClusters,
    friendsReady,
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
    snapshot.catalogLength > 0 &&
    snapshot.friendsReady
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
  setFriends: (value: FriendProgressionEntryDto[]) => void,
  setFriendsReadyState: (value: boolean) => void,
  controls: LoadingControls,
) {
  setProgression(null);
  setCatalog([]);
  setFriends([]);
  setFriendsReadyState(false);
  controls.setLoadingProgression(false);
  controls.setLoadingCatalog(false);
  controls.setRefreshing(false);
}
