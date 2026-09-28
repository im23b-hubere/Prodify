import type { TFunction } from "i18next";
import { Pressable, Text, View } from "react-native";

import type { SocialChallengeDto } from "../../../types/friends";
import { friendsTogetherStyles as styles } from "../styles/friendsTogether.styles";
import { duelInviteSenderName, isIncomingDuelInvite } from "../utils/duelInvites";

export type DuelInviteActions = {
  t: TFunction;
  currentUserId?: number;
  busyActionKey: string | null;
  onAcceptChallengeInvite: (challengeId: number) => void;
  onDeclineChallengeInvite: (challengeId: number) => void;
};

export function FriendsDuelInviteRow({
  challenge,
  actions,
  divided,
}: {
  challenge: SocialChallengeDto;
  actions: DuelInviteActions;
  divided: boolean;
}) {
  const { t } = actions;
  const incoming = isIncomingDuelInvite(challenge, actions.currentUserId);
  const name =
    (incoming ? duelInviteSenderName(challenge) : challenge.invitee_username) ?? t("friendsScreen.challengeSomeone");
  const busy =
    actions.busyActionKey === `accept_challenge_${challenge.id}` ||
    actions.busyActionKey === `decline_challenge_${challenge.id}`;
  return (
    <View style={styles.challengeRow} testID={`duel-invite-${challenge.id}`}>
      {divided ? <View style={styles.separator} /> : null}
      <View style={styles.inviteCopy}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {name}
        </Text>
        <Text style={styles.rowMeta} numberOfLines={1}>
          {t(incoming ? "friendsScreen.challengeInviteIncomingMeta" : "friendsScreen.buddyInviteOutgoingMeta")}
        </Text>
      </View>
      {incoming ? (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("friendsScreen.challengeDecline")}
            style={({ pressed }) => [styles.acceptBtn, pressed && { opacity: 0.55 }]}
            disabled={busy}
            onPress={() => actions.onDeclineChallengeInvite(challenge.id)}
          >
            <Text style={styles.declineText}>{t("friendsScreen.challengeDecline")}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("friendsScreen.accept")}
            style={({ pressed }) => [styles.acceptBtn, pressed && { opacity: 0.55 }]}
            disabled={busy}
            onPress={() => actions.onAcceptChallengeInvite(challenge.id)}
          >
            <Text style={styles.acceptText}>{busy ? t("friendsScreen.loading") : t("friendsScreen.accept")}</Text>
          </Pressable>
        </>
      ) : null}
    </View>
  );
}
