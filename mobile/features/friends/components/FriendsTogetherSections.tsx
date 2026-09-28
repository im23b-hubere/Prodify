import { type Href, useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";

import type { SocialChallengeDto } from "../../../types/friends";
import { challengeDaysLeft } from "../utils/friendsScreenFormat";
import type { FriendsTogetherProps } from "./FriendsTogetherSection";
import { FriendsBuddyDuelCard } from "./FriendsBuddyDuelCard";
import { FriendsDuelScoreboard } from "./FriendsDuelScoreboard";
import { friendsTogetherStyles as styles } from "../styles/friendsTogether.styles";

export function FriendsChallengesBody({ props }: { props: FriendsTogetherProps }) {
  const { t, buddy } = props;
  const buddyActive = buddy?.status === "active";
  const inviteIncoming = buddy?.status === "pending_incoming";
  const inviteOutgoing = buddy?.status === "pending_outgoing";
  const heroChallenge = buddyActive ? null : props.challengeCards.find((item) => item.status === "active");
  const rows = props.challengeCards.filter((item) => item.id !== heroChallenge?.id);
  const empty = !buddyActive && !inviteIncoming && !inviteOutgoing && props.challengeCards.length === 0;

  if (empty) return <ChallengesEmpty props={props} />;

  return (
    <View style={styles.stack}>
      {inviteIncoming || inviteOutgoing ? <BuddyInviteRow props={props} /> : null}
      {buddyActive ? (
        <FriendsBuddyDuelCard
          t={t}
          buddyName={buddy?.buddy_username ?? t("friendsScreen.challengeSomeone")}
          yourSessions={buddy?.this_week_sessions ?? 0}
          buddySessions={buddy?.buddy_week_sessions ?? 0}
          onCatchUp={props.onOpenSessionSetup}
        />
      ) : null}
      {heroChallenge ? <ChallengeHero challenge={heroChallenge} props={props} /> : null}
      <View style={styles.listCard}>
        {rows.map((challenge, index) => (
          <ChallengeRow key={challenge.id} challenge={challenge} props={props} divided={index > 0} />
        ))}
        <QuietLink
          divided={rows.length > 0}
          label={t("friendsScreen.togetherStartChallenge")}
          onPress={props.onOpenChallengeCreate}
        />
        {!buddyActive && !inviteIncoming && !inviteOutgoing ? (
          <QuietLink
            divided
            label={t("friendsScreen.togetherPickBuddy")}
            onPress={props.hasOtherFriends ? props.onOpenBuddyPicker : props.onOpenAddFriend}
          />
        ) : null}
      </View>
    </View>
  );
}

function ChallengesEmpty({ props }: { props: FriendsTogetherProps }) {
  const { t } = props;
  return (
    <View style={styles.emptyWrap}>
      <Text style={styles.emptyTitle}>{t("friendsScreen.challengesEmptyTitle")}</Text>
      <View style={styles.listCard}>
        <QuietLink
          label={t("friendsScreen.togetherPickBuddy")}
          onPress={props.hasOtherFriends ? props.onOpenBuddyPicker : props.onOpenAddFriend}
        />
        <QuietLink divided label={t("friendsScreen.togetherStartChallenge")} onPress={props.onOpenChallengeCreate} />
      </View>
    </View>
  );
}

function BuddyInviteRow({ props }: { props: FriendsTogetherProps }) {
  const { t, buddy } = props;
  const name = buddy?.buddy_username ?? t("friendsScreen.challengeSomeone");
  const incoming = buddy?.status === "pending_incoming";
  const busy = props.busyActionKey === "buddy_accept";
  return (
    <View style={styles.inviteRow}>
      <View style={styles.inviteCopy}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {name}
        </Text>
        <Text style={styles.rowMeta} numberOfLines={1}>
          {t(incoming ? "friendsScreen.buddyInviteIncomingMeta" : "friendsScreen.buddyInviteOutgoingMeta")}
        </Text>
      </View>
      {incoming && props.pendingBuddyInviteId != null ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("friendsScreen.acceptBuddyInvite")}
          style={({ pressed }) => [styles.acceptBtn, pressed && { opacity: 0.55 }]}
          disabled={busy}
          onPress={() => props.onAcceptBuddyInvite(props.pendingBuddyInviteId!)}
        >
          <Text style={styles.acceptText}>
            {busy ? t("friendsScreen.loading") : t("friendsScreen.accept")}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function ChallengeHero({
  challenge,
  props,
}: {
  challenge: SocialChallengeDto;
  props: FriendsTogetherProps;
}) {
  const sides = challengeSides(challenge, props.currentUserId, props.t("friendsScreen.buddyDuelYouLabel"));
  const behind = sides.opponentScore > sides.youScore;
  const quiet = sides.youScore === 0 && sides.opponentScore === 0;
  const actionLabel =
    challenge.status === "active" && (behind || quiet) ? props.t("friendsScreen.heroCtaStartSession") : null;
  return (
    <FriendsDuelScoreboard
      t={props.t}
      leftLabel={sides.youLabel}
      leftScore={sides.youScore}
      rightLabel={sides.opponentName}
      rightScore={sides.opponentScore}
      meta={props.t("friendsScreen.challengeDaysLeftShort", { count: challengeDayCount(challenge) })}
      actionLabel={actionLabel}
      onAction={actionLabel ? props.onOpenSessionSetup : undefined}
      testID="friends-challenge-duel"
    />
  );
}

function ChallengeRow({
  challenge,
  props,
  divided,
}: {
  challenge: SocialChallengeDto;
  props: FriendsTogetherProps;
  divided: boolean;
}) {
  const router = useRouter();
  const sides = challengeSides(challenge, props.currentUserId, props.t("friendsScreen.buddyDuelYouLabel"));
  const meta =
    challenge.status === "completed"
      ? completedLine(challenge, props)
      : props.t("friendsScreen.challengeDaysLeftShort", { count: challengeDayCount(challenge) });
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.t("friendsScreen.challengeOpenDetailA11y", { title: challenge.title })}
      style={({ pressed }) => [styles.challengeRow, pressed && styles.rowPressed]}
      onPress={() => router.push(`/challenge/${challenge.id}` as Href)}
    >
      {divided ? <View style={styles.separator} /> : null}
      <View style={styles.inviteCopy}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {challenge.title}
        </Text>
        <Text style={styles.rowMeta} numberOfLines={1}>
          {meta}
        </Text>
      </View>
      <Text style={styles.rowScore}>
        {sides.youScore}–{sides.opponentScore}
      </Text>
    </Pressable>
  );
}

function QuietLink({
  label,
  onPress,
  divided,
}: {
  label: string;
  onPress: () => void;
  divided?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.quietLink, pressed && styles.rowPressed]}
      onPress={onPress}
    >
      {divided ? <View style={styles.separator} /> : null}
      <Text style={styles.quietLinkText}>{label}</Text>
    </Pressable>
  );
}

function challengeSides(challenge: SocialChallengeDto, currentUserId: number | undefined, youLabel: string) {
  const you = challenge.members.find((member) => member.user_id === currentUserId);
  const opponent = challenge.members
    .filter((member) => member.user_id !== currentUserId)
    .sort((left, right) => right.progress_sessions - left.progress_sessions)[0];
  return {
    youLabel,
    youScore: you?.progress_sessions ?? 0,
    opponentName: opponent?.username ?? youLabel,
    opponentScore: opponent?.progress_sessions ?? 0,
  };
}

function challengeDayCount(challenge: SocialChallengeDto) {
  return (
    challenge.days_remaining ??
    challengeDaysLeft(challenge.week_start, challenge.duration_days) ??
    challenge.duration_days ??
    7
  );
}

function completedLine(challenge: SocialChallengeDto, props: FriendsTogetherProps) {
  if (challenge.is_tie) return props.t("friendsScreen.challengeEndedTie");
  if (challenge.winner_user_id === props.currentUserId) return props.t("friendsScreen.challengeYouWon");
  const winner =
    challenge.members.find((member) => member.user_id === challenge.winner_user_id)?.username ??
    props.t("friendsScreen.challengeSomeone");
  return props.t("friendsScreen.challengeEndedWinner", { winner });
}
