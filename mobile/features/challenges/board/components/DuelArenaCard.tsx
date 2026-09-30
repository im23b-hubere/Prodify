import type { TFunction } from "i18next";
import { Hourglass } from "lucide-react-native";
import { memo } from "react";
import { Pressable, Text, View } from "react-native";

import { Avatar } from "../../../../components/ui/Avatar";
import { PrimaryButton } from "../../../../components/ui/PrimaryButton";
import { colors } from "../../../../constants/theme";
import type { DuelRecordDto, SocialChallengeDto } from "../../../../types/friends";
import { profilePictureUrl } from "../../../profile/friendProfilePresentation";
import { duelParticipants } from "../../duelParticipants";
import { type DuelStanding, duelDaysLeft, duelStanding, hasDuelHistory } from "../duelBoard";
import { duelBoardStyles as styles } from "../duelBoard.styles";
import { duelRecordLabel } from "../duelRecordLabel";
import { DuelProgressBar } from "./DuelProgressBar";

const AVATAR_SIZE = 64;

type Props = {
  t: TFunction;
  challenge: SocialChallengeDto;
  currentUserId: number | undefined;
  /** Lifetime record against this opponent, shown under the VS disc once they have played before. */
  record: DuelRecordDto | undefined;
  onOpen: (challengeId: number) => void;
  onStartSession: () => void;
};

export const DuelArenaCard = memo(function DuelArenaCard({
  t,
  challenge,
  currentUserId,
  record,
  onOpen,
  onStartSession,
}: Props) {
  const { you, opponent } = duelParticipants(challenge, currentUserId);
  const youLabel = t("friendsScreen.buddyDuelYouLabel");
  const opponentName = opponent?.username ?? t("friendsScreen.challengeSomeone");
  const yourScore = you?.progress_sessions ?? 0;
  const opponentScore = opponent?.progress_sessions ?? 0;
  const standing = duelStanding(yourScore, opponentScore);
  const standingText = standingLine(standing, t, opponentName, challenge.target_sessions);
  const recordLabel = hasDuelHistory(record) ? duelRecordLabel(t, record) : null;

  return (
    <View style={styles.card} testID="duel-arena">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("duelBoard.arenaA11y", {
          title: challenge.title,
          standing: recordLabel ? `${standingText}. ${recordLabel.spoken}` : standingText,
        })}
        style={({ pressed }) => [styles.arena, pressed && styles.rowPressed]}
        onPress={() => onOpen(challenge.id)}
      >
        <View style={styles.arenaTop}>
          <Text style={styles.arenaTitle} numberOfLines={1}>
            {challenge.title}
          </Text>
          <View style={styles.daysChip}>
            <Hourglass size={12} color={colors.primary} />
            <Text style={styles.daysChipText}>
              {t("duelBoard.daysLeft", { count: duelDaysLeft(challenge) })}
            </Text>
          </View>
        </View>

        <View style={styles.vsRow}>
          <View style={styles.vsSide}>
            <Avatar
              name={you?.username ?? youLabel}
              photoUri={profilePictureUrl(you?.profile_picture_url)}
              size={AVATAR_SIZE}
              ring="accent"
            />
            <Text style={styles.vsName} numberOfLines={1}>
              {youLabel}
            </Text>
          </View>
          <View style={styles.vsCenter}>
            <View style={styles.vsDisc}>
              <Text style={styles.vsText}>VS</Text>
            </View>
            {recordLabel ? (
              <Text
                style={[styles.record, recordLabel.isWinning && styles.recordWinning]}
                testID="duel-arena-record"
              >
                {recordLabel.short}
              </Text>
            ) : null}
          </View>
          <View style={styles.vsSide}>
            <Avatar
              name={opponentName}
              photoUri={profilePictureUrl(opponent?.profile_picture_url)}
              size={AVATAR_SIZE}
            />
            <Text style={styles.vsName} numberOfLines={1}>
              {opponentName}
            </Text>
          </View>
        </View>

        <Text style={[styles.standing, standing.kind === "leading" && styles.standingAccent]}>
          {standingText}
        </Text>

        <View style={styles.bars}>
          <DuelProgressBar
            label={youLabel}
            current={yourScore}
            target={challenge.target_sessions}
            highlighted
          />
          <DuelProgressBar
            label={opponentName}
            current={opponentScore}
            target={challenge.target_sessions}
          />
        </View>
      </Pressable>
      <View style={styles.arenaAction}>
        <PrimaryButton
          label={t("duelBoard.startSession")}
          onPress={onStartSession}
          testID="duel-arena-start"
        />
      </View>
    </View>
  );
});

function standingLine(standing: DuelStanding, t: TFunction, opponentName: string, target: number) {
  switch (standing.kind) {
    case "fresh":
      return t("duelBoard.standingFresh", { target });
    case "tied":
      return t("duelBoard.standingTied");
    case "leading":
      return t("duelBoard.standingLeading", { count: standing.gap });
    case "behind":
      return t("duelBoard.standingBehind", { count: standing.gap, name: opponentName });
  }
}
