import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { SessionCompleteWeekCard } from "../../../components/session/SessionCompleteWeekCard";
import { PrimaryButton } from "../../../components/ui/PrimaryButton";
import { SecondaryButton } from "../../../components/ui/SecondaryButton";
import { TextButton } from "../../../components/ui/TextButton";
import { colors } from "../../../constants/theme";
import type { SessionCompleteController } from "../hooks/useSessionCompleteController";
import { styles } from "../sessionComplete.styles";
import { SessionCompleteHero } from "./SessionCompleteHero";

export function SessionCompleteView({ controller }: { controller: SessionCompleteController }) {
  if (controller.loadState === "loading") return <LoadingView controller={controller} />;
  if (controller.loadState === "error") return <ErrorView controller={controller} />;
  const { t } = controller;
  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]} testID="session-complete-screen">
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <SessionCompleteHero controller={controller} />
        <SessionCompleteWeekCard
          t={t}
          feedback={controller.feedback}
          weekSessionsCount={controller.weekSessionsCount}
          weeklyGoalTarget={controller.weeklyGoalTarget}
          paceForecast={controller.paceForecast}
        />
        <View style={styles.actions}>
          <PrimaryButton
            label={t("sessionComplete.viewDetails")}
            onPress={controller.openDetails}
          />
          <SecondaryButton
            label={t("sessionComplete.backToDashboard")}
            onPress={controller.openDashboard}
            testID="session-complete-back"
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function LoadingView({ controller }: { controller: SessionCompleteController }) {
  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.loadingTitle}>{controller.t("sessionComplete.title")}</Text>
        <Text style={styles.muted}>{controller.t("sessionComplete.loadingSession")}</Text>
      </View>
    </SafeAreaView>
  );
}

function ErrorView({ controller }: { controller: SessionCompleteController }) {
  const { t } = controller;
  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.centered}>
        <Text style={styles.loadingTitle}>{t("sessionComplete.errorTitle")}</Text>
        <Text style={styles.muted}>
          {controller.loadError ?? t("sessionComplete.unknownError")}
        </Text>
        <View style={styles.actions}>
          <PrimaryButton
            label={t("sessionComplete.tryAgain")}
            onPress={() => void controller.reload()}
          />
          <TextButton
            label={t("sessionComplete.backToDashboard")}
            onPress={controller.openDashboard}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}
