import type { TFunction } from "i18next";
import { Check } from "lucide-react-native";
import { Text, View } from "react-native";
import Animated, { FadeIn, ZoomIn } from "react-native-reanimated";

import { PrimaryButton } from "../../../components/ui/PrimaryButton";
import { colors } from "../../../constants/theme";
import { challengeCreateStyles as styles } from "../challengeCreate.styles";

const BADGE_ENTER = ZoomIn.springify().damping(14);
const COPY_ENTER = FadeIn.duration(220).delay(120);

type Props = {
  t: TFunction;
  friendName: string;
  onDone: () => void;
};

export function ChallengeSentView({ t, friendName, onDone }: Props) {
  return (
    <View style={styles.centered} testID="challenge-sent">
      <Animated.View entering={BADGE_ENTER} style={styles.sentBadge}>
        <Check size={44} color={colors.textPrimary} strokeWidth={3} />
      </Animated.View>
      <Animated.View entering={COPY_ENTER} style={styles.sentCopy} accessibilityLiveRegion="polite">
        <Text style={styles.sentTitle} accessibilityRole="header">
          {t("challengeCreate.sentTitle")}
        </Text>
        <Text style={styles.mutedText}>
          {t("challengeCreate.sentBody", { friend: friendName })}
        </Text>
      </Animated.View>
      <View style={styles.sentActions}>
        <PrimaryButton label={t("challengeCreate.done")} onPress={onDone} />
      </View>
    </View>
  );
}
