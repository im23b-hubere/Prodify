import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { fontFamily } from "../../constants/fonts";
import { colors, radii, spacing, typography } from "../../constants/theme";
import { useAuth } from "../../context/AuthContext";
import { apiJson } from "../../lib/client";
import { parseSessionList } from "../../lib/sessionDto";
import type { SessionDto } from "../../types/session";

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function SessionTrashScreen() {
  const { t } = useTranslation();
  const { token } = useAuth();
  const [sessions, setSessions] = useState<SessionDto[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    const raw = await apiJson<unknown>("/sessions/trash", { token });
    setSessions(parseSessionList(raw));
  }, [token]);

  useEffect(() => {
    load().catch((e) => setError(e instanceof Error ? e.message : t("sessionTrash.loadFailed")));
  }, [load, t]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load().catch((e) => setError(e instanceof Error ? e.message : t("sessionTrash.refreshFailed")));
    setRefreshing(false);
  }, [load, t]);

  const restore = useCallback(
    async (id: number) => {
      if (!token) return;
      setBusyId(id);
      try {
        await apiJson(`/sessions/item/${id}/restore`, { token, method: "POST" });
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : t("sessionTrash.restoreFailed"));
      } finally {
        setBusyId(null);
      }
    },
    [load, token, t],
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
        <Text style={styles.title}>{t("sessionTrash.title")}</Text>
        <Text style={styles.subtitle}>{t("sessionTrash.subtitle")}</Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {sessions.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>{t("sessionTrash.empty")}</Text>
          </View>
        ) : (
          sessions.map((session) => (
            <View key={session.id} style={styles.row}>
              <View style={styles.rowCopy}>
                <Text style={styles.rowTitle}>{session.session_type}</Text>
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
                  {busyId === session.id ? t("sessionTrash.restoring") : t("sessionTrash.restore")}
                </Text>
              </Pressable>
            </View>
          ))
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
  error: { color: colors.danger, fontFamily: fontFamily.body, ...typography.caption },
  emptyCard: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
  },
  emptyText: { color: colors.textSecondary, ...typography.caption },
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
});
