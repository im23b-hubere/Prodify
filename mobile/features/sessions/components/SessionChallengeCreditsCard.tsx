import { useRouter } from "expo-router";
import { Check, ChevronRight, Minus } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { colors, motion } from "../../../constants/theme";
import type { SessionChallengeCreditDto } from "../../../types/friends";
import { describeChallengeCredit } from "../sessionChallengeCredits";
import { styles } from "../sessionComplete.styles";

type Props = {
  credits: SessionChallengeCreditDto[];
  currentUserId: number | undefined;
};

export function SessionChallengeCreditsCard({ credits, currentUserId }: Props) {
  const { t } = useTranslation();
  if (credits.length === 0) return null;
  return (
    <Animated.View
      entering={FadeInDown.duration(motion.standard)}
      style={styles.focusCard}
      testID="session-complete-challenges"
    >
      <Text style={[styles.focusEyebrow, { color: colors.primary }]}>
        {t("sessionComplete.challengesEyebrow")}
      </Text>
      {credits.map((credit) => (
        <ChallengeCreditRow key={credit.challenge_id} credit={credit} currentUserId={currentUserId} />
      ))}
    </Animated.View>
  );
}

function ChallengeCreditRow({
  credit,
  currentUserId,
}: {
  credit: SessionChallengeCreditDto;
  currentUserId: number | undefined;
}) {
  const { t } = useTranslation();
  const { push } = useRouter();
  const line = describeChallengeCredit(credit, currentUserId);
  const detail = t(line.key, line.params);
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${credit.title}. ${detail}`}
      onPress={() => push(`/challenge/${credit.challenge_id}`)}
      style={({ pressed }) => [styles.creditRow, pressed && styles.focusRetryPressed]}
    >
      <View style={[styles.creditIcon, line.counted && styles.creditIconCounted]}>
        {line.counted ? (
          <Check size={14} color={colors.success} strokeWidth={3} />
        ) : (
          <Minus size={14} color={colors.textSecondary} strokeWidth={3} />
        )}
      </View>
      <View style={styles.creditText}>
        <Text style={styles.creditTitle} numberOfLines={1}>
          {credit.title}
        </Text>
        <Text style={styles.creditDetail}>{detail}</Text>
      </View>
      <ChevronRight size={16} color={colors.textSecondary} />
    </Pressable>
  );
}
