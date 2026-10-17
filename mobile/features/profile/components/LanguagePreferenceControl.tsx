import type { TFunction } from "i18next";
import { Text, View } from "react-native";

import { SegmentedControl } from "../../../components/ui/SegmentedControl";
import { spacing } from "../../../constants/theme";
import type { LanguagePreference } from "../../../lib/languagePreference";
import { profileScreenStyles as styles } from "../profileScreen.styles";

type Props = {
  t: TFunction;
  preference: LanguagePreference;
  onChange: (preference: LanguagePreference) => void;
};

const OPTIONS: readonly LanguagePreference[] = ["system", "en", "de"];

export function LanguagePreferenceControl({ t, preference, onChange }: Props) {
  const options = OPTIONS.map((value) => ({
    value,
    label:
      value === "system"
        ? t("profile.languageSystem")
        : value === "en"
          ? t("profile.languageEnglish")
          : t("profile.languageGerman"),
  }));

  return (
    <View
      style={[styles.settingsCard, { padding: spacing.md }]}
      accessibilityLabel={t("profile.languageA11y")}
    >
      <Text style={styles.languageLabel}>{t("profile.language")}</Text>
      <SegmentedControl
        options={options}
        value={preference}
        onChange={onChange}
        compact
      />
    </View>
  );
}
