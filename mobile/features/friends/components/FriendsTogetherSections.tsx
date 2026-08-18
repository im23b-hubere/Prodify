import { type Href, useRouter } from "expo-router";
import { ChevronRight, Swords, Users } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";

import { PrimaryButton } from "../../../components/ui/PrimaryButton";
import { colors } from "../../../constants/theme";
import type { SocialChallengeDto } from "../../../types/friends";
import type { FriendsTogetherProps } from "./FriendsTogetherSection";
import { FriendsBuddyDuelCard } from "./FriendsBuddyDuelCard";
import { FriendsSectionHeader } from "./FriendsSectionHeader";
import { challengeDaysLeft, challengeKindLabel } from "../utils/friendsScreenFormat";
import { friendsTogetherStyles as styles } from "../styles/friendsTogether.styles";

export function TogetherGetStarted({ props }: { props: FriendsTogetherProps }) {
  const { t } = props;
  return (
    <View style={styles.togetherGetStartedCard}>
      <Text style={styles.togetherGetStartedTitle}>
        {t("friendsScreen.togetherGetStartedTitle")}
      </Text>
      <PrimaryButton
        label={
          props.busyActionKey === "buddy_invite"
            ? t("friendsScreen.loading")
            : t("friendsScreen.togetherPickBuddy")
        }
        onPress={props.hasOtherFriends ? props.onOpenBuddyPicker : props.onOpenAddFriend}
        disabled={props.busyActionKey === "buddy_invite"}
      />
      <Text style={styles.togetherOrDivider}>{t("friendsScreen.togetherOr")}</Text>
      <Pressable
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.secondaryBtn,
          styles.togetherSecondaryFull,
          pressed && { opacity: 0.88 },
        ]}
        onPress={props.onOpenChallengeCreate}
      >
        <Text style={styles.secondaryBtnText}>{t("friendsScreen.togetherStartChallenge")}</Text>
      </Pressable>
    </View>
  );
}

export function TogetherBuddySection({ props }: { props: FriendsTogetherProps }) {
  const { t, buddy } = props;
  return (
    <View style={styles.sectionWrap}>
      <FriendsSectionHeader
        icon={<Users color={colors.primary} size={20} />}
        title={t("friendsScreen.togetherBuddyTitle")}
        subtitle={t("friendsScreen.togetherBuddySub")}
      />
      {buddy?.status === "active" ? (
        <FriendsBuddyDuelCard
          t={t}
          buddyName={buddy.buddy_username ?? t("friendsScreen.challengeSomeone")}
          yourSessions={buddy.this_week_sessions ?? 0}
          buddySessions={buddy.buddy_week_sessions ?? 0}
          onCatchUp={props.onOpenSessionSetup}
        />
      ) : (
        <BuddyEmptyState props={props} />
      )}
    </View>
  );
}

function BuddyEmptyState({ props }: { props: FriendsTogetherProps }) {
  const { t, buddy } = props;
  return (
    <View style={styles.cardElevated}>
      {buddy?.status === "pending_incoming" ? (
        <>
          <Text style={styles.userMeta}>
            {t("friendsScreen.buddyPendingIncoming", { buddy: buddy.buddy_username ?? "buddy" })}
          </Text>
          {props.pendingBuddyInviteId != null ? (
            <PrimaryButton
              label={
                props.busyActionKey === "buddy_accept"
                  ? t("friendsScreen.loading")
                  : t("friendsScreen.acceptBuddyInvite")
              }
              onPress={() => props.onAcceptBuddyInvite(props.pendingBuddyInviteId!)}
              disabled={props.busyActionKey === "buddy_accept"}
            />
          ) : null}
        </>
      ) : buddy?.status === "pending_outgoing" ? (
        <Text style={styles.userMeta}>
          {t("friendsScreen.buddyPendingOutgoing", { buddy: buddy.buddy_username ?? "buddy" })}
        </Text>
      ) : (
        <>
          <Text style={styles.userMeta}>{t("friendsScreen.togetherBuddyEmpty")}</Text>
          <PrimaryButton
            label={
              props.busyActionKey === "buddy_invite"
                ? t("friendsScreen.loading")
                : props.hasOtherFriends
                  ? t("friendsScreen.togetherPickBuddy")
                  : t("friendsScreen.feedEmptyCta")
            }
            onPress={props.hasOtherFriends ? props.onOpenBuddyPicker : props.onOpenAddFriend}
            disabled={props.busyActionKey === "buddy_invite"}
          />
        </>
      )}
    </View>
  );
}

export function TogetherChallengesSection({
  props,
  activeCount,
}: {
  props: FriendsTogetherProps;
  activeCount: number;
}) {
  const router = useRouter();
  const { t } = props;
  return (
    <View style={styles.sectionWrap}>
      <FriendsSectionHeader
        icon={<Swords color={colors.primary} size={20} />}
        title={t("friendsScreen.togetherChallengesTitle")}
        subtitle={t("friendsScreen.togetherChallengesSub")}
        right={
          activeCount > 0 ? (
            <View style={styles.collapseBadge}>
              <Text style={styles.collapseBadgeText}>
                {t("friendsScreen.challengesCollapsedSummary", { count: activeCount })}
              </Text>
            </View>
          ) : null
        }
      />
      <View style={styles.cardElevated}>
        <PrimaryButton
          label={t("friendsScreen.togetherStartChallenge")}
          onPress={props.onOpenChallengeCreate}
        />
        {props.challengeCards.length === 0 ? (
          <Text style={styles.userMeta}>{t("friendsScreen.togetherChallengesEmpty")}</Text>
        ) : null}
        {props.challengeCards.map((challenge) => (
          <ChallengeCard
            key={challenge.id}
            challenge={challenge}
            props={props}
            onOpen={() => router.push(`/challenge/${challenge.id}` as Href)}
          />
        ))}
      </View>
    </View>
  );
}

function ChallengeCard({
  challenge,
  props,
  onOpen,
}: {
  challenge: SocialChallengeDto;
  props: FriendsTogetherProps;
  onOpen: () => void;
}) {
  const { t, currentUserId } = props;
  const member =
    typeof currentUserId === "number" &&
    challenge.members.some((item) => item.user_id === currentUserId);
  const joinBusy = props.busyActionKey === `join_challenge_${challenge.id}`;
  const winner =
    challenge.members.find((item) => item.user_id === challenge.winner_user_id)?.username ??
    t("friendsScreen.challengeSomeone");
  const summary =
    challenge.status === "completed"
      ? challenge.is_tie
        ? t("friendsScreen.challengeEndedTie")
        : challenge.winner_user_id === currentUserId
          ? t("friendsScreen.challengeYouWon")
          : t("friendsScreen.challengeEndedWinner", { winner })
      : t("friendsScreen.challengeActiveLine", {
          target: challenge.target_sessions,
          days:
            challenge.days_remaining ??
            challengeDaysLeft(challenge.week_start, challenge.duration_days) ??
            challenge.duration_days ??
            7,
          rank: challenge.your_rank ?? "—",
        });
  return (
    <View style={styles.challengeBlock}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("friendsScreen.challengeOpenDetailA11y", { title: challenge.title })}
        style={({ pressed }) => [
          styles.challengeTapCard,
          pressed && styles.challengeTapCardPressed,
        ]}
        onPress={onOpen}
      >
        <View style={styles.challengeHeaderRow}>
          <Text style={styles.userName}>{challenge.title}</Text>
          <View style={styles.challengeHeaderRight}>
            <View style={styles.challengeKindPill}>
              <Text style={styles.challengeKindPillText}>
                {challengeKindLabel(challenge.challenge_kind, t)}
              </Text>
            </View>
            <ChevronRight color={colors.textSecondary} size={18} />
          </View>
        </View>
        <Text style={styles.userMeta}>{summary}</Text>
        <Text style={styles.challengeTapHint}>{t("friendsScreen.challengeTapHint")}</Text>
      </Pressable>
      {!member && challenge.status === "active" ? (
        <PrimaryButton
          label={joinBusy ? t("friendsScreen.loading") : t("friendsScreen.joinThisChallenge")}
          onPress={() => props.onJoinSocialChallenge(challenge.id)}
          disabled={joinBusy}
        />
      ) : null}
    </View>
  );
}
