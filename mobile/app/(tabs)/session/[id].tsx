import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { PrimaryButton } from "../../../components/ui/PrimaryButton";
import { SessionTypeChip } from "../../../components/ui/SessionTypeChip";
import { fontFamily } from "../../../constants/fonts";
import { colors, radii, spacing, typography } from "../../../constants/theme";
import { useAuth } from "../../../context/AuthContext";
import { apiJson } from "../../../lib/client";
import { SESSION_TYPES, type SessionDto, type SessionType } from "../../../types/session";

export default function SessionDetailScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [session, setSession] = useState<SessionDto | null>(null);
  const [selectedType, setSelectedType] = useState<SessionType>("Beat Making");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token || !id) return;
    setError(null);
    const data = await apiJson<SessionDto>(`/sessions/item/${id}`, { token });
    setSession(data);
    setSelectedType(data.session_type);
    setNote(data.notes ?? "");
  }, [id, token]);

  useEffect(() => {
    load().catch((e) => setError(e instanceof Error ? e.message : "Failed to load session"));
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load().catch((e) => setError(e instanceof Error ? e.message : "Failed to refresh"));
    setRefreshing(false);
  }, [load]);

  const save = useCallback(async () => {
    if (!token || !id) return;
    setBusy(true);
    try {
      const updated = await apiJson<SessionDto>(`/sessions/item/${id}`, {
        token,
        method: "PATCH",
        body: {
          session_type: selectedType,
          notes: note.trim() ? note.trim() : null,
        },
      });
      setSession(updated);
      setNote(updated.notes ?? "");
      setSelectedType(updated.session_type);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setBusy(false);
    }
  }, [id, note, selectedType, token]);

  if (!session) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.loadingWrap}>
          <Text style={styles.loadingText}>Loading session...</Text>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <Text style={styles.title}>Session Detail</Text>
        <Text style={styles.meta}>Session #{session.id}</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Session Type</Text>
          <View style={styles.chips}>
            {SESSION_TYPES.map((type) => (
              <SessionTypeChip key={type} label={type} active={selectedType === type} onPress={() => setSelectedType(type)} />
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notes</Text>
          <TextInput
            style={styles.noteInput}
            value={note}
            onChangeText={setNote}
            placeholder="Add context for this session"
            placeholderTextColor={colors.textSecondary}
            multiline
          />
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <PrimaryButton label="Save Changes" onPress={save} loading={busy} />
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backLabel}>Back</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  loadingWrap: { flex: 1, justifyContent: "center", alignItems: "center", padding: spacing.lg },
  loadingText: { color: colors.textSecondary, fontFamily: fontFamily.body, ...typography.body },
  title: { color: colors.textPrimary, fontFamily: fontFamily.heading, ...typography.headline },
  meta: { color: colors.textSecondary, fontFamily: fontFamily.body, ...typography.caption },
  section: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
  },
  sectionTitle: { color: colors.textPrimary, fontFamily: fontFamily.bodyBold, ...typography.body, marginBottom: spacing.sm },
  chips: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" },
  noteInput: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    color: colors.textPrimary,
    padding: spacing.md,
    minHeight: 100,
    textAlignVertical: "top",
    fontFamily: fontFamily.body,
    ...typography.caption,
  },
  errorText: { color: colors.danger, fontFamily: fontFamily.body, ...typography.caption },
  backBtn: {
    marginTop: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    alignItems: "center",
    backgroundColor: colors.surface,
  },
  backLabel: { color: colors.textPrimary, fontFamily: fontFamily.bodyBold, ...typography.body },
});
