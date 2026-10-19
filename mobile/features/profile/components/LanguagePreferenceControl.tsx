import type { TFunction } from "i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { SegmentedControl } from "../../../components/ui/SegmentedControl";
import { fontFamily } from "../../../constants/fonts";
import { colors, radii, spacing, typography } from "../../../constants/theme";
import { APP_LANGUAGE_DEFINITIONS, APP_LANGUAGES } from "../../../lib/i18nLanguages";
import type { LanguagePreference } from "../../../lib/languagePreference";
import { profileScreenStyles as styles } from "../profileScreen.styles";

type Props = {
  t: TFunction;
  preference: LanguagePreference;
  onChange: (preference: LanguagePreference) => void;
};

type Option = { value: LanguagePreference; label: string };

function languagePreferenceOptions(t: TFunction): Option[] {
  return [
    { value: "system", label: t("profile.languageSystem") },
    ...APP_LANGUAGES.map((code) => ({
      value: code,
      label: APP_LANGUAGE_DEFINITIONS[code].nativeName,
    })),
  ];
}

/** Compact segments while the catalog is small; a list once many languages are registered. */
const SEGMENTED_OPTION_LIMIT = 4;

export function LanguagePreferenceControl({ t, preference, onChange }: Props) {
  const options = languagePreferenceOptions(t);

  return (
    <View
      style={[styles.settingsCard, { padding: spacing.md }]}
      accessibilityLabel={t("profile.languageA11y")}
    >
      <Text style={styles.languageLabel}>{t("profile.language")}</Text>
      {options.length <= SEGMENTED_OPTION_LIMIT ? (
        <SegmentedControl options={options} value={preference} onChange={onChange} compact />
      ) : (
        <View style={listStyles.list}>
          {options.map((option) => {
            const selected = option.value === preference;
            return (
              <Pressable
                key={option.value}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => onChange(option.value)}
                style={[listStyles.row, selected ? listStyles.rowSelected : null]}
              >
                <Text style={[listStyles.rowLabel, selected ? listStyles.rowLabelSelected : null]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

const listStyles = StyleSheet.create({
  list: {
    gap: spacing.xs,
  },
  row: {
    borderRadius: radii.md,
    borderCurve: "continuous",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.background,
  },
  rowSelected: {
    backgroundColor: colors.primary,
  },
  rowLabel: {
    ...typography.body,
    fontFamily: fontFamily.body,
    color: colors.textPrimary,
  },
  rowLabelSelected: {
    fontFamily: fontFamily.bodyMedium,
    color: colors.textPrimary,
  },
});
