import * as SecureStore from "expo-secure-store";
import type { TFunction } from "i18next";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";

import {
  getMomentumSnapshot,
  recordMomentumAction,
  type MomentumAction,
  type MomentumState,
} from "../../../lib/momentum";
import type {
  BuddyRiskDto,
  CheckinStatusDto,
  CommitmentDto,
  FriendActivityDto,
  SocialChallengeDto,
} from "../../../types/friends";

export type DashboardPrimaryNudge = {
  key: string;
  category: string;
  message: string;
  ctaLabel: string;
  actionKey: "rescue" | "start_session" | "open_friends";
};

type Params = {
  userId: number | undefined;
  friendActivity: FriendActivityDto[];
  buddyRisk: BuddyRiskDto | null;
  socialChallenges: SocialChallengeDto[];
  commitmentStatus: CommitmentDto | null;
  checkinStatus: CheckinStatusDto | null;
  t: TFunction;
};

type NudgeCandidate = DashboardPrimaryNudge & { priority: number };
type WeightedNudge = NudgeCandidate & { weighted: number };
type CandidateParams = Omit<Params, "friendActivity">;
type NudgeSetters = {
  setMomentumState: Dispatch<SetStateAction<MomentumState>>;
  setMomentumScore: Dispatch<SetStateAction<number>>;
  setPrimaryNudge: Dispatch<SetStateAction<DashboardPrimaryNudge | null>>;
  setSecondaryNudge: Dispatch<SetStateAction<string | null>>;
};

export function useDashboardSocialNudges(params: Params) {
  const { buddyRisk, checkinStatus, commitmentStatus, socialChallenges, t, userId } = params;
  const [momentumState, setMomentumState] = useState<MomentumState>("low");
  const [momentumScore, setMomentumScore] = useState(0);
  const [primaryNudge, setPrimaryNudge] = useState<DashboardPrimaryNudge | null>(null);
  const [secondaryNudge, setSecondaryNudge] = useState<string | null>(null);
  const candidates = useMemo(
    () =>
      buildCandidates({
        buddyRisk,
        checkinStatus,
        commitmentStatus,
        socialChallenges,
        t,
        userId,
      }),
    [buddyRisk, checkinStatus, commitmentStatus, socialChallenges, t, userId],
  );
  const weighted = useMemo(
    () => weightCandidates(candidates, momentumState),
    [candidates, momentumState],
  );
  const setters = useMemo(
    () => ({ setMomentumState, setMomentumScore, setPrimaryNudge, setSecondaryNudge }),
    [],
  );
  useNudgeHydration(params, weighted, setters);
  const advancePrimaryNudge = useAdvancePrimaryNudge(params.userId, candidates, setters);
  const applyMomentumAction = useCallback(async (userId: number, action: MomentumAction) => {
    const momentum = await recordMomentumAction(userId, action);
    setMomentumState(momentum.state);
    setMomentumScore(momentum.score);
  }, []);
  return {
    momentumState,
    momentumScore,
    primaryNudge,
    secondaryNudge,
    advancePrimaryNudge,
    applyMomentumAction,
  };
}

function buildCandidates({
  buddyRisk,
  checkinStatus,
  commitmentStatus,
  socialChallenges,
  t,
  userId,
}: CandidateParams): NudgeCandidate[] {
  const candidates: NudgeCandidate[] = [];
  if (buddyRisk?.buddy_streak_at_risk && buddyRisk.buddy_username) {
    candidates.push({
      key: "buddy_risk",
      category: "buddy_risk",
      message: t("dashboard.nudgeBuddyDropped"),
      priority: 1,
      ctaLabel: t(
        buddyRisk.rescue_available
          ? "dashboard.nudgeCtaKeepAlive"
          : "dashboard.nudgeCtaStartProducing",
      ),
      actionKey: buddyRisk.rescue_available ? "rescue" : "start_session",
    });
  }
  const closeChallenge = socialChallenges
    .map((challenge) => {
      const mine = challenge.members.find((member) => member.user_id === userId);
      const lead = Math.max(...challenge.members.map((member) => member.progress_sessions), 0);
      if (!mine || lead - mine.progress_sessions !== 1) return null;
      return {
        key: `challenge_close_${challenge.id}`,
        category: "challenge_close",
        message: t("dashboard.nudgeChallengeClose"),
        priority: 2,
        ctaLabel: t("dashboard.nudgeCtaMakeBeat"),
        actionKey: "start_session",
      } satisfies NudgeCandidate;
    })
    .find(Boolean);
  if (closeChallenge) candidates.push(closeChallenge);
  if (commitmentStatus?.status === "behind") {
    candidates.push({
      key: "commitment_behind",
      category: "commitment_behind",
      message: t("dashboard.nudgeWeeklyGoalClose"),
      priority: 3,
      ctaLabel: t("dashboard.nudgeCtaContinueTrack"),
      actionKey: "start_session",
    });
  }
  if (
    checkinStatus &&
    !checkinStatus.on_track &&
    checkinStatus.done_count < checkinStatus.target_checkins
  ) {
    candidates.push({
      key: "checkin_behind",
      category: "checkin_behind",
      message: t("dashboard.nudgeCheckinBehind"),
      priority: 4,
      ctaLabel: t("dashboard.nudgeCtaJumpTrack"),
      actionKey: "start_session",
    });
  }
  return candidates.sort((left, right) => left.priority - right.priority);
}

function weightCandidates(
  candidates: NudgeCandidate[],
  momentumState: MomentumState,
): WeightedNudge[] {
  const preferred: Record<MomentumState, string[]> = {
    low: ["commitment_behind", "checkin_behind", "buddy_risk"],
    mid: ["challenge_close", "commitment_behind", "checkin_behind", "buddy_risk"],
    high: ["buddy_risk", "challenge_close", "checkin_behind"],
  };
  return candidates
    .map((nudge) => ({
      ...nudge,
      weighted: nudge.priority * 100 - (preferred[momentumState].includes(nudge.category) ? 25 : 0),
    }))
    .sort((left, right) => left.weighted - right.weighted);
}

function useAdvancePrimaryNudge(
  userId: number | undefined,
  candidates: NudgeCandidate[],
  setters: NudgeSetters,
) {
  return useCallback(
    async (category: string) => {
      if (!userId) return;
      const key = secureStoreKey("retention_primary_cooldowns", userId);
      const now = Date.now();
      const raw = await SecureStore.getItemAsync(key);
      const cooldowns = raw ? (JSON.parse(raw) as Record<string, number>) : {};
      cooldowns[category] = now + 3 * 60 * 60 * 1000;
      await SecureStore.setItemAsync(key, JSON.stringify(cooldowns));
      const ranked = candidates
        .filter((nudge) => (cooldowns[nudge.category] ?? 0) <= now)
        .sort((left, right) => left.priority - right.priority);
      setters.setPrimaryNudge(ranked[0] ?? null);
      setters.setSecondaryNudge(ranked[1]?.message ?? null);
    },
    [candidates, setters, userId],
  );
}

function useNudgeHydration(params: Params, weighted: WeightedNudge[], setters: NudgeSetters) {
  const hydrated = useRef(false);
  useEffect(() => {
    if (!params.userId) return;
    if (weighted.length === 0 && params.friendActivity.length === 0) {
      setters.setPrimaryNudge(null);
      setters.setSecondaryNudge(null);
      hydrated.current = true;
      return;
    }
    const delay = hydrated.current ? 80 : 400;
    const timer = setTimeout(
      () =>
        void hydrateNudges(params.userId!, weighted, setters).finally(() => {
          hydrated.current = true;
        }),
      delay,
    );
    return () => clearTimeout(timer);
  }, [params.friendActivity, params.userId, setters, weighted]);
}

async function hydrateNudges(userId: number, weighted: WeightedNudge[], setters: NudgeSetters) {
  try {
    const momentum = await getMomentumSnapshot(userId);
    setters.setMomentumState(momentum.state);
    setters.setMomentumScore(momentum.score);
    const lastKey = secureStoreKey("retention_last_primary", userId);
    const cooldownKey = secureStoreKey("retention_primary_cooldowns", userId);
    const [lastCategory, rawCooldowns] = await Promise.all([
      SecureStore.getItemAsync(lastKey),
      SecureStore.getItemAsync(cooldownKey),
    ]);
    const cooldowns = rawCooldowns ? (JSON.parse(rawCooldowns) as Record<string, number>) : {};
    const ranked = rankForMomentum(weighted, momentum.lastAction).filter(
      (nudge) => (cooldowns[nudge.category] ?? 0) <= Date.now(),
    );
    const available = ranked.length > 0 ? ranked : rankForMomentum(weighted, momentum.lastAction);
    let selected = available[0] ?? null;
    if (selected && lastCategory === selected.category && available.length > 1)
      selected = available[1];
    setters.setPrimaryNudge(selected);
    setters.setSecondaryNudge(
      available.find((nudge) => selected && nudge.key !== selected.key)?.message ?? null,
    );
    if (selected) await SecureStore.setItemAsync(lastKey, selected.category);
  } catch {
    // Persistence failures must not block the dashboard.
  }
}

function rankForMomentum(
  candidates: WeightedNudge[],
  lastAction: MomentumAction | null,
): WeightedNudge[] {
  const preference: Record<MomentumAction, string[]> = {
    rescue: ["challenge_close", "commitment_behind", "checkin_behind"],
    social: ["commitment_behind", "checkin_behind", "challenge_close"],
    session: ["buddy_risk", "challenge_close", "checkin_behind"],
    challenge: ["buddy_risk", "commitment_behind", "checkin_behind"],
    checkin: ["buddy_risk", "challenge_close", "commitment_behind"],
  };
  const preferred = lastAction ? preference[lastAction] : [];
  return candidates
    .map((nudge) => ({
      ...nudge,
      weighted: nudge.weighted - (preferred.includes(nudge.category) ? 35 : 0),
    }))
    .sort((left, right) => left.weighted - right.weighted);
}

function secureStoreKey(base: string, userId: number) {
  return `${base}_${String(userId).replace(/[^A-Za-z0-9._-]/g, "_")}`;
}
