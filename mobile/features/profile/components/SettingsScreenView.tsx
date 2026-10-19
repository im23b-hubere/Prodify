import { ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ScreenTopBar } from "../../../components/ui/ScreenTopBar";
import type { SettingsScreenController } from "../hooks/useSettingsScreenController";
import { profileScreenStyles as styles } from "../profileScreen.styles";
import { ProfileSettingsSection } from "./ProfileSettingsSection";

export function SettingsScreenView({ controller }: { controller: SettingsScreenController }) {
  const { t, navigation } = controller;
  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="settings-screen">
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenTopBar
          title={t("profile.settingsTitle")}
          onBack={navigation.goBack}
          style={styles.settingsTopBar}
        />
        <ProfileSettingsSection controller={controller} />
      </ScrollView>
    </SafeAreaView>
  );
}
