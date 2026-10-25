import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { SessionCompleteWeekCard } from "../../../components/session/SessionCompleteWeekCard";
import { PrimaryButton } from "../../../components/ui/PrimaryButton";
import { TextButton } from "../../../components/ui/TextButton";
import { colors } from "../../../constants/theme";
import { ReminderPromptCard } from "../../notifications/ReminderPromptCard";
import type { SessionCompleteController } from "../hooks/useSessionCompleteController";
import { styles } from "../sessionComplete.styles";
import { SessionChallengeCreditsCard } from "./SessionChallengeCreditsCard";
import { SessionCompleteFocusCard } from "./SessionCompleteFocusCard";
import { SessionCompleteHero } from "./SessionCompleteHero";

export function SessionCompleteView({ controller }: { controller: SessionCompleteController }) {
  if (controller.loadState === "loading") return <LoadingView controller={controller} />;
  if (controller.loadState === "error") return <ErrorView controller={controller} />;
  const { t } = controller;
  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]} testID="session-complete-screen">
      {/* Sized to fit one screen; it only scrolls once the Worked-on editor grows. */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        alwaysBounceVertical={false}
      >
        <SessionCompleteHero controller={controller} />
        {controller.session && controller.focusReflectionType ? (
          <SessionCompleteFocusCard
            session={controller.session}
            sessionType={controller.focusReflectionType}
            totalSessions={controller.totalSessions}
          />
        ) : null}
        <SessionCompleteWeekCard
          t={t}
          feedback={controller.feedback}
          weekSessionsCount={controller.weekSessionsCount}
          weeklyGoalTarget={controller.weeklyGoalTarget}
          paceForecast={controller.paceForecast}
        />
        <ReminderPromptCard />
        <SessionChallengeCreditsCard
          credits={controller.challengeCredits}
          currentUserId={controller.currentUserId}
        />
      </ScrollView>
      <View style={styles.footer}>
        <PrimaryButton
          label={t("sessionComplete.backToDashboard")}
          onPress={controller.openDashboard}
          testID="session-complete-back"
        />
      </View>
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
