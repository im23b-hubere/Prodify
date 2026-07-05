import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { ChevronLeft, History } from "lucide-react-native";
import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Swipeable } from "react-native-gesture-handler";

import { DashboardRecentSessionRow } from "../../components/dashboard/DashboardRecentSessionRow";
import { EmptyState } from "../../components/states/EmptyState";
import { ErrorState } from "../../components/states/ErrorState";
import { LoadingState } from "../../components/states/LoadingState";
import { fontFamily } from "../../constants/fonts";
import { colors, motion, radii, spacing, typography, ui } from "../../constants/theme";
import { useAuth } from "../../context/AuthContext";
import type { StatsPeriod } from "../../features/stats/types";
import { useSessionHistory } from "../../features/sessions/hooks/useSessionHistory";
import { filterSessionsByStatsPeriod } from "../../features/sessions/utils/sessionHistoryFilter";
import { apiJson } from "../../lib/client";
import { sessionTypeLabel } from "../../lib/sessionI18n";
import { formatSessionListDate } from "../../lib/sessionTime";
import type { SessionDto } from "../../types/session";

function parseStatsPeriod(value: string | string[] | undefined): StatsPeriod | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === "week" || raw === "month" || raw === "all") return raw;
  return null;
}

export default function SessionHistoryScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { token } = useAuth();
  const params = useLocalSearchParams<{ period?: string | string[] }>();
  const statsPeriod = parseStatsPeriod(params.period);

  const {
    sessions,
    loading,
    refreshing,
    loadingMore,
    error,
    hasMore,
    load,
    refresh,
    loadMore,
    removeSession,
    setError,
  } = useSessionHistory(token, t);

  useFocusEffect(
    useCallback(() => {
      load({ reset: true }).catch(() => undefined);
    }, [load]),
  );

  const visibleSessions = useMemo(
    () => filterSessionsByStatsPeriod(sessions, statsPeriod),
    [sessions, statsPeriod],
  );

  const subtitle = useMemo(() => {
    if (statsPeriod === "week") return t("sessionHistory.subtitleWeek");
    if (statsPeriod === "month") return t("sessionHistory.subtitleMonth");
    if (statsPeriod === "all") return t("sessionHistory.subtitleAll");
    return t("sessionHistory.subtitle");
  }, [statsPeriod, t]);

  const dismissSession = useCallback(
    async (sessionId: number) => {
      if (!token) return;
      Haptics.selectionAsync().catch(() => undefined);
      removeSession(sessionId);
      try {
        await apiJson(`/sessions/item/${sessionId}`, { token, method: "DELETE" });
      } catch (e) {
        setError(e instanceof Error ? e.message : t("sessionHistory.deleteFailed"));
        await load({ reset: true });
      }
    },
    [load, removeSession, setError, t, token],
  );

  const renderRightActions = useCallback(
    (sessionId: number) => (
      <Pressable
        style={styles.deleteAction}
        onPress={() => {
          void dismissSession(sessionId);
        }}
      >
        <Text style={styles.deleteActionText}>{t("dashboard.deleteSwipe")}</Text>
      </Pressable>
    ),
    [dismissSession, t],
  );

  const renderItem = useCallback(
    ({ item }: { item: SessionDto }) => {
      const typeLabel = sessionTypeLabel(String(item.session_type || "beat_making"), t);
      return (
        <Swipeable renderRightActions={() => renderRightActions(item.id)}>
          <DashboardRecentSessionRow
            session={item}
            typeLabel={typeLabel}
            accessibilityLabel={`${typeLabel}, ${formatSessionListDate(item.started_at)}`}
            accessibilityHint={t("dashboard.openSessionDetailsA11y")}
            onPress={() => router.push(`/session/${item.id}`)}
          />
        </Swipeable>
      );
    },
    [renderRightActions, router, t],
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <FlatList
        data={visibleSessions}
        keyExtractor={(item) => `history-${item.id}`}
        renderItem={renderItem}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />
        }
        ListHeaderComponent={
          <View style={styles.headerBlock}>
            <View style={styles.topBar}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("sessionHistory.backA11y")}
                onPress={() => router.back()}
                style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.88 }]}
              >
                <ChevronLeft color={colors.textPrimary} size={26} />
              </Pressable>
              <View style={styles.headerCopy}>
                <Text style={styles.title}>{t("sessionHistory.title")}</Text>
                <Text style={styles.subtitle}>{subtitle}</Text>
              </View>
            </View>
            <View style={styles.headerLinks}>
              <Pressable
                onPress={() => router.push("/(tabs)/session-trash")}
                style={({ pressed }) => pressed && styles.linkPressed}
              >
                <Text style={styles.link}>{t("sessionHistory.viewTrash")}</Text>
              </Pressable>
            </View>
            {loading && !refreshing ? (
              <LoadingState message={t("sessionHistory.loading")} />
            ) : null}
            {error ? (
              <ErrorState
                title={t("common.oops")}
                message={error}
                retryLabel={t("common.tryAgain")}
                onRetry={() => {
                  setError(null);
                  void load({ reset: true });
                }}
              />
            ) : null}
          </View>
        }
        ListEmptyComponent={
          !loading && !error ? (
            <EmptyState
              iconNode={<History color={colors.primary} size={40} />}
              title={t("sessionHistory.emptyTitle")}
              message={t("sessionHistory.emptyBody")}
              actionLabel={t("common.startSession")}
              onAction={() => router.push("/session/setup")}
            />
          ) : null
        }
        ListFooterComponent={
          hasMore && visibleSessions.length > 0 ? (
            <Pressable
              style={({ pressed }) => [styles.loadMoreBtn, pressed && { opacity: 0.88 }]}
              onPress={() => void loadMore()}
              disabled={loadingMore}
            >
              <Text style={styles.loadMoreText}>
                {loadingMore ? t("sessionHistory.loadingMore") : t("sessionHistory.loadMore")}
              </Text>
            </Pressable>
          ) : (
            <View style={styles.footerSpacer} />
          )
        }
        onEndReached={() => {
          if (!loading && !loadingMore && hasMore) {
            void loadMore();
          }
        }}
        onEndReachedThreshold={0.4}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: {
    paddingHorizontal: ui.screenPadding,
    paddingBottom: spacing.xxl,
    gap: spacing.sm,
  },
  headerBlock: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  backBtn: {
    marginTop: 2,
    padding: spacing.xs,
    marginLeft: -spacing.xs,
  },
  headerCopy: {
    flex: 1,
    gap: 4,
  },
  title: {
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    ...typography.screenTitle,
  },
  subtitle: {
    color: colors.textSecondary,
    fontFamily: fontFamily.body,
    ...typography.caption,
    lineHeight: 18,
  },
  headerLinks: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  link: {
    color: colors.primary,
    fontFamily: fontFamily.bodyBold,
    ...typography.meta,
  },
  linkPressed: {
    opacity: motion.pressOpacity,
  },
  deleteAction: {
    backgroundColor: colors.danger,
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    borderRadius: radii.md,
  },
  deleteActionText: {
    color: "#fff",
    fontFamily: fontFamily.bodyBold,
    ...typography.meta,
  },
  loadMoreBtn: {
    alignSelf: "center",
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.round,
    borderWidth: 1,
    borderColor: colors.border,
  },
  loadMoreText: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
    ...typography.meta,
  },
  footerSpacer: {
    height: spacing.lg,
  },
});
