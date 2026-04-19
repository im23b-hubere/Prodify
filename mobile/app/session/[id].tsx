import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { SessionInsightSections } from "../../components/session/SessionInsightSections";
import { PrimaryButton } from "../../components/ui/PrimaryButton";
import { SessionTypeChip } from "../../components/ui/SessionTypeChip";
import { fontFamily } from "../../constants/fonts";
import { colors, radii, spacing, typography } from "../../constants/theme";
import { useAuth } from "../../context/AuthContext";
import { apiJson } from "../../lib/client";
import { sessionTagsList, tryParseSessionDto } from "../../lib/sessionDto";
import { formatDurationWords, parseSessionDate } from "../../lib/sessionTime";
import type { SessionDetailInsightsDto } from "../../types/insights";
import { SESSION_TYPES, type SessionDto, type SessionType } from "../../types/session";

const MOOD_LABEL: Record<number, string> = {
  1: "Low",
  2: "Okay",
  3: "Good",
  4: "Great",
  5: "On fire",
};

export default function SessionDetailScreen() {
  const { token, user } = useAuth();
  const router = useRouter();
  const raw = useLocalSearchParams<{ id: string | string[] }>().id;
  const id = Array.isArray(raw) ? raw[0] : raw;

  const [session, setSession] = useState<SessionDto | null>(null);
  const [selectedType, setSelectedType] = useState<SessionType>("Beat Making");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [insights, setInsights] = useState<SessionDetailInsightsDto | null>(null);

  const load = useCallback(async () => {
    if (!token || !id) return;
    if (!Number.isFinite(Number(id))) {
      setError("Invalid session id");
      setSession(null);
      return;
    }
    setError(null);
    const raw = await apiJson<unknown>(`/sessions/item/${id}`, { token });
    const data = tryParseSessionDto(raw);
    if (!data) {
      setError("Invalid session data from server.");
      setSession(null);
      return;
    }
    setSession(data);
    setSelectedType((data.session_type as SessionType) || "Beat Making");
    setNote(data.notes ?? "");
    if (data.stopped_at != null && data.duration_seconds != null) {
      try {
        const ins = await apiJson<SessionDetailInsightsDto>(`/sessions/item/${id}/insights`, {
          token,
        });
        setInsights(ins);
      } catch {
        setInsights(null);
      }
    } else {
      setInsights(null);
    }
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
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
      const raw = await apiJson<unknown>(`/sessions/item/${id}`, {
        token,
        method: "PATCH",
        body: {
          session_type: selectedType,
          notes: note.trim() ? note.trim() : null,
        },
      });
      const updated = tryParseSessionDto(raw);
      if (!updated) {
        setError("Invalid response from server.");
        return;
      }
      setSession(updated);
      setNote(updated.notes ?? "");
      setSelectedType((updated.session_type as SessionType) || "Beat Making");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setBusy(false);
    }
  }, [id, note, selectedType, token]);

  const confirmDelete = useCallback(() => {
    if (!token || !id) return;
    Alert.alert("Delete session?", "This moves the session to trash.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await apiJson(`/sessions/item/${id}`, { token, method: "DELETE" });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
              () => undefined,
            );
            router.replace("/(tabs)/dashboard");
          } catch (e) {
            setError(e instanceof Error ? e.message : "Delete failed");
          }
        },
      },
    ]);
  }, [id, router, token]);

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

  const start = parseSessionDate(session.started_at);
  const startOk = Number.isFinite(start.getTime());
  const end = session.stopped_at ? parseSessionDate(session.stopped_at) : null;
  const endOk = end ? Number.isFinite(end.getTime()) : false;
  const durationLabel =
    session.duration_seconds != null
      ? formatDurationWords(session.duration_seconds)
      : "In progress";
  const tagList = sessionTagsList(session.tags);

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
        <Pressable onPress={() => router.back()} style={styles.backRow}>
          <Text style={styles.backChevron}>‹</Text>
          <Text style={styles.backText}>Back</Text>
        </Pressable>

        <View style={styles.hero}>
          <Text style={styles.heroType}>{session.session_type}</Text>
          <Text style={styles.heroDur}>{durationLabel}</Text>
          <Text style={styles.heroMeta}>
            {startOk
              ? `${start.toLocaleString("en-US", { weekday: "long", month: "short", day: "numeric" })} · ${start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`
              : "—"}
            {endOk && end
              ? ` – ${end.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`
              : ""}
          </Text>
        </View>

        {insights ? (
          <SessionInsightSections
            session={session}
            insights={insights}
            producerName={user?.username}
          />
        ) : null}

        <View style={styles.grid}>
          <View style={styles.gridCell}>
            <Text style={styles.gridLabel}>Start</Text>
            <Text style={styles.gridVal}>
              {startOk
                ? start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
                : "—"}
            </Text>
          </View>
          <View style={styles.gridCell}>
            <Text style={styles.gridLabel}>End</Text>
            <Text style={styles.gridVal}>
              {endOk && end
                ? end.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
                : "—"}
            </Text>
          </View>
          <View style={styles.gridCell}>
            <Text style={styles.gridLabel}>Mood</Text>
            <Text style={styles.gridVal}>
              {session.mood_level ? `${MOOD_LABEL[session.mood_level] ?? "—"}` : "—"}
            </Text>
          </View>
          <View style={styles.gridCell}>
            <Text style={styles.gridLabel}>Pauses</Text>
            <Text style={styles.gridVal}>
              {session.paused_duration_seconds
                ? `${Math.round((session.paused_duration_seconds || 0) / 60)} min`
                : "—"}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Session type</Text>
          <View style={styles.chips}>
            {SESSION_TYPES.map((type) => (
              <SessionTypeChip
                key={type}
                label={type}
                active={selectedType === type}
                onPress={() => setSelectedType(type)}
              />
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

        {tagList.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Tags</Text>
            <View style={styles.tagRow}>
              {tagList.map((t) => (
                <View key={t} style={styles.tag}>
                  <Text style={styles.tagTxt}>{t}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <PrimaryButton label="Save changes" onPress={save} loading={busy} />
        <Pressable style={styles.dangerBtn} onPress={confirmDelete}>
          <Text style={styles.dangerTxt}>Delete session</Text>
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
  backRow: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: spacing.sm },
  backChevron: { color: colors.primary, fontSize: 28, lineHeight: 32 },
  backText: { color: colors.primary, fontFamily: fontFamily.bodyBold, ...typography.body },
  hero: { marginBottom: spacing.md },
  heroType: { color: colors.textSecondary, fontFamily: fontFamily.bodyBold, ...typography.caption },
  heroDur: {
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    fontSize: 40,
    marginTop: spacing.xs,
  },
  heroMeta: { color: colors.textSecondary, marginTop: spacing.sm, ...typography.caption },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  gridCell: {
    width: "47%",
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
  },
  gridLabel: { color: colors.textSecondary, ...typography.caption },
  gridVal: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
    marginTop: 4,
    ...typography.body,
  },
  section: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
    ...typography.body,
    marginBottom: spacing.sm,
  },
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
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  tag: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.round,
    backgroundColor: "rgba(162,89,255,0.2)",
  },
  tagTxt: { color: colors.textPrimary, ...typography.caption },
  errorText: { color: colors.danger, fontFamily: fontFamily.body, ...typography.caption },
  dangerBtn: {
    marginTop: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.danger,
    paddingVertical: spacing.md,
    alignItems: "center",
    backgroundColor: "rgba(255,59,48,0.1)",
  },
  dangerTxt: { color: colors.danger, fontFamily: fontFamily.bodyBold, ...typography.body },
});
