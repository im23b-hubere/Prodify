import { Href, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { Calendar, ChevronLeft } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";

import { EmptyState } from "../../components/states/EmptyState";
import { ErrorState } from "../../components/states/ErrorState";
import { LoadingState } from "../../components/states/LoadingState";
import { AppCard } from "../../components/ui/AppCard";
import { PrimaryButton } from "../../components/ui/PrimaryButton";
import { colors } from "../../constants/theme";
import { useAuth } from "../../context/AuthContext";
import {
  HISTORY_FETCH_LIMIT,
  useStreakHistory,
} from "../../features/streak/hooks/useStreakHistory";
import { styles } from "../../features/streak/streakHistory.styles";
import {
  formatStreakRange,
  isActiveStreakRun,
} from "../../features/streak/streakHistoryPresentation";

export default function StreakHistoryScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { token } = useAuth();
  const { runs, currentStreak, loading, refreshing, error, refresh, retry } = useStreakHistory(
    token,
    t("streakHistory.loadError"),
  );

  const showSignIn = !token && !loading;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("streakHistory.backA11y")}
          hitSlop={12}
          style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
          onPress={() => {
            Haptics.selectionAsync().catch(() => undefined);
            router.back();
          }}
        >
          <ChevronLeft color={colors.textPrimary} size={26} />
        </Pressable>
        <Text style={styles.title}>{t("streakHistory.title")}</Text>
        <View style={styles.backSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          token ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refresh}
              tintColor={colors.primary}
            />
          ) : undefined
        }
      >
        {loading && !refreshing ? <LoadingState message={t("streakHistory.loading")} /> : null}

        {showSignIn ? (
          <AppCard>
            <Text style={styles.cardTitle}>{t("streakHistory.needSignInTitle")}</Text>
            <Text style={styles.cardBody}>{t("streakHistory.needSignInBody")}</Text>
            <PrimaryButton
              label={t("streakHistory.signInCta")}
              onPress={() => router.replace("/(auth)/login" as Href)}
            />
          </AppCard>
        ) : null}

        {token && error ? (
          <ErrorState
            title={t("common.oops")}
            message={error}
            retryLabel={t("common.tryAgain")}
            onRetry={retry}
          />
        ) : null}

        {token && !loading && !error && runs.length === 0 ? (
          <EmptyState
            iconNode={<Calendar color={colors.primary} size={40} />}
            title={t("streakHistory.emptyTitle")}
            message={t("streakHistory.emptySub")}
            actionLabel={t("streakHistory.emptyCta")}
            onAction={() => router.push("/session/setup" as Href)}
          />
        ) : null}

        {runs.map((run, i) => {
          const isCurrent = isActiveStreakRun(run, i, currentStreak);
          return (
            <Animated.View
              key={`${run.start_date}-${run.end_date}-${i}`}
              entering={FadeInDown.delay(i * 40).duration(360)}
            >
              <View
                style={[styles.card, isCurrent && styles.cardCurrent]}
                accessibilityRole="text"
                accessibilityLabel={
                  isCurrent
                    ? t("streakHistory.runA11yCurrent", {
                        count: run.length_days,
                        start: run.start_date,
                        end: run.end_date,
                      })
                    : t("streakHistory.runA11y", {
                        count: run.length_days,
                        start: run.start_date,
                        end: run.end_date,
                      })
                }
              >
                <View style={styles.cardHeader}>
                  <Text style={styles.days}>
                    {run.length_days} {t("streakHistory.dayUnit", { count: run.length_days })}
                  </Text>
                  {isCurrent ? (
                    <View style={styles.currentBadge}>
                      <Text style={styles.currentBadgeText}>{t("streakHistory.currentBadge")}</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.range}>{formatStreakRange(run.start_date, run.end_date)}</Text>
              </View>
            </Animated.View>
          );
        })}

        {token && !loading && !error && runs.length > 0 ? (
          <Text style={styles.footnote}>
            {t("streakHistory.footnote", { limit: HISTORY_FETCH_LIMIT })}
          </Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
