import type { TFunction } from "i18next";
import type { ReactNode } from "react";

import type { FriendActivityDto, FriendLeaderboardEntryDto } from "../../../types/friends";

export type FriendsTriggerCard = {
  key: string;
  title: string;
  actionLabel: string;
  onPress: () => void;
};

export type FriendsOverviewProps = {
  t: TFunction;
  mode: "week" | "all";
  setMode: (mode: "week" | "all") => void;
  loading: boolean;
  entries: FriendLeaderboardEntryDto[];
  currentUserId?: number;
  activity: FriendActivityDto[];
  renderActivity: (item: FriendActivityDto, index: number) => ReactNode;
  activeTriggerCard: FriendsTriggerCard | null;
  onCompleteTriggerAction: () => void;
  onAddFriendFromEmptyFeed: () => void;
  onStartSession: () => void;
  onOpenProfile: (userId: number) => void;
};
