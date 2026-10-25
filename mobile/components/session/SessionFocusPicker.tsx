import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

import { MAX_PLANNED_FOCUSES_PER_SESSION } from "../../constants/skills";
import { motion } from "../../constants/theme";
import type { SessionSetupFormState } from "../../features/sessions/hooks/useSessionSetupForm";
import { FocusSuggestions } from "./FocusSuggestions";
import { SkillFocusChips } from "./SkillFocusChips";
import { sessionSetupStyles as styles } from "./sessionSetup.styles";

/**
 * The optional focus picker, opened right under the selected type. The dashed outline and
 * the "Optional" chip say it can be skipped: Start works without it.
 */
export function SessionFocusPicker({ form }: { form: SessionSetupFormState }) {
  const { t } = useTranslation();
  if (!form.selectedType) return null;

  return (
    <Animated.View
      key={form.selectedType}
      entering={FadeIn.duration(motion.standard)}
      style={styles.focusPanel}
    >
      <View style={styles.focusHeader}>
        <Text style={[styles.sectionLabel, styles.focusHeaderLabel]}>
          {t("sessionSetup.focusSection")}
        </Text>
        <View style={styles.focusOptionalChip}>
          <Text style={styles.focusHint} accessibilityLiveRegion="polite">
            {form.isFocusSelectionFull
              ? t("sessionSetup.focusLimitReached", { max: MAX_PLANNED_FOCUSES_PER_SESSION })
              : t("sessionSetup.focusHint", { max: MAX_PLANNED_FOCUSES_PER_SESSION })}
          </Text>
        </View>
      </View>
      <FocusSuggestions suggestions={form.focusSuggestions} fields={form} />
      <SkillFocusChips sessionType={form.selectedType} fields={form} showPracticePrompts />
    </Animated.View>
  );
}
