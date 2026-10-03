import type { TFunction } from "i18next";
import { ChevronLeft } from "lucide-react-native";
import { Text, View } from "react-native";

import { PressableScale } from "../../../components/ui/PressableScale";
import { colors } from "../../../constants/theme";
import { CHALLENGE_STEPS, type ChallengeStep } from "../challengeDraft";
import { challengeCreateStyles as styles } from "../challengeCreate.styles";

type Props = {
  t: TFunction;
  step: ChallengeStep;
  onBack: (() => void) | null;
};

/** Steps, title and back arrow. Closing is the sheet's own swipe down, so there is no close button. */
export function ChallengeSheetHeader({ t, step, onBack }: Props) {
  const stepIndex = CHALLENGE_STEPS.indexOf(step);
  return (
    <View style={styles.header}>
      {/* The page sheet has no native grabber; this one hints at pulling down to close. */}
      <View style={styles.grabber} accessibilityElementsHidden importantForAccessibility="no" />
      <View style={styles.headerBar}>
        {onBack ? (
          <PressableScale
            style={styles.iconButton}
            accessibilityRole="button"
            accessibilityLabel={t("challengeCreate.back")}
            onPress={onBack}
          >
            <ChevronLeft size={20} color={colors.textPrimary} />
          </PressableScale>
        ) : (
          <View style={styles.iconButtonPlaceholder} />
        )}
        <View
          style={styles.progress}
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel={t("challengeCreate.progressA11y", {
            step: stepIndex + 1,
            total: CHALLENGE_STEPS.length,
          })}
        >
          {CHALLENGE_STEPS.map((item, index) => (
            <View
              key={item}
              style={[styles.progressSegment, index <= stepIndex && styles.progressSegmentDone]}
            />
          ))}
        </View>
        {/* Mirrors the back button's slot so the step dashes stay centred. */}
        <View style={styles.iconButtonPlaceholder} />
      </View>
      <View>
        <Text style={styles.heading} accessibilityRole="header">
          {t(`challengeCreate.steps.${step}.title`)}
        </Text>
        <Text style={styles.subheading}>{t(`challengeCreate.steps.${step}.subtitle`)}</Text>
      </View>
    </View>
  );
}
