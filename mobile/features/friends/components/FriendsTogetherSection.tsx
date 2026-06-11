import { type Href, useRouter } from "expo-router";
import type { TFunction } from "i18next";
import { Swords, Users } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";

import { PrimaryButton } from "../../../components/ui/PrimaryButton";
import { colors } from "../../../constants/theme";
import type { BuddyStatusDto, CommitmentDto, SocialChallengeDto } from "../../../types/friends";
import { challengeDaysLeft, challengeKindLabel } from "../utils/friendsScreenFormat";
import { FriendsSectionHeader } from "./FriendsSectionHeader";
import { friendsScreenStyles as styles } from "../styles/friendsScreen.styles";

type Props = {
  t: TFunction;
  busyActionKey: string | null;
  onOpenChallengeCreate: () => void;
  onJoinSocialChallenge: (challengeId: number) => void;
  onOpenSessionSetup: () => void;
  buddy: BuddyStatusDto | null;
  commitment: CommitmentDto | null;
  hasOtherFriends: boolean;
  onOpenBuddyPicker: () => void;
  onOpenAddFriend: () => void;
  onAcceptBuddyInvite: (inviteId: number) => void;
  pendingBuddyInviteId: number | null;
  challengeCards: SocialChallengeDto[];
  currentUserId?: number;
};

export function FriendsTogetherSection({
  t,
  busyActionKey,
  onOpenChallengeCreate,
  onJoinSocialChallenge,
  onOpenSessionSetup,
  buddy,
  commitment,
  hasOtherFriends,
  onOpenBuddyPicker,
  onOpenAddFriend,
  onAcceptBuddyInvite,
  pendingBuddyInviteId,
  challengeCards,
  currentUserId,
}: Props) {
  const router = useRouter();
  const hasActiveBuddy = buddy?.status === "active";
  const buddyAhead =
    hasActiveBuddy && (buddy.buddy_week_sessions ?? 0) > (buddy.this_week_sessions ?? 0);
  const youAhead =
    hasActiveBuddy && (buddy.this_week_sessions ?? 0) > (buddy.buddy_week_sessions ?? 0);
  const showGetStarted =
    challengeCards.length === 0 &&
    !hasActiveBuddy &&
    buddy?.status !== "pending_incoming" &&
    buddy?.status !== "pending_outgoing";

  const openStats = () => {
    router.push("/(tabs)/stats" as Href);
  };

  return (
    <>
      <Text style={styles.togetherIntro}>{t("friendsScreen.togetherIntro")}</Text>

      {showGetStarted ? (
        <View style={styles.togetherGetStartedCard}>
          <Text style={styles.togetherGetStartedTitle}>
            {t("friendsScreen.togetherGetStartedTitle")}
          </Text>
          <PrimaryButton
            label={
              busyActionKey === "buddy_invite"
                ? t("friendsScreen.loading")
                : t("friendsScreen.togetherPickBuddy")
            }
            onPress={hasOtherFriends ? onOpenBuddyPicker : onOpenAddFriend}
            disabled={busyActionKey === "buddy_invite"}
          />
          <Text style={styles.togetherOrDivider}>{t("friendsScreen.togetherOr")}</Text>
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.secondaryBtn,
              styles.togetherSecondaryFull,
              pressed && { opacity: 0.88 },
            ]}
            onPress={onOpenChallengeCreate}
          >
            <Text style={styles.secondaryBtnText}>{t("friendsScreen.togetherStartChallenge")}</Text>
          </Pressable>
        </View>
      ) : null}

      {commitment ? (
        <View style={styles.sectionWrap}>
          <View style={styles.cardElevated}>
            <Text style={styles.innerHeading}>{t("friendsScreen.togetherPromiseTitle")}</Text>
            <Text style={styles.userMeta}>
              {commitment.witness_usernames?.length
                ? t("friendsScreen.togetherPromiseWithWitnesses", {
                    target: commitment.target_sessions,
                    names: commitment.witness_usernames.map((n) => `@${n}`).join(", "),
                  })
                : t("friendsScreen.togetherPromiseSolo", {
                    target: commitment.target_sessions,
                  })}
            </Text>
            <Pressable
              accessibilityRole="button"
              style={styles.weekHeroTextLink}
              onPress={openStats}
            >
              <Text style={styles.weekHeroTextLinkText}>
                {t("friendsScreen.togetherViewInStats")}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {!showGetStarted ? (
        <View style={styles.sectionWrap}>
          <FriendsSectionHeader
            icon={<Users color={colors.primary} size={20} />}
            title={t("friendsScreen.togetherBuddyTitle")}
            subtitle={t("friendsScreen.togetherBuddySub")}
          />
          <View style={styles.cardElevated}>
            {buddy?.status === "active" ? (
              <>
                <Text style={styles.userMeta}>
                  {t("friendsScreen.togetherBuddyCompare", {
                    buddy: buddy.buddy_username,
                    buddyWeek: buddy.buddy_week_sessions ?? 0,
                    yourWeek: buddy.this_week_sessions ?? 0,
                  })}
                </Text>
                {buddyAhead ? (
                  <Text style={styles.userMeta}>{t("friendsScreen.togetherBuddyBehind")}</Text>
                ) : null}
                {youAhead ? (
                  <Text style={styles.userMeta}>
                    {t("friendsScreen.togetherBuddyAhead", {
                      buddy: buddy.buddy_username,
                    })}
                  </Text>
                ) : null}
                {!buddyAhead && !youAhead && (buddy.this_week_sessions ?? 0) > 0 ? (
                  <Text style={styles.userMeta}>{t("friendsScreen.togetherBuddyTied")}</Text>
                ) : null}
                {buddyAhead ? (
                  <PrimaryButton
                    label={t("friendsScreen.heroCtaCatchUp")}
                    onPress={onOpenSessionSetup}
                  />
                ) : null}
              </>
            ) : buddy?.status === "pending_incoming" ? (
              <>
                <Text style={styles.userMeta}>
                  {t("friendsScreen.buddyPendingIncoming", {
                    buddy: buddy.buddy_username ?? "buddy",
                  })}
                </Text>
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
              </>
            ) : buddy?.status === "pending_outgoing" ? (
              <Text style={styles.userMeta}>
                {t("friendsScreen.buddyPendingOutgoing", {
                  buddy: buddy.buddy_username ?? "buddy",
                })}
              </Text>
            ) : (
              <>
                <Text style={styles.userMeta}>{t("friendsScreen.togetherBuddyEmpty")}</Text>
                <PrimaryButton
                  label={
                    busyActionKey === "buddy_invite"
                      ? t("friendsScreen.loading")
                      : hasOtherFriends
                        ? t("friendsScreen.togetherPickBuddy")
                        : t("friendsScreen.feedEmptyCta")
                  }
                  onPress={hasOtherFriends ? onOpenBuddyPicker : onOpenAddFriend}
                  disabled={busyActionKey === "buddy_invite"}
                />
              </>
            )}
          </View>
        </View>
      ) : null}

      {!showGetStarted ? (
        <View style={styles.sectionWrap}>
          <FriendsSectionHeader
            icon={<Swords color={colors.primary} size={20} />}
            title={t("friendsScreen.togetherChallengesTitle")}
            subtitle={t("friendsScreen.togetherChallengesSub")}
            right={
              challengeCards.length > 0 ? (
                <View style={styles.collapseBadge}>
                  <Text style={styles.collapseBadgeText}>
                    {t("friendsScreen.challengesCollapsedSummary", {
                      count: challengeCards.length,
                    })}
                  </Text>
                </View>
              ) : null
            }
          />
          <View style={styles.cardElevated}>
            <PrimaryButton
              label={t("friendsScreen.togetherStartChallenge")}
              onPress={onOpenChallengeCreate}
            />
            {challengeCards.length === 0 ? (
              <Text style={styles.userMeta}>{t("friendsScreen.togetherChallengesEmpty")}</Text>
            ) : null}
            {challengeCards.map((challenge) => {
              const isMember =
                typeof currentUserId === "number" &&
                challenge.members.some((m) => m.user_id === currentUserId);
              const joinBusy = busyActionKey === `join_challenge_${challenge.id}`;

              return (
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
                    {challenge.status === "completed"
                      ? challenge.is_tie
                        ? t("friendsScreen.challengeEndedTie")
                        : challenge.winner_user_id === currentUserId
                          ? t("friendsScreen.challengeYouWon")
                          : t("friendsScreen.challengeEndedWinner", {
                              winner:
                                challenge.members.find((m) => m.user_id === challenge.winner_user_id)
                                  ?.username ?? t("friendsScreen.challengeSomeone"),
                            })
                      : t("friendsScreen.challengeActiveLine", {
                          target: challenge.target_sessions,
                          days:
                            challenge.days_remaining ??
                            challengeDaysLeft(challenge.week_start, challenge.duration_days) ??
                            challenge.duration_days ??
                            7,
                          rank: challenge.your_rank ?? "—",
                        })}
                  </Text>
                  {!isMember ? (
                    <PrimaryButton
                      label={
                        joinBusy ? t("friendsScreen.loading") : t("friendsScreen.joinThisChallenge")
                      }
                      onPress={() => void onJoinSocialChallenge(challenge.id)}
                      disabled={joinBusy}
                    />
                  ) : null}
                  {isMember ? (
                    challenge.members.map((m) => {
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
                        <View
                          key={`${challenge.id}-${m.user_id}`}
                          style={styles.challengeMemberRow}
                        >
                          <View style={styles.challengeMemberHeader}>
                            <Text style={[styles.userMeta, me && styles.challengeMe]}>
                              {m.username}
                            </Text>
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
                    })
                  ) : challenge.members.length > 0 ? (
                    <Text style={styles.sectionHintText}>
                      {t("friendsScreen.challengeJoinToSeeProgress")}
                    </Text>
                  ) : null}
                </View>
              );
            })}
          </View>
        </View>
      ) : null}
    </>
  );
}
