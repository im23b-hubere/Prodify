import { Pressable, Text, View } from "react-native";

import { SessionInsightSections } from "../../../components/session/SessionInsightSections";
import { SESSION_INSIGHTS_MIN_SECONDS } from "../hooks/useSessionDetailData";
import type { SessionDetailController } from "../hooks/useSessionDetailController";
import { sessionDetailStyles as styles } from "../sessionDetail.styles";

export function SessionDetailInsights({ controller }: { controller: SessionDetailController }) {
  const { t, session, insights } = controller;
  if (!session) return null;
  return (
    <>
      {controller.insightsError ? (
        <Pressable
          accessibilityRole="button"
          onPress={controller.retryInsights}
          style={({ pressed }) => [styles.insightsWarning, pressed && { opacity: 0.92 }]}
        >
          <Text style={styles.insightsWarningText}>{controller.insightsError}</Text>
          <Text style={styles.insightsWarningAction}>{t("common.tryAgain")}</Text>
        </Pressable>
      ) : null}
      {insights ? (
        <SessionInsightSections
          session={session}
          insights={insights}
          producerName={
            controller.isOwnSession ? controller.user?.username : controller.producerName
          }
        />
      ) : session.duration_seconds != null &&
        session.duration_seconds < SESSION_INSIGHTS_MIN_SECONDS ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("sessionInsights.productivity")}</Text>
          <Text style={styles.mutedNote}>
            {t("sessionInsights.availableAfterMinSession", { min: 5 })}
          </Text>
        </View>
      ) : null}
    </>
  );
}
