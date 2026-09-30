import { useCallback, useMemo } from "react";
import { Pressable, Text, View } from "react-native";

import { ListSection } from "../../../components/ui/list/ListSection";
import { useNow } from "../../../hooks/useNow";
import type { SocialChallengeDto } from "../../../types/friends";
import { friendDuelStatus } from "../../challengeCreate/challengeDraft";
import { challengeFriendOptions } from "../../challengeCreate/challengeFriends";
import { DuelArenaCard } from "../../challenges/board/components/DuelArenaCard";
import { DuelBoardEmpty } from "../../challenges/board/components/DuelBoardEmpty";
import {
  HistoryDuelRow,
  LiveDuelRow,
  WaitingDuelRow,
} from "../../challenges/board/components/DuelBoardRows";
import { RivalsStrip } from "../../challenges/board/components/RivalsStrip";
import {
  buildDuelBoard,
  duelRecordsByFriend,
  isDuelBoardEmpty,
  rematchableDuelIds,
  rematchRequest,
} from "../../challenges/board/duelBoard";
import { duelBoardStyles } from "../../challenges/board/duelBoard.styles";
import { duelParticipants } from "../../challenges/duelParticipants";
import { friendsTogetherStyles as styles } from "../styles/friendsTogether.styles";
import type { FriendsTogetherProps } from "./FriendsTogetherSection";
import { FriendsBuddyDuelCard } from "./FriendsBuddyDuelCard";

export function FriendsChallengesBody({ props }: { props: FriendsTogetherProps }) {
  const { t, currentUserId, challengeCards } = props;
  const board = useMemo(
    () => buildDuelBoard(challengeCards, currentUserId),
    [challengeCards, currentUserId],
  );
  const rivals = useMemo(
    () => challengeFriendOptions(props.friends, challengeCards, currentUserId),
    [challengeCards, currentUserId, props.friends],
  );
  const rivalStatuses = useMemo(
    () =>
      new Map(
        rivals.map((rival) => [
          rival.userId,
          friendDuelStatus(rival.userId, challengeCards, currentUserId),
        ]),
      ),
    [challengeCards, currentUserId, rivals],
  );
  const records = useMemo(() => duelRecordsByFriend(props.duelRecords), [props.duelRecords]);
  const rematchable = useMemo(
    () =>
      rematchableDuelIds(
        board.history,
        currentUserId,
        (friendId) => rivalStatuses.get(friendId) === "available",
      ),
    [board.history, currentUserId, rivalStatuses],
  );
  const { onRematchDuel } = props;
  const rematch = useCallback(
    (challenge: SocialChallengeDto) => {
      const request = rematchRequest(challenge, currentUserId);
      if (request) onRematchDuel(request);
    },
    [currentUserId, onRematchDuel],
  );
  const hasBuddy = props.buddy != null && props.buddy.status !== "none";
  const empty = isDuelBoardEmpty(board) && !hasBuddy;
  const arenaOpponent = board.arena ? duelParticipants(board.arena, currentUserId).opponent : null;
  const arenaRecord = arenaOpponent ? records.get(arenaOpponent.user_id) : undefined;
  const now = useNow();

  return (
    <View style={duelBoardStyles.board}>
      {empty ? (
        <DuelBoardEmpty
          t={t}
          rivals={rivals}
          onStartDuel={props.onOpenChallengeCreate}
          onAddFriend={props.onOpenAddFriend}
        />
      ) : (
        <RivalsStrip
          t={t}
          rivals={rivals}
          statuses={rivalStatuses}
          records={records}
          onNewDuel={props.onOpenChallengeCreate}
          onChallenge={props.onChallengeFriend}
        />
      )}
      {board.arena ? (
        <DuelArenaCard
          t={t}
          challenge={board.arena}
          currentUserId={currentUserId}
          record={arenaRecord}
          onOpen={props.onOpenChallenge}
          onStartSession={props.onOpenSessionSetup}
        />
      ) : null}
      {board.live.length > 0 ? (
        <ListSection title={t("duelBoard.sectionLive")} count={board.live.length}>
          {board.live.map((challenge, index) => (
            <LiveDuelRow
              key={challenge.id}
              t={t}
              challenge={challenge}
              currentUserId={currentUserId}
              divided={index > 0}
              onOpen={props.onOpenChallenge}
            />
          ))}
        </ListSection>
      ) : null}
      {board.waiting.length > 0 ? (
        <ListSection title={t("duelBoard.sectionWaiting")} count={board.waiting.length}>
          {board.waiting.map((challenge, index) => (
            <WaitingDuelRow
              key={challenge.id}
              t={t}
              challenge={challenge}
              divided={index > 0}
              now={now}
              busy={props.busyActionKey === `withdraw_challenge_${challenge.id}`}
              onWithdraw={props.onWithdrawChallengeInvite}
            />
          ))}
        </ListSection>
      ) : null}
      <BuddySection props={props} />
      {board.history.length > 0 ? (
        <ListSection title={t("duelBoard.sectionHistory")}>
          {board.history.map((challenge, index) => (
            <HistoryDuelRow
              key={challenge.id}
              t={t}
              challenge={challenge}
              currentUserId={currentUserId}
              divided={index > 0}
              onOpen={props.onOpenChallenge}
              onRematch={rematchable.has(challenge.id) ? rematch : undefined}
            />
          ))}
        </ListSection>
      ) : null}
    </View>
  );
}

function BuddySection({ props }: { props: FriendsTogetherProps }) {
  const { t, buddy } = props;
  const status = buddy?.status;
  if (status === "active") {
    return (
      <ListSection title={t("duelBoard.sectionBuddy")} carded={false}>
        <FriendsBuddyDuelCard
          t={t}
          buddyName={buddy?.buddy_username ?? t("friendsScreen.challengeSomeone")}
          yourSessions={buddy?.this_week_sessions ?? 0}
          buddySessions={buddy?.buddy_week_sessions ?? 0}
          onCatchUp={props.onOpenSessionSetup}
        />
      </ListSection>
    );
  }
  if (status === "pending_incoming" || status === "pending_outgoing") {
    return (
      <ListSection title={t("duelBoard.sectionBuddy")} carded={false}>
        <BuddyInviteRow props={props} />
      </ListSection>
    );
  }
  return (
    <ListSection title={t("duelBoard.sectionBuddy")}>
      <QuietLink
        label={t("friendsScreen.togetherPickBuddy")}
        onPress={props.hasOtherFriends ? props.onOpenBuddyPicker : props.onOpenAddFriend}
      />
    </ListSection>
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
          {t(
            incoming
              ? "friendsScreen.buddyInviteIncomingMeta"
              : "friendsScreen.buddyInviteOutgoingMeta",
          )}
        </Text>
      </View>
      {incoming && props.pendingBuddyInviteId != null ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("friendsScreen.acceptBuddyInvite")}
          style={({ pressed }) => [styles.acceptBtn, pressed && styles.actionPressed]}
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

function QuietLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.quietLink, pressed && styles.rowPressed]}
      onPress={onPress}
    >
      <Text style={styles.quietLinkText}>{label}</Text>
    </Pressable>
  );
}
