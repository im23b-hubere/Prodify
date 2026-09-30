import * as Haptics from "expo-haptics";
import type { TFunction } from "i18next";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { Avatar } from "../../../components/ui/Avatar";
import { PressableScale } from "../../../components/ui/PressableScale";
import { colors } from "../../../constants/theme";
import type { SocialChallengeDto } from "../../../types/friends";
import { profilePictureUrl } from "../../profile/friendProfilePresentation";
import { friendsTogetherStyles as styles } from "../styles/friendsTogether.styles";

const AVATAR_SIZE = 44;

export type DuelInviteActions = {
  t: TFunction;
  currentUserId?: number;
  busyActionKey: string | null;
  onAcceptChallengeInvite: (challengeId: number) => void;
  onDeclineChallengeInvite: (challengeId: number) => void;
};

/** An invite someone sent to this user: sender, stakes and a clear accept. */
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
  const sender = challenge.members.find((member) => member.user_id === challenge.owner_id);
  const name = sender?.username ?? t("friendsScreen.challengeSomeone");
  const accepting = actions.busyActionKey === `accept_challenge_${challenge.id}`;
  const busy = accepting || actions.busyActionKey === `decline_challenge_${challenge.id}`;
  const stakes = t("duelBoard.inviteStakes", {
    sessions: challenge.target_sessions,
    days: challenge.duration_days ?? 7,
  });
  return (
    <View style={styles.duelInviteRow} testID={`duel-invite-${challenge.id}`}>
      {divided ? <View style={styles.duelInviteDivider} /> : null}
      <Avatar
        name={name}
        photoUri={profilePictureUrl(sender?.profile_picture_url)}
        size={AVATAR_SIZE}
        ring="accent"
      />
      <View style={styles.inviteCopy}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {name}
        </Text>
        <Text style={styles.rowMeta} numberOfLines={1}>
          {t("friendsScreen.challengeInviteIncomingMeta")} · {stakes}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("friendsScreen.challengeDecline")}
        style={({ pressed }) => [styles.declineBtn, pressed && styles.actionPressed]}
        disabled={busy}
        hitSlop={6}
        onPress={() => actions.onDeclineChallengeInvite(challenge.id)}
      >
        <Text style={styles.declineText}>{t("friendsScreen.challengeDecline")}</Text>
      </Pressable>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={t("friendsScreen.accept")}
        accessibilityState={{ disabled: busy, busy: accepting }}
        style={styles.acceptPill}
        disabled={busy}
        onPress={() => {
          Haptics.selectionAsync().catch(() => undefined);
          actions.onAcceptChallengeInvite(challenge.id);
        }}
      >
        {accepting ? (
          <ActivityIndicator size="small" color={colors.textPrimary} />
        ) : (
          <Text style={styles.acceptPillText}>{t("friendsScreen.accept")}</Text>
        )}
      </PressableScale>
    </View>
  );
}
