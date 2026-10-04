import * as Haptics from "expo-haptics";
import type { TFunction } from "i18next";
import { memo, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

import { Avatar } from "../../../../components/ui/Avatar";
import { PressableScale } from "../../../../components/ui/PressableScale";
import type { SocialChallengeDto, SocialChallengeMemberDto } from "../../../../types/friends";
import { profilePictureUrl } from "../../../profile/friendProfilePresentation";
import { duelParticipants } from "../../duelParticipants";
import {
  type DuelOutcome,
  duelDaysLeft,
  duelOutcome,
  duelStanding,
  inviteHoursLeft,
} from "../duelBoard";
import { duelBoardStyles as styles } from "../duelBoard.styles";

const ROW_AVATAR_SIZE = 44;

type RowProps = {
  t: TFunction;
  challenge: SocialChallengeDto;
  currentUserId: number | undefined;
  divided: boolean;
};

export const LiveDuelRow = memo(function LiveDuelRow({
  t,
  challenge,
  currentUserId,
  divided,
  onOpen,
}: RowProps & { onOpen: (challengeId: number) => void }) {
  const { you, opponent } = duelParticipants(challenge, currentUserId);
  const yourScore = you?.progress_sessions ?? 0;
  const opponentScore = opponent?.progress_sessions ?? 0;
  const standing = duelStanding(yourScore, opponentScore);
  const pill =
    standing.kind === "leading"
      ? { label: t("duelBoard.pillLeading"), accent: true }
      : standing.kind === "behind"
        ? { label: t("duelBoard.pillBehind"), accent: false }
        : { label: t("duelBoard.pillTied"), accent: false };
  return (
    <BoardRow
      t={t}
      opponent={opponent}
      title={challenge.title}
      meta={t("duelBoard.scoreMeta", {
        you: yourScore,
        opponent: opponentScore,
        days: t("duelBoard.daysLeft", { count: duelDaysLeft(challenge) }),
      })}
      divided={divided}
      onPress={() => onOpen(challenge.id)}
      testID={`duel-live-${challenge.id}`}
      accessory={<Pill label={pill.label} accent={pill.accent} />}
    />
  );
});

/** Without `onRematch` the outcome shows as a pill; with it, the outcome moves into the meta line. */
export const HistoryDuelRow = memo(function HistoryDuelRow({
  t,
  challenge,
  currentUserId,
  divided,
  onOpen,
  onRematch,
}: RowProps & {
  onOpen: (challengeId: number) => void;
  onRematch?: (challenge: SocialChallengeDto) => void;
}) {
  const { you, opponent } = duelParticipants(challenge, currentUserId);
  const outcome = duelOutcome(challenge, currentUserId);
  const badge = { label: t(OUTCOME_LABEL_KEYS[outcomeLabel(outcome)]), accent: outcome.kind === "won" };
  const score = { you: you?.progress_sessions ?? 0, opponent: opponent?.progress_sessions ?? 0 };
  if (!onRematch) {
    return (
      <BoardRow
        t={t}
        opponent={opponent}
        title={challenge.title}
        meta={
          outcome.kind === "cancelled"
            ? t("duelBoard.calledOffMeta")
            : t("duelBoard.finalScore", score)
        }
        divided={divided}
        onPress={() => onOpen(challenge.id)}
        testID={`duel-history-${challenge.id}`}
        accessory={<Pill label={badge.label} accent={badge.accent} />}
      />
    );
  }
  const rematchLabel = t("duelBoard.rematchA11y", {
    name: opponent?.username ?? t("friendsScreen.challengeSomeone"),
  });
  const rematch = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    onRematch(challenge);
  };
  return (
    <BoardRow
      t={t}
      opponent={opponent}
      title={challenge.title}
      meta={t("duelBoard.historyMeta", { outcome: badge.label, ...score })}
      divided={divided}
      onPress={() => onOpen(challenge.id)}
      secondaryAction={{ label: rematchLabel, onActivate: rematch }}
      testID={`duel-history-${challenge.id}`}
      accessory={
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={rematchLabel}
          style={styles.rematchPill}
          onPress={rematch}
          testID={`duel-rematch-${challenge.id}`}
        >
          <Text style={styles.rematchPillText}>{t("duelBoard.rematch")}</Text>
        </PressableScale>
      }
    />
  );
});

const OUTCOME_LABEL_KEYS = {
  won: "duelBoard.outcomeWon",
  lost: "duelBoard.outcomeLost",
  tie: "duelBoard.outcomeTie",
  declined: "duelBoard.outcomeDeclined",
  invite_expired: "duelBoard.outcomeExpired",
  withdrawn: "duelBoard.outcomeWithdrawn",
  member_left: "duelBoard.outcomeLeft",
  cancelled: "duelBoard.outcomeEnded",
} as const;

type OutcomeLabel = keyof typeof OUTCOME_LABEL_KEYS;

function outcomeLabel(outcome: DuelOutcome): OutcomeLabel {
  if (outcome.kind !== "cancelled") return outcome.kind;
  return outcome.reason in OUTCOME_LABEL_KEYS ? (outcome.reason as OutcomeLabel) : "cancelled";
}

/** A friend's running group challenge; opening it leads to the join button. */
export const FriendChallengeRow = memo(function FriendChallengeRow({
  t,
  challenge,
  divided,
  onOpen,
}: Omit<RowProps, "currentUserId"> & { onOpen: (challengeId: number) => void }) {
  const owner = challenge.members.find((member) => member.user_id === challenge.owner_id) ?? null;
  return (
    <BoardRow
      t={t}
      opponent={owner}
      title={challenge.title}
      meta={t("duelBoard.fromFriendsMeta", {
        owner: owner?.username ?? t("friendsScreen.challengeSomeone"),
        count: challenge.members.length,
        days: t("duelBoard.daysLeft", { count: duelDaysLeft(challenge) }),
      })}
      divided={divided}
      onPress={() => onOpen(challenge.id)}
      testID={`friend-challenge-${challenge.id}`}
      accessory={<Pill label={t("duelBoard.join")} accent={false} />}
    />
  );
});

export const WaitingDuelRow = memo(function WaitingDuelRow({
  t,
  challenge,
  divided,
  busy,
  now,
  onWithdraw,
}: Omit<RowProps, "currentUserId"> & {
  busy: boolean;
  now: number;
  onWithdraw: (challenge: SocialChallengeDto) => void;
}) {
  const name = challenge.invitee_username ?? t("friendsScreen.challengeSomeone");
  const hoursLeft = inviteHoursLeft(challenge.invite_expires_at, now);
  return (
    <BoardRow
      t={t}
      opponent={{ user_id: challenge.invitee_user_id ?? 0, username: name, progress_sessions: 0 }}
      title={name}
      meta={
        hoursLeft == null
          ? t("duelBoard.waitingMeta")
          : t("duelBoard.waitingExpires", { count: Math.max(1, hoursLeft) })
      }
      divided={divided}
      testID={`duel-waiting-${challenge.id}`}
      accessory={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("duelBoard.withdrawA11y", { name })}
          accessibilityState={{ disabled: busy, busy }}
          disabled={busy}
          hitSlop={8}
          style={({ pressed }) => [styles.textAction, pressed && styles.textActionPressed]}
          onPress={() => onWithdraw(challenge)}
        >
          <Text style={[styles.textActionLabel, busy && styles.textActionMuted]}>
            {busy ? t("friendsScreen.loading") : t("duelBoard.withdraw")}
          </Text>
        </Pressable>
      }
    />
  );
});

function BoardRow({
  t,
  opponent,
  title,
  meta,
  divided,
  accessory,
  onPress,
  secondaryAction,
  testID,
}: {
  t: TFunction;
  opponent: SocialChallengeMemberDto | null;
  title: string;
  meta: string;
  divided: boolean;
  accessory: ReactNode;
  onPress?: () => void;
  /** Screen readers group the row, so a nested button is also offered as a custom action. */
  secondaryAction?: { label: string; onActivate: () => void };
  testID: string;
}) {
  const name = opponent?.username ?? t("friendsScreen.challengeSomeone");
  const content = (
    <>
      {divided ? <View style={styles.rowDivider} /> : null}
      <Avatar
        name={name}
        photoUri={profilePictureUrl(opponent?.profile_picture_url)}
        size={ROW_AVATAR_SIZE}
      />
      <View style={styles.rowCopy}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.rowMeta} numberOfLines={1}>
          {meta}
        </Text>
      </View>
      {accessory}
    </>
  );
  if (!onPress) {
    return (
      <View style={styles.row} testID={testID}>
        {content}
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${meta}`}
      accessibilityActions={
        secondaryAction ? [{ name: "secondary", label: secondaryAction.label }] : undefined
      }
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === "secondary") secondaryAction?.onActivate();
      }}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      onPress={onPress}
      testID={testID}
    >
      {content}
    </Pressable>
  );
}

function Pill({ label, accent }: { label: string; accent: boolean }) {
  return (
    <View style={[styles.pill, accent && styles.pillAccent]}>
      <Text style={[styles.pillText, accent && styles.pillTextAccent]}>{label}</Text>
    </View>
  );
}
