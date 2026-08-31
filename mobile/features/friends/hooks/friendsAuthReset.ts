import { useAuthScopedReset } from "../../../lib/authScopedReset";
import type { FriendsScreenState } from "./useFriendsScreenState";

export { useAuthScopedReset as useFriendsAuthReset };

type AuthScopeOptions = {
  token: string | null;
  userId: number | null | undefined;
};

/** Clears all account-owned Friends state. Does not reset visual preferences (mode, sectionTab). */
export function resetFriendsAccountOwnedState(
  state: FriendsScreenState,
  { token, userId }: AuthScopeOptions,
) {
  state.loadSeq.current += 1;

  state.setLeaderboard(null);
  state.setActivity([]);
  state.setIncoming([]);
  state.setBuddy(null);
  state.setCheckin(null);
  state.setChallenges([]);
  state.setCommitment(null);
  state.setRecap(null);
  state.setFeedMetricsBySession({});
  state.setEntitlement(null);
  state.setError(null);
  state.setRefreshing(false);
  state.setLoading(Boolean(token && userId != null));

  state.setAddName("");
  state.setReactionUsers([]);
  state.setSelectedMembers([]);
  state.setChallengeTitle("");
  state.setChallengeKind("duel");
  state.setChallengeTarget("5");
  state.setChallengeDuration("7");
  state.setAddOpen(false);
  state.setReactionUsersOpen(false);
  state.setChallengeCreateOpen(false);
  state.setBuddyPickerOpen(false);

  state.setActionBusy(null);
  state.setAddBusy(false);
  state.setChallengeCreateBusy(false);
  state.setBusyActionKey(null);
  state.setReactionUsersLoading(false);
  state.setReactionBusyBySession({});
  state.setToastMessage(null);
}
