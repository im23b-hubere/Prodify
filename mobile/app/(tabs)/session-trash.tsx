import { useCallback, useEffect, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { fontFamily } from "../../constants/fonts";
import { colors, radii, spacing, typography } from "../../constants/theme";
import { useAuth } from "../../context/AuthContext";
import { apiJson } from "../../lib/client";
import type { SessionDto } from "../../types/session";

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-US");
}

export default function SessionTrashScreen() {
  const { token } = useAuth();
  const [sessions, setSessions] = useState<SessionDto[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    const data = await apiJson<SessionDto[]>("/sessions/trash", { token });
    setSessions(data);
  }, [token]);

  useEffect(() => {
    load().catch((e) => setError(e instanceof Error ? e.message : "Failed to load trash"));
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load().catch((e) => setError(e instanceof Error ? e.message : "Failed to refresh"));
    setRefreshing(false);
  }, [load]);

  const restore = useCallback(
    async (id: number) => {
      if (!token) return;
      setBusyId(id);
      try {
        await apiJson(`/sessions/item/${id}/restore`, { token, method: "POST" });
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to restore");
      } finally {
        setBusyId(null);
      }
    },
    [load, token]
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <Text style={styles.title}>Session Trash</Text>
        <Text style={styles.subtitle}>Restore sessions you deleted accidentally.</Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {sessions.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>Trash is empty.</Text>
          </View>
        ) : (
          sessions.map((session) => (
            <View key={session.id} style={styles.row}>
              <View style={styles.rowCopy}>
                <Text style={styles.rowTitle}>{session.session_type}</Text>
                <Text style={styles.rowMeta}>{formatDate(session.started_at)}</Text>
              </View>
              <Pressable
                style={({ pressed }) => [styles.restoreBtn, pressed && styles.pressed, busyId === session.id && styles.disabled]}
                onPress={() => restore(session.id).catch(() => undefined)}
                disabled={busyId === session.id}
              >
                <Text style={styles.restoreLabel}>{busyId === session.id ? "..." : "Restore"}</Text>
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
  subtitle: { color: colors.textSecondary, fontFamily: fontFamily.body, ...typography.caption, marginBottom: spacing.sm },
  error: { color: colors.danger, fontFamily: fontFamily.body, ...typography.caption },
  emptyCard: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
  },
  emptyText: { color: colors.textSecondary, fontFamily: fontFamily.body, ...typography.caption },
  row: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  rowCopy: { flex: 1, gap: spacing.xs },
  rowTitle: { color: colors.textPrimary, fontFamily: fontFamily.bodyBold, ...typography.body },
  rowMeta: { color: colors.textSecondary, fontFamily: fontFamily.body, ...typography.caption },
  restoreBtn: {
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: "rgba(0,255,136,0.2)",
    borderWidth: 1,
    borderColor: colors.success,
  },
  restoreLabel: { color: colors.success, fontFamily: fontFamily.bodyBold, ...typography.caption },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.5 },
});
