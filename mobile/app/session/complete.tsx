import { useLocalSearchParams, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { SessionCompleteWeekCard } from "../../components/session/SessionCompleteWeekCard";
import { PrimaryButton } from "../../components/ui/PrimaryButton";
import { SecondaryButton } from "../../components/ui/SecondaryButton";
import { StatTile } from "../../components/ui/StatTile";
import { TextButton } from "../../components/ui/TextButton";
import { colors } from "../../constants/theme";
import { useAuth } from "../../context/AuthContext";
import { buildWeeklyForecast } from "../../lib/forecastEngine";
import { adjustedWeeklyTargetForSignupWeek } from "../../lib/goalPace";
import { progressionLevelName } from "../../lib/progressionLevels";
import { buildSessionFeedback } from "../../lib/sessionFeedbackEngine";
import { sessionMoodLabel, sessionTypeLabel } from "../../lib/sessionI18n";
import { formatDurationWords } from "../../lib/sessionTime";
import {
  estimateSessionXpGain,
  MINIMUM_COUNTED_SESSION_MINUTES,
  sessionHighlightKey,
  shortenSessionLabel,
} from "../../features/sessions/sessionCompletePresentation";
import { styles } from "../../features/sessions/sessionComplete.styles";
import { useSessionCompleteData } from "../../features/sessions/hooks/useSessionCompleteData";

export default function SessionCompleteScreen() {
  const { t } = useTranslation();
  const { token, user } = useAuth();
  const router = useRouter();
  const raw = useLocalSearchParams<{ id: string | string[] }>().id;
  const id = Array.isArray(raw) ? raw[0] : raw;

  const {
    session,
    streak,
    progression,
    weeklyGoalTarget,
    weekSessionsCount,
    loadState,
    loadError,
    reload,
  } = useSessionCompleteData(token, id, t);

  const dur = session?.duration_seconds ?? 0;
  const effectiveWeeklyGoalTarget = useMemo(
    () =>
      adjustedWeeklyTargetForSignupWeek({
        weeklyGoalTarget,
        accountCreatedAtIso: user?.created_at ?? null,
      }),
    [weeklyGoalTarget, user?.created_at],
  );
  const xpGainEstimate = estimateSessionXpGain(dur);

  const feedback = useMemo(
    () =>
      buildSessionFeedback({
        weeklyGoalTarget: effectiveWeeklyGoalTarget,
        weekSessionsCount,
        currentStreak: streak ?? 0,
        sessionDurationSeconds: dur,
      }),
    [effectiveWeeklyGoalTarget, weekSessionsCount, streak, dur],
  );
  const paceForecast = useMemo(
    () =>
      effectiveWeeklyGoalTarget != null && effectiveWeeklyGoalTarget > 0
        ? buildWeeklyForecast({
            weeklyGoalTarget: effectiveWeeklyGoalTarget,
            completedThisWeek: weekSessionsCount,
          })
        : null,
    [effectiveWeeklyGoalTarget, weekSessionsCount],
  );

  if (loadState === "loading") {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.loadingTitle}>{t("sessionComplete.title")}</Text>
          <Text style={styles.muted}>{t("sessionComplete.loadingSession")}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loadState === "error") {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.centered}>
          <Text style={styles.loadingTitle}>{t("sessionComplete.errorTitle")}</Text>
          <Text style={styles.muted}>{loadError ?? t("sessionComplete.unknownError")}</Text>
          <View style={styles.actions}>
            <PrimaryButton label={t("sessionComplete.tryAgain")} onPress={() => void reload()} />
            <TextButton
              label={t("sessionComplete.backToDashboard")}
              onPress={() => router.replace("/(tabs)/dashboard")}
            />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const sessionType = session?.session_type ?? "beat_making";
  const moodLabel = session?.mood_level != null ? sessionMoodLabel(session.mood_level, t) : null;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]} testID="session-complete-screen">
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <LinearGradient
          colors={["#3d1510", "#1a1010", "#0a0a0a"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroCard}
        >
          <Text style={styles.heroEyebrow}>{t("sessionComplete.heroEyebrow")}</Text>
          <Text style={styles.bigDur}>{formatDurationWords(dur)}</Text>
          <View style={styles.metaRow}>
            <View style={styles.typePill}>
              <Text style={styles.typePillText}>{sessionTypeLabel(sessionType, t)}</Text>
            </View>
            {moodLabel ? (
              <View style={styles.moodPill}>
                <Text style={styles.moodPillText}>{moodLabel}</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.statGrid}>
            <StatTile
              label={t("sessionComplete.statXpLabel")}
              value={`+${xpGainEstimate}`}
              accent={xpGainEstimate > 0}
            />
            {streak !== null && streak > 0 ? (
              <StatTile
                label={t("sessionComplete.statStreakLabel")}
                value={`${streak}d`}
                icon="flame"
              />
            ) : null}
            {progression ? (
              <StatTile
                label={t("sessionComplete.statLevelLabel")}
                value={`${progression.current_level}`}
              />
            ) : null}
          </View>

          {xpGainEstimate === 0 ? (
            <Text style={styles.xpHintInline}>
              {t("sessionComplete.xpMinDurationHint", { min: MINIMUM_COUNTED_SESSION_MINUTES })}
            </Text>
          ) : progression ? (
            <Text style={styles.levelLine}>
              {t("sessionComplete.levelProgress", {
                name: shortenSessionLabel(progressionLevelName(t, progression.current_level)),
                toNext: progression.xp_to_next_level,
                nextName: shortenSessionLabel(
                  progressionLevelName(t, progression.current_level + 1),
                ),
              })}
            </Text>
          ) : null}

          <Text style={styles.punchline}>{t(sessionHighlightKey(feedback))}</Text>
        </LinearGradient>

        <SessionCompleteWeekCard
          t={t}
          feedback={feedback}
          weekSessionsCount={weekSessionsCount}
          weeklyGoalTarget={effectiveWeeklyGoalTarget}
          paceForecast={paceForecast}
        />

        <View style={styles.actions}>
          <PrimaryButton
            label={t("sessionComplete.viewDetails")}
            onPress={() => router.replace(`/session/${id}` as never)}
          />
          <SecondaryButton
            label={t("sessionComplete.backToDashboard")}
            onPress={() => router.replace("/(tabs)/dashboard")}
            testID="session-complete-back"
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
