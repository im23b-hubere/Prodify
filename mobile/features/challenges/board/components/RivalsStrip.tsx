import * as Haptics from "expo-haptics";
import type { TFunction } from "i18next";
import { Plus } from "lucide-react-native";
import { memo } from "react";
import { ScrollView, Text, View } from "react-native";

import { Avatar } from "../../../../components/ui/Avatar";
import { PressableScale } from "../../../../components/ui/PressableScale";
import { colors } from "../../../../constants/theme";
import type { DuelRecordDto } from "../../../../types/friends";
import type { FriendDuelStatus } from "../../../challengeCreate/challengeDraft";
import type { ChallengeFriendOption } from "../../../challengeCreate/challengeFriends";
import { hasDuelHistory } from "../duelBoard";
import { duelBoardStyles as styles } from "../duelBoard.styles";
import { duelRecordLabel } from "../duelRecordLabel";

const AVATAR_SIZE = 56;

type Props = {
  t: TFunction;
  rivals: ChallengeFriendOption[];
  statuses: Map<number, FriendDuelStatus>;
  records: Map<number, DuelRecordDto>;
  onNewDuel: () => void;
  onChallenge: (friendId: number) => void;
};

/** Recent rivals first; one tap opens the duel sheet with that friend preselected. */
export const RivalsStrip = memo(function RivalsStrip({
  t,
  rivals,
  statuses,
  records,
  onNewDuel,
  onChallenge,
}: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.rivalsContent}
      testID="duel-rivals"
    >
      <PressableScale
        style={styles.rival}
        accessibilityRole="button"
        accessibilityLabel={t("duelBoard.newDuelA11y")}
        onPress={() => {
          Haptics.selectionAsync().catch(() => undefined);
          onNewDuel();
        }}
        testID="duel-rivals-new"
      >
        <View style={styles.newDuelCircle}>
          <Plus size={22} color={colors.primary} strokeWidth={2.5} />
        </View>
        <Text style={styles.rivalName} numberOfLines={1}>
          {t("duelBoard.newDuel")}
        </Text>
      </PressableScale>
      {rivals.map((rival) => (
        <RivalAvatar
          key={rival.userId}
          t={t}
          rival={rival}
          status={statuses.get(rival.userId) ?? "available"}
          record={records.get(rival.userId)}
          onChallenge={onChallenge}
        />
      ))}
    </ScrollView>
  );
});

function RivalAvatar({
  t,
  rival,
  status,
  record,
  onChallenge,
}: {
  t: TFunction;
  rival: ChallengeFriendOption;
  status: FriendDuelStatus;
  record: DuelRecordDto | undefined;
  onChallenge: (friendId: number) => void;
}) {
  const blocked = status === "invite_pending";
  const a11yKey =
    status === "invite_pending"
      ? "duelBoard.rivalInvitePendingA11y"
      : status === "in_duel"
        ? "duelBoard.rivalInDuelA11y"
        : "duelBoard.rivalA11y";
  const rivalLabel = t(a11yKey, { name: rival.username });
  const recordLabel = hasDuelHistory(record) ? duelRecordLabel(t, record) : null;
  return (
    <PressableScale
      style={[styles.rival, blocked && styles.rivalDimmed]}
      accessibilityRole="button"
      accessibilityLabel={
        recordLabel
          ? t("duelBoard.rivalRecordA11y", { rival: rivalLabel, record: recordLabel.spoken })
          : rivalLabel
      }
      accessibilityState={{ disabled: blocked }}
      disabled={blocked}
      onPress={() => {
        Haptics.selectionAsync().catch(() => undefined);
        onChallenge(rival.userId);
      }}
      testID={`duel-rival-${rival.userId}`}
    >
      <View>
        <Avatar name={rival.username} photoUri={rival.photoUri} size={AVATAR_SIZE} />
        {status === "in_duel" ? <View style={styles.liveDot} /> : null}
      </View>
      <Text style={styles.rivalName} numberOfLines={1}>
        {rival.username}
      </Text>
      {recordLabel ? (
        <Text
          style={[styles.record, recordLabel.isWinning && styles.recordWinning]}
          testID={`duel-rival-record-${rival.userId}`}
        >
          {recordLabel.short}
        </Text>
      ) : null}
    </PressableScale>
  );
}
