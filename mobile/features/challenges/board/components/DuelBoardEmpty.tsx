import type { TFunction } from "i18next";
import { Swords } from "lucide-react-native";
import { Text, View } from "react-native";

import { Avatar } from "../../../../components/ui/Avatar";
import { PrimaryButton } from "../../../../components/ui/PrimaryButton";
import { colors } from "../../../../constants/theme";
import type { ChallengeFriendOption } from "../../../challengeCreate/challengeFriends";
import { duelBoardStyles as styles } from "../duelBoard.styles";

const PREVIEW_COUNT = 3;
const AVATAR_SIZE = 54;

type Props = {
  t: TFunction;
  rivals: ChallengeFriendOption[];
  onStartDuel: () => void;
  onAddFriend: () => void;
};

export function DuelBoardEmpty({ t, rivals, onStartDuel, onAddFriend }: Props) {
  const hasFriends = rivals.length > 0;
  return (
    <View style={[styles.card, styles.empty]} testID="duel-board-empty">
      <View style={styles.emptyAvatars}>
        {hasFriends ? (
          rivals.slice(0, PREVIEW_COUNT).map((rival, index) => (
            <View
              key={rival.userId}
              style={[styles.emptyAvatarRing, index > 0 && styles.emptyAvatarOverlap]}
            >
              <Avatar name={rival.username} photoUri={rival.photoUri} size={AVATAR_SIZE} />
            </View>
          ))
        ) : (
          <View style={styles.newDuelCircle}>
            <Swords size={24} color={colors.primary} />
          </View>
        )}
      </View>
      <Text style={styles.emptyTitle} accessibilityRole="header">
        {t("duelBoard.emptyTitle")}
      </Text>
      <Text style={styles.emptyBody}>
        {t(hasFriends ? "duelBoard.emptyBody" : "duelBoard.emptyNoFriendsBody")}
      </Text>
      <View style={styles.emptyAction}>
        <PrimaryButton
          label={t(hasFriends ? "duelBoard.emptyCta" : "duelBoard.emptyAddFriend")}
          onPress={hasFriends ? onStartDuel : onAddFriend}
          testID="duel-board-empty-cta"
        />
      </View>
    </View>
  );
}
