import type { TFunction } from "i18next";
import { Users } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";

import { PrimaryButton } from "../../../components/ui/PrimaryButton";
import { colors } from "../../../constants/theme";
import type {
  BuddyStatusDto,
  CheckinStatusDto,
  CommitmentDto,
  SocialChallengeDto,
  SocialRecapDto,
} from "../../../types/friends";
import { hasPremiumAccess } from "../../../lib/billing";
import type { EntitlementDto } from "../../../types/outcomes";
import { challengeDaysLeft, challengeKindLabel } from "../utils/friendsScreenFormat";
import { FriendsSectionHeader } from "./FriendsSectionHeader";
import { friendsScreenStyles as styles } from "../styles/friendsScreen.styles";

type Props = {
  t: TFunction;
  busyActionKey: string | null;
  onJoinChallenge: () => void;
  onSubmitShipCheckin: () => void;
  onOpenChallengeCreate: () => void;
  buddy: BuddyStatusDto | null;
  checkin: CheckinStatusDto | null;
  commitment: CommitmentDto | null;
  entitlement: EntitlementDto | null;
  hasOtherFriends: boolean;
  onOpenBuddyPicker: () => void;
  onAcceptBuddyInvite: (inviteId: number) => void;
  pendingBuddyInviteId: number | null;
  onOpenGoalEditor: () => void;
  challengeCards: SocialChallengeDto[];
  recap: SocialRecapDto | null;
  currentUserId?: number;
};

export function FriendsToolsSection({
  t,
  busyActionKey,
  onJoinChallenge,
  onSubmitShipCheckin,
  onOpenChallengeCreate,
  buddy,
  checkin,
  commitment,
  entitlement,
  hasOtherFriends,
  onOpenBuddyPicker,
  onAcceptBuddyInvite,
  pendingBuddyInviteId,
  onOpenGoalEditor,
  challengeCards,
  recap,
  currentUserId,
}: Props) {
  return (
    <>
      <View style={styles.sectionWrap}>
        <FriendsSectionHeader
          icon={<Users color={colors.primary} size={20} />}
          title={t("friendsScreen.sectionChallengesTitle")}
          subtitle={t("friendsScreen.sectionChallengesSub")}
        />
        <View style={styles.cardElevated}>
          <PrimaryButton
            label={
              busyActionKey === "join_challenge"
                ? t("friendsScreen.loading")
                : t("friendsScreen.joinCreativeChallenge")
            }
            onPress={() => void onJoinChallenge()}
            disabled={busyActionKey === "join_challenge"}
          />
          <Text style={styles.sectionHintText}>{t("friendsScreen.challengeQuickActionsHint")}</Text>
          <View style={styles.challengeSecondaryRow}>
            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.secondaryBtn,
                styles.secondaryBtnHalf,
                pressed && { opacity: 0.88 },
              ]}
              onPress={() => void onSubmitShipCheckin()}
              disabled={busyActionKey === "ship_checkin"}
            >
              <Text style={styles.secondaryBtnText}>
                {busyActionKey === "ship_checkin"
                  ? t("friendsScreen.loading")
                  : t("friendsScreen.checkInNow")}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.secondaryBtn,
                styles.secondaryBtnHalf,
                pressed && { opacity: 0.88 },
              ]}
              onPress={onOpenChallengeCreate}
            >
              <Text style={styles.secondaryBtnText}>
                {t("friendsScreen.createCreativeChallenge")}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>

      <View style={styles.sectionWrap}>
        <FriendsSectionHeader
          title={t("friendsScreen.sectionCircleTitle")}
          subtitle={t("friendsScreen.sectionCircleSub")}
        />
        <View style={styles.cardElevated}>
          <View style={styles.innerPanel}>
            <Text style={styles.innerHeading}>{t("friendsScreen.buddyConnection")}</Text>
            <Text style={styles.helperText}>{t("friendsScreen.buddyHelper")}</Text>
            <Text style={styles.userMeta}>
              {buddy?.status === "active"
                ? t("friendsScreen.buddyActive", {
                    buddy: buddy.buddy_username,
                    buddyWeek: buddy.buddy_week_sessions ?? 0,
                    yourWeek: buddy.this_week_sessions ?? 0,
                  })
                : buddy?.status === "pending_incoming"
                  ? t("friendsScreen.buddyPendingIncoming", {
                      buddy: buddy.buddy_username ?? "buddy",
                    })
                  : buddy?.status === "pending_outgoing"
                    ? t("friendsScreen.buddyPendingOutgoing", {
                        buddy: buddy.buddy_username ?? "buddy",
                      })
                    : t("friendsScreen.buddyPickOne")}
            </Text>
            {hasPremiumAccess(entitlement) ? (
              <Text style={styles.premiumPill}>{t("friendsScreen.premiumActive")}</Text>
            ) : null}
            {buddy?.status === "none" ? (
              <PrimaryButton
                label={
                  busyActionKey === "buddy_invite"
                    ? t("friendsScreen.loading")
                    : t("friendsScreen.inviteBuddy")
                }
                onPress={onOpenBuddyPicker}
                disabled={busyActionKey === "buddy_invite" || !hasOtherFriends}
              />
            ) : null}
            {pendingBuddyInviteId != null ? (
              <PrimaryButton
                label={
                  busyActionKey === "buddy_accept"
                    ? t("friendsScreen.loading")
                    : t("friendsScreen.acceptBuddyInvite")
                }
                onPress={() => void onAcceptBuddyInvite(pendingBuddyInviteId)}
                disabled={busyActionKey === "buddy_accept"}
              />
            ) : null}
          </View>

          <View style={styles.innerDivider} />

          <View style={styles.innerPanel}>
            <Text style={styles.innerHeading}>{t("friendsScreen.studioActivity")}</Text>
            <Text style={styles.helperText}>{t("friendsScreen.checkinHelper")}</Text>
            <Text style={styles.userMeta}>
              {checkin
                ? t("friendsScreen.checkinStatus", {
                    done: checkin.done_count,
                    target: checkin.target_checkins,
                    state: checkin.on_track
                      ? t("friendsScreen.checkinInFlow")
                      : t("friendsScreen.checkinNeedsPush"),
                  })
                : t("friendsScreen.checkinHint")}
            </Text>
            {checkin?.day_states?.length ? (
              <View style={styles.dayStateRow}>
                {checkin.day_states.map((day) => (
                  <View
                    key={day.day_key}
                    style={[
                      styles.dayStatePill,
                      day.state === "done"
                        ? styles.dayStateDone
                        : day.state === "missed"
                          ? styles.dayStateMissed
                          : styles.dayStateOpen,
                    ]}
                  >
                    <Text style={styles.dayStateText}>
                      {new Date(day.day_key).toLocaleDateString(undefined, { weekday: "short" })}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>

          <View style={styles.innerDivider} />

          <View style={styles.innerPanel}>
            <Text style={styles.innerHeading}>{t("friendsScreen.creativeGoal")}</Text>
            <Text style={styles.helperText}>{t("friendsScreen.goalHelper")}</Text>
            <Text style={styles.userMeta}>
              {commitment
                ? t("friendsScreen.commitmentStatus", {
                    current: commitment.current_sessions,
                    target: commitment.target_sessions,
                    status: t(
                      commitment.status === "completed"
                        ? "friendsScreen.commitmentPhaseCompleted"
                        : commitment.status === "behind"
                          ? "friendsScreen.commitmentPhaseBehind"
                          : "friendsScreen.commitmentPhaseOnTrack",
                    ),
                  })
                : t("friendsScreen.commitmentHint")}
            </Text>
            {commitment?.witness_usernames?.length ? (
              <Text style={styles.userMeta}>
                {t("friendsScreen.commitmentWitnessedBy", {
                  names: commitment.witness_usernames.map((name) => `@${name}`).join(", "),
                })}
              </Text>
            ) : null}
            <PrimaryButton label={t("friendsScreen.editGoal")} onPress={onOpenGoalEditor} />
            {commitment?.status === "completed" ? (
              <Text style={styles.upsellHint}>{t("friendsScreen.upsellInviteFriend")}</Text>
            ) : null}
            {commitment?.upsell_hint && !hasPremiumAccess(entitlement) ? (
              <Text style={styles.upsellHint}>{commitment.upsell_hint}</Text>
            ) : null}
          </View>
        </View>
      </View>

      <View style={styles.sectionWrap}>
        <FriendsSectionHeader
          title={t("friendsScreen.socialChallenges")}
          subtitle={t("friendsScreen.sectionSocialChallengesSub")}
        />
        <View style={styles.cardElevated}>
          {challengeCards.length === 0 ? (
            <>
              <Text style={styles.feedEmpty}>{t("friendsScreen.noChallengesYet")}</Text>
              <Text style={styles.sectionHintText}>{t("friendsScreen.challengeEmptyHint")}</Text>
              <PrimaryButton
                label={t("friendsScreen.startFirstChallenge")}
                onPress={onOpenChallengeCreate}
              />
            </>
          ) : null}
          {challengeCards.map((challenge) => (
            <View key={challenge.id} style={styles.challengeBlock}>
              <View style={styles.challengeHeaderRow}>
                <Text style={styles.userName}>{challenge.title}</Text>
                <View style={styles.challengeKindPill}>
                  <Text style={styles.challengeKindPillText}>
                    {challengeKindLabel(challenge.challenge_kind, t)}
                  </Text>
                </View>
              </View>
              <Text style={styles.userMeta}>
                {t("friendsScreen.challengeGoalLine", {
                  target: challenge.target_sessions,
                  days:
                    challengeDaysLeft(challenge.week_start, challenge.duration_days) ??
                    challenge.duration_days ??
                    7,
                })}
              </Text>
              {challenge.members.map((m) => {
                const pct = Math.max(
                  0,
                  Math.min(
                    100,
                    Math.round((m.progress_sessions / challenge.target_sessions) * 100),
                  ),
                );
                const me = m.user_id === currentUserId;
                const leader =
                  challenge.members.length > 0
                    ? Math.max(...challenge.members.map((x) => x.progress_sessions))
                    : 0;
                const label =
                  m.progress_sessions === leader
                    ? t("friendsScreen.challengeLabelTone")
                    : leader - m.progress_sessions <= 1
                      ? t("friendsScreen.challengeLabelCloseBattle")
                      : t("friendsScreen.challengeLabelKeepGoing");
                return (
                  <View key={`${challenge.id}-${m.user_id}`} style={styles.challengeMemberRow}>
                    <View style={styles.challengeMemberHeader}>
                      <Text style={[styles.userMeta, me && styles.challengeMe]}>{m.username}</Text>
                      <Text style={[styles.userMeta, me && styles.challengeMe]}>
                        {m.progress_sessions}/{challenge.target_sessions}
                      </Text>
                    </View>
                    <View style={styles.progressTrack}>
                      <View style={[styles.progressFill, { width: `${pct}%` }]} />
                    </View>
                    <Text style={styles.challengeMemberLabel}>{label}</Text>
                  </View>
                );
              })}
            </View>
          ))}
        </View>
      </View>

      <View style={styles.sectionWrap}>
        <FriendsSectionHeader
          title={t("friendsScreen.weeklySocialRecap")}
          subtitle={t("friendsScreen.sectionRecapSub")}
        />
        <View style={styles.cardElevated}>
          <Text style={styles.userMeta}>
            {recap
              ? recap.has_active_buddy
                ? t("friendsScreen.recapWithBuddy", {
                    your: recap.your_sessions,
                    buddy: recap.buddy_sessions,
                  })
                : t("friendsScreen.recapSolo", {
                    your: recap.your_sessions,
                  })
              : t("friendsScreen.noRecapYet")}
          </Text>
          {recap?.identity_tag ? (
            <Text style={styles.identityLine}>
              {t(`friendsScreen.identityTag.${recap.identity_tag}`)}
            </Text>
          ) : null}
          {recap ? (
            <Text style={styles.userMeta}>
              {t("friendsScreen.recapTeamLine", { count: recap.team_sessions })} ·{" "}
              {t("friendsScreen.recapWowLine", {
                sign: recap.wow_delta_sessions >= 0 ? "+" : "",
                delta: recap.wow_delta_sessions,
              })}
            </Text>
          ) : null}
          {recap?.premium_detail_locked ? (
            <Text style={styles.upsellHint}>
              {recap.upsell_hint ?? t("friendsScreen.unlockPremiumInsights")}
            </Text>
          ) : null}
        </View>
      </View>
    </>
  );
}
