import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { SessionSetupForm } from "../../components/session/SessionSetupForm";
import { CrashBoundary } from "../../components/ui/CrashBoundary";
import { colors } from "../../constants/theme";

export default function SessionSetupScreen() {
  const router = useRouter();
  const { t } = useTranslation();

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <CrashBoundary
        scope="session_setup_screen"
        fallbackTitle={t("crashBoundary.sessionSetupTitle")}
        fallbackMessage={t("crashBoundary.sessionSetupScreenMessage")}
        onRecover={() => router.back()}
      >
        <SessionSetupForm
          onStarted={() => router.replace("/(tabs)/dashboard")}
          onRequestClose={() => router.back()}
        />
      </CrashBoundary>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
});
