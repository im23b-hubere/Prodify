import type { TFunction } from "i18next";

import type { FriendLeaderboardEntryDto } from "../../../types/friends";

export type FriendsOverviewProps = {
  t: TFunction;
  mode: "week" | "all";
  setMode: (mode: "week" | "all") => void;
  entries: FriendLeaderboardEntryDto[];
  currentUserId?: number;
  onStartSession: () => void;
  onOpenProfile: (userId: number) => void;
};
