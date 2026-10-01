import * as Haptics from "expo-haptics";
import type { TFunction } from "i18next";
import { Sparkles } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

import { SKILL_FOCUS_ICONS } from "../../constants/skillIcons";
import { branchOfFocus } from "../../constants/skills";
import { colors, motion } from "../../constants/theme";
import type { FocusSuggestion } from "../../features/sessions/focusSuggestions";
import type { SkillFocusFields } from "../../features/sessions/hooks/useSkillFocusFields";
import { formatCompactDuration } from "../../features/sessions/skillProgressPresentation";
import { skillFocusText } from "../../lib/skillI18n";
import { sessionTypeAccent } from "./SkillFocusChips";
import { focusSuggestionStyles as styles } from "./focusSuggestions.styles";

type FocusSuggestionsProps = {
  suggestions: FocusSuggestion[];
  fields: SkillFocusFields;
};

/** One-tap picks above the focus chips; absent until there is something worth suggesting. */
export function FocusSuggestions({ suggestions, fields }: FocusSuggestionsProps) {
  const { t } = useTranslation();
  if (suggestions.length === 0) return null;

  return (
    <Animated.View
      entering={FadeIn.duration(motion.standard)}
      style={styles.section}
      testID="focus-suggestions"
    >
      <View style={styles.titleRow}>
        <Sparkles size={13} color={colors.textSecondary} strokeWidth={2.2} />
        <Text style={styles.title}>{t("sessionSetup.suggestionsTitle")}</Text>
      </View>
      <View style={styles.row}>
        {suggestions.map((suggestion) => (
          <SuggestionPill
            key={suggestion.id}
            suggestion={suggestion}
            reason={suggestionReason(suggestion, t)}
            isSelected={fields.focusIds.includes(suggestion.id)}
            isDisabled={!fields.canApplySuggestion(suggestion.id)}
            onPress={fields.applySuggestion}
          />
        ))}
      </View>
    </Animated.View>
  );
}

type SuggestionPillProps = {
  suggestion: FocusSuggestion;
  reason: string;
  isSelected: boolean;
  isDisabled: boolean;
  onPress: SkillFocusFields["applySuggestion"];
};

function SuggestionPill({
  suggestion,
  reason,
  isSelected,
  isDisabled,
  onPress,
}: SuggestionPillProps) {
  const { t } = useTranslation();
  const { id } = suggestion;
  const Icon = SKILL_FOCUS_ICONS[id];
  const accent = sessionTypeAccent(branchOfFocus(id));

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: isSelected, disabled: isDisabled }}
      accessibilityLabel={t("sessionSetup.suggestionA11yLabel", {
        focus: skillFocusText(id, "label", t),
        reason,
      })}
      accessibilityHint={skillFocusText(id, "description", t)}
      disabled={isDisabled}
      testID={`focus-suggestion-${id}`}
      onPress={() => {
        Haptics.selectionAsync().catch(() => undefined);
        onPress(id);
      }}
      style={({ pressed }) => [
        styles.pill,
        isSelected && { borderColor: accent, backgroundColor: `${accent}26` },
        isDisabled && styles.pillDisabled,
        pressed && styles.pillPressed,
      ]}
    >
      <View style={[styles.icon, { backgroundColor: `${accent}${isSelected ? "40" : "1f"}` }]}>
        <Icon size={16} color={isSelected ? colors.textPrimary : accent} strokeWidth={2.2} />
      </View>
      <View style={styles.text}>
        <Text style={styles.name} numberOfLines={1}>
          {skillFocusText(id, "short", t)}
        </Text>
        <Text style={styles.reason} numberOfLines={1}>
          {reason}
        </Text>
      </View>
    </Pressable>
  );
}

function suggestionReason(suggestion: FocusSuggestion, t: TFunction): string {
  switch (suggestion.reason) {
    case "levelUp":
      return t("sessionSetup.suggestionLevelUp", {
        time: formatCompactDuration(suggestion.secondsToNextLevel),
        level: suggestion.nextLevel,
      });
    case "resting":
      return t("sessionSetup.suggestionResting", { count: suggestion.days });
    case "keepGoing":
      return t("sessionSetup.suggestionKeepGoing", { level: suggestion.level });
    case "discover":
      return t("sessionSetup.suggestionDiscover");
  }
}
