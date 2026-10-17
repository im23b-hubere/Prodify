import { ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ScreenTopBar } from "../../../components/ui/ScreenTopBar";
import type { SettingsScreenController } from "../hooks/useSettingsScreenController";
import { profileScreenStyles as styles } from "../profileScreen.styles";
import { LanguagePreferenceControl } from "./LanguagePreferenceControl";
import { ProfileSettingsSection } from "./ProfileSettingsSection";

export function SettingsScreenView({ controller }: { controller: SettingsScreenController }) {
  const { t, navigation, language } = controller;
  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="settings-screen">
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenTopBar
          title={t("profile.settingsTitle")}
          onBack={navigation.goBack}
          style={styles.settingsTopBar}
        />
        <LanguagePreferenceControl
          t={t}
          preference={language.preference}
          onChange={(value) => {
            void language.selectPreference(value);
          }}
        />
        <ProfileSettingsSection controller={controller} />
      </ScrollView>
    </SafeAreaView>
  );
}
