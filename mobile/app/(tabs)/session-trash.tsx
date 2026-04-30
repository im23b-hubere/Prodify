import { useCallback, useEffect, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { fontFamily } from "../../constants/fonts";
import { colors, radii, spacing, typography } from "../../constants/theme";
import { useAuth } from "../../context/AuthContext";
import { apiJson } from "../../lib/client";
import { sessionTypeLabel } from "../../lib/sessionI18n";
import { parseSessionList } from "../../lib/sessionDto";
import { EmptyState } from "../../components/states/EmptyState";
import { ErrorState } from "../../components/states/ErrorState";
import { LoadingState } from "../../components/states/LoadingState";
import { ScreenHeader } from "../../components/ui/ScreenHeader";
import type { SessionDto } from "../../types/session";

const TRASH_PAGE_SIZE = 50;

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function SessionTrashScreen() {
  const { t } = useTranslation();
  const { token } = useAuth();
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionDto[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(
    async (options?: { reset?: boolean }) => {
      const reset = options?.reset ?? true;
      if (!token) {
        const notSignedInMessage = t("sessionTrash.notSignedIn");
        setSessions((prev) => (prev.length > 0 ? [] : prev));
        setError((prev) => (prev === notSignedInMessage ? prev : notSignedInMessage));
        setLoading((prev) => (prev ? false : prev));
        setHasMore(false);
        setOffset(0);
        setLoadingMore(false);
        return;
      }
      setError(null);
      const requestOffset = reset ? 0 : offset;
      try {
        const raw = await apiJson<unknown>(
          `/sessions/trash?limit=${TRASH_PAGE_SIZE}&offset=${requestOffset}`,
          { token },
        );
        const parsed = parseSessionList(raw);
        setSessions((prev) => {
          if (reset) return parsed;
          const seen = new Set(prev.map((session) => session.id));
          const next = parsed.filter((session) => !seen.has(session.id));
          return next.length > 0 ? [...prev, ...next] : prev;
        });
        setHasMore(parsed.length >= TRASH_PAGE_SIZE);
        setOffset(requestOffset + parsed.length);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [offset, t, token],
  );

  useEffect(() => {
    load({ reset: true }).catch((e) =>
      setError(e instanceof Error ? e.message : t("sessionTrash.loadFailed")),
    );
  }, [load, t]);

  useFocusEffect(
    useCallback(() => {
      load({ reset: true }).catch((e) =>
        setError(e instanceof Error ? e.message : t("sessionTrash.refreshFailed")),
      );
    }, [load, t]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load({ reset: true }).catch((e) =>
      setError(e instanceof Error ? e.message : t("sessionTrash.refreshFailed")),
    );
    setRefreshing(false);
  }, [load, t]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loading || loadingMore) return;
    setLoadingMore(true);
    await load({ reset: false }).catch((e) =>
      setError(e instanceof Error ? e.message : t("sessionTrash.loadMoreFailed")),
    );
  }, [hasMore, load, loading, loadingMore, t]);

  const restore = useCallback(
    async (id: number) => {
      if (!token) return;
      setBusyId(id);
      const before = sessions;
      // Optimistic update for snappy UX.
      setSessions((prev) => prev.filter((s) => s.id !== id));
      try {
        await apiJson(`/sessions/item/${id}/restore`, { token, method: "POST" });
        await load({ reset: true });
      } catch (e) {
        setError(e instanceof Error ? e.message : t("sessionTrash.restoreFailed"));
        setSessions(before);
      } finally {
        setBusyId(null);
      }
    },
    [load, sessions, token, t],
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        <ScreenHeader
          title={t("sessionTrash.title")}
          subtitle={t("sessionTrash.subtitle")}
          actionLabel={t("sessionFeedback.backToDashboard")}
          onActionPress={() => router.replace("/(tabs)/dashboard")}
        />
        {loading && !refreshing ? <LoadingState message={t("sessionTrash.loading")} /> : null}

        {error ? (
          <ErrorState
            title={t("common.oops")}
            message={error}
            retryLabel={t("common.tryAgain")}
            onRetry={() => {
              setLoading(true);
              load({ reset: true }).catch(() => undefined);
            }}
          />
        ) : null}

        {!loading && !error && sessions.length === 0 ? (
          <EmptyState icon="🗑️" title={t("sessionTrash.title")} message={t("sessionTrash.empty")} />
        ) : (
          <>
            {sessions.map((session) => (
              <View key={session.id} style={styles.row}>
                <View style={styles.rowCopy}>
                  <Text style={styles.rowTitle}>
                    {sessionTypeLabel(String(session.session_type), t)}
                  </Text>
                  <Text style={styles.rowMeta}>{formatDate(session.started_at)}</Text>
                </View>
                <Pressable
                  style={({ pressed }) => [
                    styles.restoreBtn,
                    pressed && styles.pressed,
                    busyId === session.id && styles.disabled,
                  ]}
                  onPress={() => restore(session.id).catch(() => undefined)}
                  disabled={busyId === session.id}
                >
                  <Text style={styles.restoreLabel}>
                    {busyId === session.id
                      ? t("sessionTrash.restoring")
                      : t("sessionTrash.restore")}
                  </Text>
                </Pressable>
              </View>
            ))}
            {hasMore ? (
              <Pressable
                style={({ pressed }) => [
                  styles.loadMoreBtn,
                  pressed && styles.pressed,
                  loadingMore && styles.disabled,
                ]}
                onPress={() => void loadMore()}
                disabled={loadingMore}
              >
                <Text style={styles.loadMoreLabel}>
                  {loadingMore ? t("sessionTrash.loadingMore") : t("sessionTrash.loadMore")}
                </Text>
              </Pressable>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.sm },
  title: { color: colors.textPrimary, fontFamily: fontFamily.heading, ...typography.headline },
  subtitle: {
    color: colors.textSecondary,
    fontFamily: fontFamily.body,
    ...typography.caption,
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginBottom: spacing.sm,
  },
  rowCopy: { flex: 1, marginRight: spacing.md },
  rowTitle: { color: colors.textPrimary, fontFamily: fontFamily.bodyBold, ...typography.body },
  rowMeta: { color: colors.textSecondary, ...typography.caption, marginTop: 4 },
  restoreBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: "rgba(255,61,0,0.12)",
  },
  pressed: { opacity: 0.9 },
  disabled: { opacity: 0.5 },
  restoreLabel: { color: colors.primary, fontFamily: fontFamily.bodyBold, ...typography.caption },
  loadMoreBtn: {
    alignSelf: "center",
    marginTop: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.round,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  loadMoreLabel: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
    ...typography.caption,
  },
});
