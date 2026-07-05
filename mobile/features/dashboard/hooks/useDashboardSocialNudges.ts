import * as SecureStore from "expo-secure-store";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TFunction } from "i18next";

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

function secureStoreKey(base: string, userId: number): string {
  const safeUserId = String(userId).replace(/[^A-Za-z0-9._-]/g, "_");
  return `${base}_${safeUserId}`;
}

export function useDashboardSocialNudges({
  userId,
  friendActivity,
  buddyRisk,
  socialChallenges,
  commitmentStatus,
  checkinStatus,
  t,
}: Params) {
  const [momentumState, setMomentumState] = useState<MomentumState>("low");
  const [momentumScore, setMomentumScore] = useState(0);
  const [primaryNudge, setPrimaryNudge] = useState<DashboardPrimaryNudge | null>(null);
  const [secondaryNudge, setSecondaryNudge] = useState<string | null>(null);
  const hasHydratedNudgesRef = useRef(false);

  const nudgeCandidates = useMemo(() => {
    const out: {
      key: string;
      category: "buddy_risk" | "challenge_close" | "commitment_behind" | "checkin_behind" | "streak_psych";
      message: string;
      priority: number;
      ctaLabel: string;
      actionKey: "rescue" | "start_session" | "open_friends";
    }[] = [];
    if (buddyRisk?.buddy_streak_at_risk && buddyRisk.buddy_username) {
      out.push({
        key: "buddy_risk",
        category: "buddy_risk",
        message: t("dashboard.nudgeBuddyDropped"),
        priority: 1,
        ctaLabel: buddyRisk.rescue_available
          ? t("dashboard.nudgeCtaKeepAlive")
          : t("dashboard.nudgeCtaStartProducing"),
        actionKey: buddyRisk.rescue_available ? "rescue" : "start_session",
      });
    }
    const closeChallenge = socialChallenges
      .flatMap((challenge) => {
        const mine = challenge.members.find((m) => m.user_id === userId);
        const lead = Math.max(...challenge.members.map((m) => m.progress_sessions), 0);
        if (!mine) return [];
        const behind = lead - mine.progress_sessions;
        if (behind === 1) {
          return [
            {
              key: `challenge_close_${challenge.id}`,
              category: "challenge_close" as const,
              message: t("dashboard.nudgeChallengeClose"),
              priority: 2,
              ctaLabel: t("dashboard.nudgeCtaMakeBeat"),
              actionKey: "start_session" as const,
            },
          ];
        }
        return [];
      })
      .slice(0, 1);
    out.push(...closeChallenge);
    if (commitmentStatus?.status === "behind") {
      out.push({
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
      out.push({
        key: "checkin_behind",
        category: "checkin_behind",
        message: t("dashboard.nudgeCheckinBehind"),
        priority: 4,
        ctaLabel: t("dashboard.nudgeCtaJumpTrack"),
        actionKey: "start_session",
      });
    }
    return out.sort((a, b) => a.priority - b.priority);
  }, [buddyRisk, socialChallenges, commitmentStatus, checkinStatus, userId, t]);

  const weightedNudgeCandidates = useMemo(() => {
    const preferredByState: Record<MomentumState, string[]> = {
      low: ["commitment_behind", "checkin_behind", "buddy_risk"],
      mid: ["challenge_close", "commitment_behind", "checkin_behind", "buddy_risk"],
      high: ["buddy_risk", "challenge_close", "checkin_behind"],
    };
    return nudgeCandidates
      .map((n) => ({
        ...n,
        weighted:
          n.priority * 100 - (preferredByState[momentumState].includes(n.category) ? 25 : 0),
      }))
      .sort((a, b) => a.weighted - b.weighted);
  }, [nudgeCandidates, momentumState]);

  const advancePrimaryNudge = useCallback(
    async (category: string) => {
      if (!userId) return;
      const cooldownKey = secureStoreKey("retention_primary_cooldowns", userId);
      const now = Date.now();
      const COOLDOWN_MS = 3 * 60 * 60 * 1000;
      const cdRaw = await SecureStore.getItemAsync(cooldownKey);
      const cooldowns = cdRaw ? (JSON.parse(cdRaw) as Record<string, number>) : {};
      cooldowns[category] = now + COOLDOWN_MS;
      await SecureStore.setItemAsync(cooldownKey, JSON.stringify(cooldowns));
      const ranked = nudgeCandidates
        .filter((n) => (cooldowns[n.category] ?? 0) <= now)
        .sort((a, b) => a.priority - b.priority);
      const next = ranked[0] ?? null;
      setPrimaryNudge(
        next
          ? {
              key: next.key,
              category: next.category,
              message: next.message,
              ctaLabel: next.ctaLabel,
              actionKey: next.actionKey,
            }
          : null,
      );
      setSecondaryNudge(ranked[1]?.message ?? null);
    },
    [userId, nudgeCandidates],
  );

  const applyMomentumAction = useCallback(async (uid: number, action: MomentumAction) => {
    const m = await recordMomentumAction(uid, action);
    setMomentumState(m.state);
    setMomentumScore(m.score);
  }, []);

  useEffect(() => {
    if (!userId) return;
    if (weightedNudgeCandidates.length === 0 && friendActivity.length === 0) {
      setPrimaryNudge(null);
      setSecondaryNudge(null);
      hasHydratedNudgesRef.current = true;
      return;
    }
    const key = secureStoreKey("retention_last_primary", userId);
    const cooldownKey = secureStoreKey("retention_primary_cooldowns", userId);
    const delayMs = hasHydratedNudgesRef.current ? 80 : 400;
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const momentum = await getMomentumSnapshot(userId);
          setMomentumState(momentum.state);
          setMomentumScore(momentum.score);
          const lastPrimaryCategory = await SecureStore.getItemAsync(key);
          const cdRaw = await SecureStore.getItemAsync(cooldownKey);
          const cooldowns = cdRaw ? (JSON.parse(cdRaw) as Record<string, number>) : {};
          const now = Date.now();
          const chainPreference: Record<string, string[]> = {
            rescue: ["challenge_close", "commitment_behind", "checkin_behind"],
            social: ["commitment_behind", "checkin_behind", "challenge_close"],
            session: ["buddy_risk", "challenge_close", "checkin_behind"],
            challenge: ["buddy_risk", "commitment_behind", "checkin_behind"],
          };
          const preferred = momentum.lastAction ? (chainPreference[momentum.lastAction] ?? []) : [];
          const boosted = weightedNudgeCandidates
            .map((n) => ({
              ...n,
              weighted2: n.weighted - (preferred.includes(n.category) ? 35 : 0),
            }))
            .sort((a, b) => a.weighted2 - b.weighted2);
          const eligible = boosted.filter((n) => (cooldowns[n.category] ?? 0) <= now);
          const ranked = eligible.length > 0 ? eligible : boosted;
          let picked = ranked[0] ?? null;
          if (picked && lastPrimaryCategory === picked.category && ranked.length > 1) {
            picked = ranked[1] ?? picked;
          }
          setPrimaryNudge(
            picked
              ? {
                  key: picked.key,
                  category: picked.category,
                  message: picked.message,
                  ctaLabel: picked.ctaLabel,
                  actionKey: picked.actionKey,
                }
              : null,
          );
          const secondary = ranked.find((r) => picked && r.key !== picked.key);
          setSecondaryNudge(secondary ? secondary.message : null);
          if (picked) {
            await SecureStore.setItemAsync(key, picked.category);
          }

          hasHydratedNudgesRef.current = true;
        } catch {
          /* ignore persistence failures */
        }
      })();
    }, delayMs);
    return () => clearTimeout(timer);
  }, [userId, weightedNudgeCandidates, friendActivity, t]);

  return {
    momentumState,
    momentumScore,
    primaryNudge,
    secondaryNudge,
    advancePrimaryNudge,
    applyMomentumAction,
  };
}
