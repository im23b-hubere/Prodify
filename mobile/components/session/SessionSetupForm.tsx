import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import {
  BookOpen,
  Disc,
  Drum,
  Layers,
  Mic,
  Mic2,
  Music2,
  PenLine,
  SlidersHorizontal,
  Waves,
  type LucideIcon,
} from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { SESSION_TYPE_IDS, SESSION_TYPES, type SessionType } from "../../constants/sessionTypes";
import { fontFamily } from "../../constants/fonts";
import { colors, radii, spacing, typography } from "../../constants/theme";
import { useAuth } from "../../context/AuthContext";
import { ApiError, apiJson } from "../../lib/client";
import { debugLog } from "../../lib/debugLog";
import { sessionTypeLabel } from "../../lib/sessionI18n";
import { tryParseSessionDto } from "../../lib/sessionDto";
import type { SessionDto } from "../../types/session";
import { PrimaryButton } from "../ui/PrimaryButton";

const MOODS = [
  { level: 1 as const, emoji: "😴" },
  { level: 2 as const, emoji: "😐" },
  { level: 3 as const, emoji: "🙂" },
  { level: 4 as const, emoji: "😊" },
  { level: 5 as const, emoji: "🔥" },
];

const SUGGESTED_TAGS = ["trap", "drill", "techno", "house", "experimental"];

type PatternKind = "beat" | "mix" | "sound";

const UI_BY_TYPE: Record<
  SessionType,
  { Icon: LucideIcon; gradient: readonly [string, string, string]; pattern: PatternKind }
> = {
  beat_making: { Icon: Drum, gradient: ["#c41e3a", "#ff6a3d", "#ff914d"], pattern: "beat" },
  mixing: { Icon: SlidersHorizontal, gradient: ["#3d2a6b", "#6b4dc4", "#a259ff"], pattern: "mix" },
  mastering: { Icon: Disc, gradient: ["#003d26", "#00aa6c", "#00ff88"], pattern: "mix" },
  mix_and_master: { Icon: Layers, gradient: ["#553300", "#cc7700", "#ffaa00"], pattern: "mix" },
  sound_design: { Icon: Waves, gradient: ["#0d4f4a", "#1a8a7e", "#00c9b7"], pattern: "sound" },
  recording: { Icon: Mic, gradient: ["#1a3a66", "#2a60cc", "#4488ff"], pattern: "mix" },
  songwriting: { Icon: PenLine, gradient: ["#662244", "#cc5599", "#ff88dd"], pattern: "beat" },
  arrangement: { Icon: Music2, gradient: ["#226655", "#55ccaa", "#88ffcc"], pattern: "beat" },
  vocal_production: { Icon: Mic2, gradient: ["#665522", "#cc9933", "#ffcc44"], pattern: "mix" },
  learning: { Icon: BookOpen, gradient: ["#442266", "#9966dd", "#cc88ff"], pattern: "beat" },
};

function colorForType(type: SessionType): string {
  return SESSION_TYPES.find((s) => s.id === type)?.color ?? colors.primary;
}

function PatternBeatMaking() {
  const heights = [12, 22, 16, 28, 14, 24, 18, 26, 15, 20];
  return (
    <View style={styles.patternRoot} pointerEvents="none">
      <View style={styles.patternBeatRow}>
        {heights.map((h, i) => (
          <View key={i} style={[styles.patternBeatBar, { height: h }]} />
        ))}
      </View>
    </View>
  );
}

function PatternMixing() {
  const heights = [18, 28, 22, 34, 16, 30, 24, 26];
  return (
    <View style={styles.patternRoot} pointerEvents="none">
      <View style={styles.patternMixRow}>
        {heights.map((h, i) => (
          <View key={i} style={styles.patternMixTrack}>
            <View style={[styles.patternMixCap, { height: h }]} />
          </View>
        ))}
      </View>
    </View>
  );
}

function PatternSoundDesign() {
  const rows = 4;
  const cols = 8;
  return (
    <View style={styles.patternRoot} pointerEvents="none">
      {Array.from({ length: rows }).map((_, r) => (
        <View key={r} style={[styles.patternSoundRow, r % 2 === 1 && styles.patternSoundRowOffset]}>
          {Array.from({ length: cols }).map((__, c) => (
            <View key={`${r}-${c}`} style={styles.patternSoundDot} />
          ))}
        </View>
      ))}
    </View>
  );
}

function TypePattern({ kind }: { kind: PatternKind }) {
  switch (kind) {
    case "beat":
      return <PatternBeatMaking />;
    case "mix":
      return <PatternMixing />;
    case "sound":
      return <PatternSoundDesign />;
    default:
      return null;
  }
}

function TypeCard({
  type,
  label,
  active,
  onSelect,
}: {
  type: SessionType;
  label: string;
  active: boolean;
  onSelect: () => void;
}) {
  const visual = UI_BY_TYPE[type];
  const Icon = visual.Icon;
  const accent = colorForType(type);
  const inactiveIcon = `${accent}8c`;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
        onSelect();
      }}
      style={({ pressed }) => [styles.typeCardPressable, pressed && styles.typeCardPressed]}
    >
      <View style={[styles.typeCardOuter, active && { borderColor: accent }]}>
        {active ? (
          <LinearGradient colors={[...visual.gradient]} style={styles.typeGradientActive}>
            <View style={styles.typePatternLayer} pointerEvents="none">
              <TypePattern kind={visual.pattern} />
            </View>
            <View style={styles.typeRow}>
              <View style={styles.typeIconBadge}>
                <Icon size={26} color="#ffffff" strokeWidth={2.2} />
              </View>
              <Text style={styles.typeLabel}>{label}</Text>
            </View>
          </LinearGradient>
        ) : (
          <View style={styles.typeInner}>
            <View style={[styles.typeIconBadgeMuted, { borderColor: `${accent}40` }]}>
              <Icon size={26} color={inactiveIcon} strokeWidth={2.2} />
            </View>
            <Text style={styles.typeLabelMuted}>{label}</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

export type SessionSetupFormProps = {
  /** Called after the session is created successfully (API returned). */
  onStarted: (session: SessionDto) => void;
  /** Server already has an active session — refresh parent state and stay calm. */
  onActiveSessionConflict?: (sessionId?: number) => void;
  /** Optional header close (e.g. modal dismiss). */
  onRequestClose?: () => void;
  /** Hide top title row (e.g. when embedded in another header). */
  hideTitleRow?: boolean;
};

export function SessionSetupForm({
  onStarted,
  onActiveSessionConflict,
  onRequestClose,
  hideTitleRow,
}: SessionSetupFormProps) {
  const { t } = useTranslation();
  const { token, hydrated } = useAuth();
  const mounted = useRef(true);
  const startRequestInFlight = useRef(false);
  const submitCooldownTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (submitCooldownTimeout.current) {
        clearTimeout(submitCooldownTimeout.current);
        submitCooldownTimeout.current = null;
      }
    };
  }, []);
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
      const tag = raw.trim().toLowerCase();
      if (!tag || tag.length > 32) return;
      if (tags.length >= 20) return;
      if (tags.includes(tag)) return;
      setTags((prev) => [...prev, tag]);
      setTagInput("");
    },
    [tags],
  );

  const onSubmit = useCallback(async () => {
    if (!hydrated || !token?.trim() || !selectedType || busy || startRequestInFlight.current) {
      if (hydrated && !token?.trim()) {
        setError("Not signed in. Please log in again.");
      }
      return;
    }
    startRequestInFlight.current = true;
    if (mounted.current) setBusy(true);
    if (mounted.current) setError(null);
    debugLog("session", "start_attempt", {
      hasNotes: Boolean(notes.trim()),
      moodLevel: mood ?? null,
      tagCount: tags.length,
    });
    try {
      const sessionData = {
        session_type: selectedType,
        notes: notes.trim() ? notes.trim().slice(0, 200) : undefined,
        mood_level: mood ?? undefined,
        tags: tags.length ? tags : undefined,
      };
      const raw = await apiJson<unknown>("/sessions/start", {
        token: token.trim(),
        method: "POST",
        body: sessionData,
      });
      if (!raw || typeof raw !== "object") {
        throw new Error(`Invalid response format: ${JSON.stringify(raw)}`);
      }
      const created = tryParseSessionDto(raw);
      if (!created) {
        debugLog("session", "start_invalid_dto", {});
        throw new Error(`Invalid response DTO: ${JSON.stringify(raw)}`);
      }
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {
        /* haptics optional */
      }
      debugLog("session", "start_success", { sessionId: created.id });
      if (!mounted.current) return;
      await Promise.resolve(onStarted(created));
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
      const msg = e instanceof Error ? e.message : "Could not start session";
      debugLog("session", "start_failure", {
        status: e instanceof ApiError ? e.status : 0,
        message: msg,
      });
      if (e instanceof ApiError && e.status === 409) {
        const payload = e.payload as { detail?: unknown; session_id?: unknown } | null;
        const detailObj =
          payload && typeof payload.detail === "object" && payload.detail !== null
            ? (payload.detail as { session_id?: unknown })
            : null;
        const rawSessionId = payload?.session_id ?? detailObj?.session_id;
        const existingSessionId =
          typeof rawSessionId === "number" && Number.isFinite(rawSessionId) && rawSessionId > 0
            ? rawSessionId
            : null;

        if (existingSessionId) {
          try {
            const activeRaw = await apiJson<unknown>(`/sessions/item/${existingSessionId}`, {
              token: token.trim(),
            });
            const existing = tryParseSessionDto(activeRaw);
            if (existing) {
              Alert.alert(
                "Session already active",
                "You already have an active session. We'll continue with it.",
                [{ text: "Continue" }],
              );
              onStarted(existing);
              onActiveSessionConflict?.(existingSessionId);
              return;
            }
          } catch {
            /* fallback below */
          }
          onActiveSessionConflict?.(existingSessionId);
        } else {
          onActiveSessionConflict?.();
        }
        if (mounted.current) setError("You already have an active session.");
        return;
      }
      if (mounted.current) setError(msg);
    } finally {
      if (submitCooldownTimeout.current) clearTimeout(submitCooldownTimeout.current);
      submitCooldownTimeout.current = setTimeout(() => {
        startRequestInFlight.current = false;
      }, 800);
      if (mounted.current) setBusy(false);
    }
  }, [busy, hydrated, mood, notes, onActiveSessionConflict, onStarted, selectedType, tags, token]);

  const suggested = useMemo(() => SUGGESTED_TAGS.filter((s) => !tags.includes(s)), [tags]);

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={12}
    >
      {!hideTitleRow ? (
        <View style={styles.header}>
          <Text style={styles.title}>{t("dashboard.newSessionTitle")}</Text>
          {onRequestClose ? (
            <Pressable
              hitSlop={12}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
                onRequestClose();
              }}
              style={styles.closeBtn}
            >
              <Text style={styles.closeText}>✕</Text>
            </Pressable>
          ) : (
            <View style={styles.closePlaceholder} />
          )}
        </View>
      ) : null}

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.sectionLabel}>{t("sessionActive.sessionType")}</Text>
        <View style={styles.typeColumn}>
          {SESSION_TYPE_IDS.map((type) => (
            <TypeCard
              key={type}
              type={type}
              label={sessionTypeLabel(type, t)}
              active={selectedType === type}
              onSelect={() => setSelectedType(type)}
            />
          ))}
        </View>

        <Text style={styles.sectionLabel}>{t("sessionSetup.notesSection")}</Text>
        <TextInput
          style={styles.notes}
          placeholder={t("sessionActive.notesPlaceholder")}
          placeholderTextColor={colors.textSecondary}
          multiline
          textAlignVertical="top"
          maxLength={200}
          autoCapitalize="sentences"
          value={notes}
          onChangeText={setNotes}
        />
        <Text style={styles.counter}>{noteLen}/200</Text>

        <Text style={styles.sectionLabel}>{t("sessionSetup.moodSection")}</Text>
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

        <Text style={styles.sectionLabel}>{t("sessionSetup.tagsSection")}</Text>
        <View style={styles.tagWrap}>
          {tags.map((tg) => (
            <Pressable
              key={tg}
              style={styles.tagChip}
              onPress={() => setTags((prev) => prev.filter((x) => x !== tg))}
            >
              <Text style={styles.tagText}>{tg}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.tagInputRow}>
          <TextInput
            style={styles.tagField}
            placeholder={t("sessionSetup.tagPlaceholder")}
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
        <View style={styles.suggestedRow}>
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
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>

      <View style={styles.footer}>
        <PrimaryButton
          label={t("sessionSetup.startCta")}
          onPress={onSubmit}
          loading={busy}
          disabled={!hydrated || !canStart}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  closePlaceholder: { width: 40, height: 40 },
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
  typeCardPressable: {
    borderRadius: radii.lg,
  },
  typeCardPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.985 }],
  },
  typeCardOuter: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    backgroundColor: colors.surface,
  },
  typeGradientActive: {
    position: "relative",
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    minHeight: 88,
    overflow: "hidden",
    justifyContent: "center",
  },
  typePatternLayer: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.95,
  },
  typeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    zIndex: 1,
  },
  typeIconBadge: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.22)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
  },
  typeIconBadgeMuted: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  patternRoot: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
  },
  patternBeatRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    height: 44,
    paddingHorizontal: spacing.sm,
    opacity: 0.35,
    gap: 4,
  },
  patternBeatBar: {
    flex: 1,
    maxWidth: 10,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.9)",
  },
  patternMixRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    height: 40,
    paddingHorizontal: spacing.md,
    opacity: 0.32,
    gap: 5,
  },
  patternMixTrack: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    height: 40,
  },
  patternMixCap: {
    width: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.88)",
  },
  patternSoundRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 7,
    paddingHorizontal: spacing.sm,
    opacity: 0.28,
  },
  patternSoundRowOffset: {
    marginLeft: 14,
  },
  patternSoundDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "rgba(255,255,255,0.85)",
  },
  typeInner: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  typeLabel: { color: "#fff", fontFamily: fontFamily.heading, ...typography.subheadline },
  typeLabelMuted: {
    color: colors.textPrimary,
    fontFamily: fontFamily.heading,
    ...typography.subheadline,
    flex: 1,
  },
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
  counter: {
    alignSelf: "flex-end",
    color: colors.textSecondary,
    ...typography.caption,
    marginTop: 4,
  },
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
  tagInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
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
  suggestedRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  suggestedChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radii.round,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  suggestedText: {
    color: colors.textSecondary,
    fontFamily: fontFamily.body,
    ...typography.caption,
  },
  error: { color: colors.danger, marginTop: spacing.md, ...typography.caption },
  footer: {
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
});
