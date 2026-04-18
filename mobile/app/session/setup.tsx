import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";

import { PrimaryButton } from "../../components/ui/PrimaryButton";
import { fontFamily } from "../../constants/fonts";
import { colors, radii, spacing, typography } from "../../constants/theme";
import { useAuth } from "../../context/AuthContext";
import { apiJson } from "../../lib/client";
import { SESSION_TYPES, type SessionDto, type SessionType } from "../../types/session";

const MOODS = [
  { level: 1 as const, emoji: "😴" },
  { level: 2 as const, emoji: "😐" },
  { level: 3 as const, emoji: "🙂" },
  { level: 4 as const, emoji: "😊" },
  { level: 5 as const, emoji: "🔥" },
];

const SUGGESTED_TAGS = ["trap", "drill", "techno", "house", "experimental"];

const TYPE_META: Record<SessionType, { emoji: string; label: string }> = {
  "Beat Making": { emoji: "🎹", label: "Beat Making" },
  Mixing: { emoji: "🎛️", label: "Mixing" },
  "Sound Design": { emoji: "🔊", label: "Sound Design" },
};

function TypeCard({
  type,
  active,
  onSelect,
}: {
  type: SessionType;
  active: boolean;
  onSelect: () => void;
}) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const onPressIn = () => {
    scale.value = withSpring(0.97);
  };
  const onPressOut = () => {
    scale.value = withSpring(1);
  };

  const meta = TYPE_META[type];

  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
        onSelect();
      }}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
    >
      <Animated.View style={[styles.typeCardOuter, active && styles.typeCardOuterActive, animStyle]}>
        {active ? (
          <LinearGradient colors={["#ff6a3d", "#a259ff"]} style={styles.typeGradient}>
            <Text style={styles.typeEmoji}>{meta.emoji}</Text>
            <Text style={styles.typeLabel}>{meta.label}</Text>
          </LinearGradient>
        ) : (
          <View style={styles.typeInner}>
            <Text style={styles.typeEmoji}>{meta.emoji}</Text>
            <Text style={styles.typeLabelMuted}>{meta.label}</Text>
          </View>
        )}
      </Animated.View>
    </Pressable>
  );
}

export default function SessionSetupScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const [selectedType, setSelectedType] = useState<SessionType | null>(null);
  const [notes, setNotes] = useState("");
  const [mood, setMood] = useState<number | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const noteLen = notes.length;
  const canStart = selectedType !== null;

  const addTag = useCallback(
    (raw: string) => {
      const t = raw.trim().toLowerCase();
      if (!t || t.length > 32) return;
      if (tags.length >= 20) return;
      if (tags.includes(t)) return;
      setTags((prev) => [...prev, t]);
      setTagInput("");
    },
    [tags]
  );

  const onSubmit = useCallback(async () => {
    if (!token || !selectedType || busy) return;
    setBusy(true);
    setError(null);
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      const created = await apiJson<SessionDto>("/sessions/start", {
        token,
        method: "POST",
        body: {
          session_type: selectedType,
          notes: notes.trim() ? notes.trim().slice(0, 200) : undefined,
          mood_level: mood ?? undefined,
          tags: tags.length ? tags : undefined,
        },
      });
      router.replace({ pathname: "/session/active", params: { id: String(created.id) } });
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
      setError(e instanceof Error ? e.message : "Could not start session");
    } finally {
      setBusy(false);
    }
  }, [busy, mood, notes, router, selectedType, tags, token]);

  const suggested = useMemo(() => SUGGESTED_TAGS.filter((s) => !tags.includes(s)), [tags]);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={12}
      >
        <View style={styles.header}>
          <Text style={styles.title}>New Session</Text>
          <Pressable
            hitSlop={12}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
              router.back();
            }}
            style={styles.closeBtn}
          >
            <Text style={styles.closeText}>✕</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.sectionLabel}>Session type</Text>
          <View style={styles.typeColumn}>
            {SESSION_TYPES.map((type) => (
              <TypeCard key={type} type={type} active={selectedType === type} onSelect={() => setSelectedType(type)} />
            ))}
          </View>

          <Text style={styles.sectionLabel}>Session notes (optional)</Text>
          <TextInput
            style={styles.notes}
            placeholder="What are you working on?"
            placeholderTextColor={colors.textSecondary}
            multiline
            textAlignVertical="top"
            maxLength={200}
            autoCapitalize="sentences"
            value={notes}
            onChangeText={setNotes}
          />
          <Text style={styles.counter}>{noteLen}/200</Text>

          <Text style={styles.sectionLabel}>How are you feeling?</Text>
          <View style={styles.moodRow}>
            {MOODS.map((m) => (
              <Pressable
                key={m.level}
                style={[styles.moodBtn, mood === m.level && styles.moodBtnActive]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
                  setMood(m.level);
                }}
              >
                <Text style={styles.moodEmoji}>{m.emoji}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.sectionLabel}>Tags (optional)</Text>
          <View style={styles.tagWrap}>
            {tags.map((t) => (
              <Pressable key={t} style={styles.tagChip} onPress={() => setTags((prev) => prev.filter((x) => x !== t))}>
                <Text style={styles.tagText}>{t}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.tagInputRow}>
            <TextInput
              style={styles.tagField}
              placeholder="Add tag"
              placeholderTextColor={colors.textSecondary}
              value={tagInput}
              onChangeText={setTagInput}
              onSubmitEditing={() => addTag(tagInput)}
            />
            <Pressable
              style={styles.addTagBtn}
              onPress={() => {
                addTag(tagInput);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
              }}
            >
              <Text style={styles.addTagPlus}>+</Text>
            </Pressable>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestedRow}>
            {suggested.map((s) => (
              <Pressable
                key={s}
                style={styles.suggestedChip}
                onPress={() => {
                  addTag(s);
                  Haptics.selectionAsync().catch(() => undefined);
                }}
              >
                <Text style={styles.suggestedText}>{s}</Text>
              </Pressable>
            ))}
          </ScrollView>

          {error ? <Text style={styles.error}>{error}</Text> : null}
        </ScrollView>

        <View style={styles.footer}>
          <PrimaryButton label="START SESSION" onPress={onSubmit} loading={busy} disabled={!canStart} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  title: {
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    ...typography.headline,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  closeText: { color: colors.textPrimary, fontSize: 18, fontFamily: fontFamily.bodyBold },
  scroll: { paddingHorizontal: spacing.md, paddingBottom: spacing.xxl },
  sectionLabel: {
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyBold,
    ...typography.caption,
  },
  typeColumn: { gap: spacing.sm },
  typeCardOuter: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    backgroundColor: colors.surface,
  },
  typeCardOuterActive: {
    borderColor: colors.primary,
  },
  typeGradient: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  typeInner: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  typeEmoji: { fontSize: 28 },
  typeLabel: { color: "#fff", fontFamily: fontFamily.heading, ...typography.subheadline },
  typeLabelMuted: { color: colors.textPrimary, fontFamily: fontFamily.heading, ...typography.subheadline },
  notes: {
    minHeight: 100,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.textPrimary,
    padding: spacing.md,
    fontFamily: fontFamily.body,
    ...typography.body,
  },
  counter: { alignSelf: "flex-end", color: colors.textSecondary, ...typography.caption, marginTop: 4 },
  moodRow: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" },
  moodBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  moodBtnActive: { borderColor: colors.primary, backgroundColor: "rgba(255,61,0,0.15)" },
  moodEmoji: { fontSize: 26 },
  tagWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  tagChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radii.round,
    backgroundColor: "rgba(162,89,255,0.2)",
    borderWidth: 1,
    borderColor: colors.secondary,
  },
  tagText: { color: colors.textPrimary, fontFamily: fontFamily.bodyMedium, ...typography.caption },
  tagInputRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.sm },
  tagField: {
    flex: 1,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.textPrimary,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontFamily: fontFamily.body,
  },
  addTagBtn: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  addTagPlus: { color: colors.primary, fontSize: 22, fontFamily: fontFamily.bodyBold },
  suggestedRow: { gap: spacing.sm, marginTop: spacing.sm },
  suggestedChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radii.round,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  suggestedText: { color: colors.textSecondary, fontFamily: fontFamily.body, ...typography.caption },
  error: { color: colors.danger, marginTop: spacing.md, ...typography.caption },
  footer: {
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
});
