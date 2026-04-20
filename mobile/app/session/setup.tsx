import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { SessionSetupForm } from "../../components/session/SessionSetupForm";
import { ScreenHeader } from "../../components/ui/ScreenHeader";
import { SESSION_TYPE_IDS, type SessionType } from "../../constants/sessionTypes";
import { CrashBoundary } from "../../components/ui/CrashBoundary";
import { colors, spacing, ui } from "../../constants/theme";

export default function SessionSetupScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ suggestedType?: string }>();
  const suggestedType = useMemo<SessionType | null>(() => {
    const rawParam = params.suggestedType;
    const raw = Array.isArray(rawParam) ? rawParam[0] : rawParam;
    if (!raw) return null;
    return SESSION_TYPE_IDS.includes(raw as SessionType) ? (raw as SessionType) : null;
  }, [params.suggestedType]);

  const closeSetup = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/(tabs)/dashboard");
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <CrashBoundary
        scope="session_setup_screen"
        fallbackTitle={t("crashBoundary.sessionSetupTitle")}
        fallbackMessage={t("crashBoundary.sessionSetupScreenMessage")}
        onRecover={closeSetup}
      >
        <>
          <ScreenHeader
            title={t("dashboard.newSessionTitle")}
            subtitle={t("sessionSetup.startCta")}
            actionLabel={t("common.cancel")}
            onActionPress={closeSetup}
          />
          <SessionSetupForm
            hideTitleRow
            initialSessionType={suggestedType}
            onStarted={() => router.replace("/(tabs)/dashboard")}
            onRequestClose={closeSetup}
          />
        </>
      </CrashBoundary>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: ui.screenPadding / 2,
    paddingTop: spacing.sm,
  },
});
