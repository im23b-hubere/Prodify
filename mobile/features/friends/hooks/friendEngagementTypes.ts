import type { TFunction } from "i18next";

import type { FriendsScreenState } from "./useFriendsScreenState";

export type FriendActionContext = {
  token: string | null;
  userId?: number;
  t: TFunction;
  load: (options?: { force?: boolean }) => Promise<void>;
  state: FriendsScreenState;
};

export type FriendEngagementContext = FriendActionContext & {
  friendCandidateIds: Set<number>;
};
