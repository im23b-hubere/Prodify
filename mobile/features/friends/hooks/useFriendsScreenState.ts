import { useCallback, useEffect, useRef, useState } from "react";

import type {
  BuddyStatusDto,
  CheckinStatusDto,
  CommitmentDto,
  FriendActivityDto,
  FriendIncomingDto,
  FriendLeaderboardDto,
  SocialChallengeDto,
  SocialReactionUserDto,
  SocialRecapDto,
} from "../../../types/friends";
import type { EntitlementDto } from "../../../types/outcomes";

type FeedMetrics = Record<
  number,
  { reactionsCount: number; commentsCount: number; viewerReaction: string | null }
>;

function useFriendsDataState() {
  const [mode, setMode] = useState<"week" | "all">("week");
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [leaderboard, setLeaderboard] = useState<FriendLeaderboardDto | null>(null);
  const [activity, setActivity] = useState<FriendActivityDto[]>([]);
  const [incoming, setIncoming] = useState<FriendIncomingDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [buddy, setBuddy] = useState<BuddyStatusDto | null>(null);
  const [checkin, setCheckin] = useState<CheckinStatusDto | null>(null);
  const [challenges, setChallenges] = useState<SocialChallengeDto[]>([]);
  const [commitment, setCommitment] = useState<CommitmentDto | null>(null);
  const [recap, setRecap] = useState<SocialRecapDto | null>(null);
  const [entitlement, setEntitlement] = useState<EntitlementDto | null>(null);
  const [feedMetricsBySession, setFeedMetricsBySession] = useState<FeedMetrics>({});
  const loadSeq = useRef(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      loadSeq.current += 1;
    };
  }, []);

  return {
    mode,
    setMode,
    refreshing,
    setRefreshing,
    loading,
    setLoading,
    leaderboard,
    setLeaderboard,
    activity,
    setActivity,
    incoming,
    setIncoming,
    error,
    setError,
    buddy,
    setBuddy,
    checkin,
    setCheckin,
    challenges,
    setChallenges,
    commitment,
    setCommitment,
    recap,
    setRecap,
    entitlement,
    setEntitlement,
    feedMetricsBySession,
    setFeedMetricsBySession,
    loadSeq,
    mounted,
  };
}

function useFriendsModalState() {
  const [addOpen, setAddOpen] = useState(false);
  const [addName, setAddName] = useState("");
  const [reactionUsersOpen, setReactionUsersOpen] = useState(false);
  const [reactionUsers, setReactionUsers] = useState<SocialReactionUserDto[]>([]);
  const [challengeCreateOpen, setChallengeCreateOpen] = useState(false);
  const [challengeTitle, setChallengeTitle] = useState("");
  const [challengeKind, setChallengeKind] = useState<"duel" | "team" | "group">("duel");
  const [challengeTarget, setChallengeTarget] = useState("5");
  const [challengeDuration, setChallengeDuration] = useState("7");
  const [selectedMembers, setSelectedMembers] = useState<number[]>([]);
  const [buddyPickerOpen, setBuddyPickerOpen] = useState(false);
  const [sectionTab, setSectionTab] = useState<"overview" | "tools">("overview");

  return {
    addOpen,
    setAddOpen,
    addName,
    setAddName,
    reactionUsersOpen,
    setReactionUsersOpen,
    reactionUsers,
    setReactionUsers,
    challengeCreateOpen,
    setChallengeCreateOpen,
    challengeTitle,
    setChallengeTitle,
    challengeKind,
    setChallengeKind,
    challengeTarget,
    setChallengeTarget,
    challengeDuration,
    setChallengeDuration,
    selectedMembers,
    setSelectedMembers,
    buddyPickerOpen,
    setBuddyPickerOpen,
    sectionTab,
    setSectionTab,
  };
}

function useFriendsFeedbackState() {
  const [addBusy, setAddBusy] = useState(false);
  const [actionBusy, setActionBusy] = useState<number | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [challengeCreateBusy, setChallengeCreateBusy] = useState(false);
  const [triggerIndex, setTriggerIndex] = useState(0);
  const [busyActionKey, setBusyActionKey] = useState<string | null>(null);
  const [reactionUsersLoading, setReactionUsersLoading] = useState(false);
  const [reactionBusyBySession, setReactionBusyBySession] = useState<Record<number, boolean>>({});
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    },
    [],
  );

  const showToast = useCallback((message: string) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastMessage(message);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
      toastTimeoutRef.current = null;
    }, 1800);
  }, []);

  return {
    addBusy,
    setAddBusy,
    actionBusy,
    setActionBusy,
    toastMessage,
    showToast,
    challengeCreateBusy,
    setChallengeCreateBusy,
    triggerIndex,
    setTriggerIndex,
    busyActionKey,
    setBusyActionKey,
    reactionUsersLoading,
    setReactionUsersLoading,
    reactionBusyBySession,
    setReactionBusyBySession,
  };
}

export function useFriendsScreenState() {
  return {
    ...useFriendsDataState(),
    ...useFriendsModalState(),
    ...useFriendsFeedbackState(),
  };
}

export type FriendsScreenState = ReturnType<typeof useFriendsScreenState>;
