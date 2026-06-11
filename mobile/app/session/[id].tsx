import { useLocalSearchParams, useRouter, useSegments } from "expo-router";
import * as Haptics from "expo-haptics";
import { Check } from "lucide-react-native";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { SessionInsightSections } from "../../components/session/SessionInsightSections";
import { SessionShareImageModal } from "../../components/session/SessionShareImageModal";
import { ErrorState } from "../../components/states/ErrorState";
import { LoadingState } from "../../components/states/LoadingState";
import { PrimaryButton } from "../../components/ui/PrimaryButton";
import { SessionTypeChip } from "../../components/ui/SessionTypeChip";
import { API_BASE_URL } from "../../constants/api";
import { fontFamily } from "../../constants/fonts";
import { colors, radii, spacing, typography } from "../../constants/theme";
import { useAuth } from "../../context/AuthContext";
import { apiJson } from "../../lib/client";
import {
  createSessionComment,
  fetchSessionComments,
  fetchSessionReactions,
  toggleSessionReaction,
} from "../../lib/social";
import { sessionMoodLabel, sessionTypeLabel } from "../../lib/sessionI18n";
import { sessionTagsList, tryParseSessionDto } from "../../lib/sessionDto";
import { formatDurationWords, parseSessionDate } from "../../lib/sessionTime";
import { formatTimeAgo } from "../../lib/timeAgo";
import type { SocialCommentDto, SocialReactionDto } from "../../types/friends";
import type { SessionDetailInsightsDto } from "../../types/insights";
import {
  DEFAULT_SESSION_TYPE,
  SESSION_TYPE_IDS,
  type SessionDto,
  type SessionType,
} from "../../types/session";

const INSIGHTS_MIN_SECONDS = 5 * 60;
const SESSION_DETAIL_NOTES_MAX_LENGTH = 2000;
const DEFAULT_REACTIONS = ["🔥", "👏", "💯", "🎯", "🚀"] as const;

function resolveAvatarUri(uri?: string | null): string | null {
  if (!uri?.trim()) return null;
  return uri.startsWith("http") ? uri : `${API_BASE_URL}${uri}`;
}

function CommentRow({ comment, highlighted }: { comment: SocialCommentDto; highlighted: boolean }) {
  const pulse = useSharedValue(highlighted ? 1 : 0);

  useEffect(() => {
    if (!highlighted) {
      pulse.value = 0;
      return;
    }
    pulse.value = 1;
    pulse.value = withDelay(120, withTiming(0, { duration: 1200 }));
  }, [highlighted, pulse]);

  const animatedStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      pulse.value,
      [0, 1],
      ["rgba(255,255,255,0.03)", "rgba(255,61,0,0.16)"],
    ),
    borderColor: interpolateColor(pulse.value, [0, 1], [colors.border, "rgba(255,61,0,0.5)"]),
  }));

  return (
    <Animated.View style={[styles.commentItem, animatedStyle]}>
      {resolveAvatarUri(comment.author_profile_picture_url) ? (
        <Image
          source={{ uri: resolveAvatarUri(comment.author_profile_picture_url) as string }}
          style={styles.commentAvatarImage}
        />
      ) : (
        <View style={styles.commentAvatarFallback}>
          <Text style={styles.commentAvatarInitials}>
            {comment.author_username.slice(0, 2).toUpperCase()}
          </Text>
        </View>
      )}
      <View style={styles.commentContent}>
        <View style={styles.commentHeaderRow}>
          <Text style={styles.commentAuthor}>{comment.author_username}</Text>
          {/* keep existing relative time style from parent rendering */}
        </View>
        <Text style={styles.commentBody}>{comment.body}</Text>
      </View>
    </Animated.View>
  );
}

export default function SessionDetailScreen() {
  function formatCommentAgo(iso: string): string {
    const normalizedIso = /(?:Z|[+-]\d{2}:\d{2})$/.test(iso) ? iso : `${iso}Z`;
    return formatTimeAgo(normalizedIso, t);
  }

  const { t } = useTranslation();
  const { token, user } = useAuth();
  const router = useRouter();
  const rawParams = useLocalSearchParams<{
    id?: string | string[];
    ownerName?: string | string[];
  }>();
  const rawId = rawParams.id;
  const idFromParams =
    rawId === undefined || rawId === "" ? undefined : Array.isArray(rawId) ? rawId[0] : rawId;
  const routeSegments = useSegments() as string[];
  const idFromPathSegments = (() => {
    const i = routeSegments.indexOf("session");
    if (i < 0 || i + 1 >= routeSegments.length) return undefined;
    const seg = routeSegments[i + 1];
    return seg && /^\d+$/.test(String(seg)) ? String(seg) : undefined;
  })();
  const id = idFromParams ?? idFromPathSegments;
  const rawOwner = rawParams.ownerName;
  const ownerNameParam =
    rawOwner === undefined ? undefined : Array.isArray(rawOwner) ? rawOwner[0] : rawOwner;

  const [session, setSession] = useState<SessionDto | null>(null);
  const [selectedType, setSelectedType] = useState<SessionType>(DEFAULT_SESSION_TYPE);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [insights, setInsights] = useState<SessionDetailInsightsDto | null>(null);
  const [comments, setComments] = useState<SocialCommentDto[]>([]);
  const [commentInput, setCommentInput] = useState("");
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const [commentSending, setCommentSending] = useState(false);
  const [reactions, setReactions] = useState<SocialReactionDto[]>([]);
  const [reactionsLoading, setReactionsLoading] = useState(false);
  const [reactionsError, setReactionsError] = useState<string | null>(null);
  const [reactionBusyEmoji, setReactionBusyEmoji] = useState<string | null>(null);
  const [newCommentId, setNewCommentId] = useState<number | null>(null);
  const [commentSentPulse, setCommentSentPulse] = useState(false);
  const [sessionImageShareOpen, setSessionImageShareOpen] = useState(false);
  const scrollRef = useRef<ScrollView | null>(null);
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pulseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
      if (pulseTimeoutRef.current) clearTimeout(pulseTimeoutRef.current);
    };
  }, []);

  const loadComments = useCallback(async () => {
    if (!token || !id || !Number.isFinite(Number(id))) return;
    setCommentsLoading(true);
    setCommentsError(null);
    try {
      const rows = await fetchSessionComments(token, Number(id));
      setComments(Array.isArray(rows) ? rows : []);
    } catch {
      setComments([]);
      setCommentsError(t("sessionDetail.commentsLoadFailed"));
    } finally {
      setCommentsLoading(false);
    }
  }, [id, t, token]);

  const loadReactions = useCallback(async () => {
    if (!token || !id || !Number.isFinite(Number(id))) return;
    setReactionsLoading(true);
    setReactionsError(null);
    try {
      const rows = await fetchSessionReactions(token, Number(id));
      setReactions(Array.isArray(rows) ? rows : []);
    } catch {
      setReactions([]);
      setReactionsError(t("sessionDetail.reactionsLoadFailed"));
    } finally {
      setReactionsLoading(false);
    }
  }, [id, t, token]);

  const load = useCallback(async () => {
    if (!token || !id) {
      setError(!token ? t("sessionDetail.notSignedIn") : t("sessionDetail.missingSessionId"));
      setSession(null);
      return;
    }
    if (!Number.isFinite(Number(id))) {
      setError(t("sessionDetail.invalidId"));
      setSession(null);
      return;
    }
    setError(null);
    const raw = await apiJson<unknown>(`/sessions/item/${id}`, { token });
    const data = tryParseSessionDto(raw);
    if (!data) {
      setError(t("sessionDetail.invalidData"));
      setSession(null);
      return;
    }
    setSession(data);
    setSelectedType((data.session_type as SessionType) || DEFAULT_SESSION_TYPE);
    setNote(data.notes ?? "");
    if (
      data.stopped_at != null &&
      data.duration_seconds != null &&
      data.duration_seconds >= INSIGHTS_MIN_SECONDS
    ) {
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
  }, [id, token, t]);

  useEffect(() => {
    load().catch((e) => setError(e instanceof Error ? e.message : t("sessionDetail.loadFailed")));
  }, [load, t]);

  useEffect(() => {
    loadComments().catch(() => undefined);
  }, [loadComments]);

  useEffect(() => {
    loadReactions().catch(() => undefined);
  }, [loadReactions]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load().catch((e) =>
      setError(e instanceof Error ? e.message : t("sessionDetail.refreshFailed")),
    );
    await loadComments().catch(() => undefined);
    await loadReactions().catch(() => undefined);
    setRefreshing(false);
  }, [load, loadComments, loadReactions, t]);

  const submitComment = useCallback(async () => {
    if (!token || !id) return;
    const body = commentInput.trim();
    if (!body) return;
    setCommentSending(true);
    try {
      const created = await createSessionComment(token, Number(id), body);
      setCommentInput("");
      await loadComments();
      setNewCommentId(created.id);
      setCommentSentPulse(true);
      if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
      if (pulseTimeoutRef.current) clearTimeout(pulseTimeoutRef.current);
      highlightTimeoutRef.current = setTimeout(() => {
        setNewCommentId(null);
      }, 1800);
      pulseTimeoutRef.current = setTimeout(() => {
        setCommentSentPulse(false);
      }, 900);
      Haptics.selectionAsync().catch(() => undefined);
    } catch (e) {
      Alert.alert(
        t("friendsScreen.couldNotSendComment"),
        e instanceof Error ? e.message : t("common.tryAgain"),
      );
    } finally {
      setCommentSending(false);
    }
  }, [commentInput, id, loadComments, t, token]);

  const onToggleReaction = useCallback(
    async (emoji: string) => {
      if (!token || !id || reactionBusyEmoji) return;
      setReactionBusyEmoji(emoji);
      setReactionsError(null);
      try {
        const updated = await toggleSessionReaction(token, Number(id), emoji);
        setReactions(updated);
        Haptics.selectionAsync().catch(() => undefined);
      } catch (e) {
        setReactionsError(e instanceof Error ? e.message : t("sessionDetail.reactionToggleFailed"));
      } finally {
        setReactionBusyEmoji(null);
      }
    },
    [id, reactionBusyEmoji, t, token],
  );

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
        setError(t("sessionDetail.invalidResponse"));
        return;
      }
      setSession(updated);
      setNote(updated.notes ?? "");
      setSelectedType((updated.session_type as SessionType) || DEFAULT_SESSION_TYPE);
      router.replace("/(tabs)/dashboard");
    } catch (e) {
      setError(e instanceof Error ? e.message : t("sessionDetail.saveFailed"));
    } finally {
      setBusy(false);
    }
  }, [id, note, router, selectedType, token, t]);

  const confirmDelete = useCallback(() => {
    if (!token || !id) return;
    Alert.alert(t("sessionDetail.deleteTitle"), t("sessionDetail.deleteBody"), [
      { text: t("sessionDetail.cancel"), style: "cancel" },
      {
        text: t("sessionDetail.delete"),
        style: "destructive",
        onPress: async () => {
          try {
            await apiJson(`/sessions/item/${id}`, { token, method: "DELETE" });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
              () => undefined,
            );
            router.replace("/(tabs)/dashboard");
          } catch (e) {
            setError(e instanceof Error ? e.message : t("sessionDetail.deleteFailed"));
          }
        },
      },
    ]);
  }, [id, router, token, t]);

  if (!session) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.loadingWrap}>
          {error ? (
            <ErrorState
              title={t("common.oops")}
              message={error}
              retryLabel={t("common.tryAgain")}
              onRetry={() => void load()}
            />
          ) : (
            <LoadingState message={t("sessionDetail.loading")} />
          )}
          <Pressable
            style={styles.backRow}
            accessibilityRole="button"
            accessibilityLabel={t("sessionDetail.back")}
            onPress={() => router.back()}
          >
            <Text style={styles.backChevron}>‹</Text>
            <Text style={styles.backText}>{t("sessionDetail.back")}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const isOwnSession = Boolean(user?.id != null && session.user_id === user.id);
  const producerDisplayName =
    ownerNameParam?.trim() ||
    (isOwnSession ? user?.username : undefined) ||
    t("sessionDetail.friendProducerFallback");

  const start = parseSessionDate(session.started_at);
  const startOk = Number.isFinite(start.getTime());
  const end = session.stopped_at ? parseSessionDate(session.stopped_at) : null;
  const endOk = end ? Number.isFinite(end.getTime()) : false;
  const durationLabel =
    session.duration_seconds != null
      ? formatDurationWords(session.duration_seconds)
      : t("sessionDetail.inProgress");
  const tagList = sessionTagsList(session.tags);
  const pauseSeconds = session.paused_duration_seconds ?? 0;
  const hasMeaningfulPause = pauseSeconds >= 60;
  const pauseCountRaw =
    insights?.timeline?.filter((segment) => segment.kind === "paused").length ?? 0;
  const pauseCount = hasMeaningfulPause ? Math.max(1, pauseCountRaw) : 0;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <SessionShareImageModal
        visible={sessionImageShareOpen}
        onClose={() => setSessionImageShareOpen(false)}
        session={session}
        insights={insights}
        focusScore={session.focus_score ?? null}
        producerName={isOwnSession ? user?.username : producerDisplayName}
      />
      <KeyboardAvoidingView
        style={styles.keyboardWrap}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 12 : 0}
      >
        <ScrollView
          ref={scrollRef}
          keyboardShouldPersistTaps="handled"
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
            <Text style={styles.backText}>{t("sessionDetail.back")}</Text>
          </Pressable>

          <View style={styles.hero}>
            <Text style={styles.heroType}>{sessionTypeLabel(session.session_type, t)}</Text>
            <Text style={styles.heroDur}>{durationLabel}</Text>
            <Text style={styles.heroMeta}>
              {startOk
                ? `${start.toLocaleString(undefined, { weekday: "long", month: "short", day: "numeric" })} · ${start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`
                : "—"}
              {endOk && end
                ? ` – ${end.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`
                : ""}
            </Text>
            <Pressable
              style={styles.shareSessionBtn}
              accessibilityRole="button"
              accessibilityLabel={t("sessionDetail.shareSessionImage")}
              onPress={() => {
                setSessionImageShareOpen(true);
              }}
            >
              <Text style={styles.shareSessionBtnText}>{t("sessionDetail.shareSessionImage")}</Text>
            </Pressable>
            <Pressable
              style={styles.shareSessionBtn}
              accessibilityRole="button"
              accessibilityLabel={t("sessionDetail.shareSession")}
              onPress={() => {
                const message = t("sessionDetail.shareSessionMessage", {
                  type: sessionTypeLabel(session.session_type, t),
                  duration: durationLabel,
                });
                Share.share({ message }).catch(() => undefined);
              }}
            >
              <Text style={styles.shareSessionBtnText}>{t("sessionDetail.shareSession")}</Text>
            </Pressable>
            {!isOwnSession ? (
              <>
                <Text style={styles.friendReadOnlyHint}>
                  {t("sessionDetail.friendSessionReadOnly")}
                </Text>
                <Pressable
                  accessibilityRole="link"
                  accessibilityLabel={t("sessionDetail.viewProfileA11y", {
                    name: producerDisplayName,
                  })}
                  style={({ pressed }) => [styles.producerLink, pressed && { opacity: 0.85 }]}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => undefined);
                    router.push(`/profile/${session.user_id}`);
                  }}
                >
                  <Text style={styles.producerLinkName}>
                    {t("sessionDetail.byProducer", { name: producerDisplayName })}
                  </Text>
                  <Text style={styles.producerLinkCta}>{t("sessionDetail.viewProfile")}</Text>
                </Pressable>
              </>
            ) : null}
          </View>

          {insights ? (
            <SessionInsightSections
              session={session}
              insights={insights}
              producerName={isOwnSession ? user?.username : producerDisplayName}
            />
          ) : session.duration_seconds != null &&
            session.duration_seconds < INSIGHTS_MIN_SECONDS ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t("sessionInsights.productivity")}</Text>
              <Text style={styles.mutedNote}>
                {t("sessionInsights.availableAfterMinSession", { min: 5 })}
              </Text>
            </View>
          ) : null}

          <View style={styles.grid}>
            <View style={styles.gridCell}>
              <Text style={styles.gridLabel}>{t("sessionDetail.start")}</Text>
              <Text style={styles.gridVal}>
                {startOk
                  ? start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
                  : "—"}
              </Text>
            </View>
            <View style={styles.gridCell}>
              <Text style={styles.gridLabel}>{t("sessionDetail.end")}</Text>
              <Text style={styles.gridVal}>
                {endOk && end
                  ? end.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
                  : "—"}
              </Text>
            </View>
            <View style={styles.gridCell}>
              <Text style={styles.gridLabel}>{t("sessionDetail.mood")}</Text>
              <Text style={styles.gridVal}>
                {session.mood_level ? sessionMoodLabel(session.mood_level, t) : "—"}
              </Text>
            </View>
            <View style={styles.gridCell}>
              <Text style={styles.gridLabel}>{t("sessionDetail.pauses")}</Text>
              <Text style={styles.gridVal}>
                {hasMeaningfulPause
                  ? t("sessionDetail.pauseSummary", {
                      count: pauseCount,
                      m: Math.round(pauseSeconds / 60),
                    })
                  : "—"}
              </Text>
            </View>
          </View>

          {isOwnSession ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t("sessionDetail.sessionType")}</Text>
              <View style={styles.chips}>
                {SESSION_TYPE_IDS.map((type) => (
                  <SessionTypeChip
                    key={type}
                    label={sessionTypeLabel(type, t)}
                    active={selectedType === type}
                    onPress={() => setSelectedType(type)}
                  />
                ))}
              </View>
            </View>
          ) : (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t("sessionDetail.sessionType")}</Text>
              <Text style={styles.readOnlyVal}>{sessionTypeLabel(session.session_type, t)}</Text>
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t("sessionDetail.notes")}</Text>
            {isOwnSession ? (
              <>
                <TextInput
                  style={styles.noteInput}
                  value={note}
                  onChangeText={setNote}
                  placeholder={t("sessionDetail.notesPlaceholder")}
                  placeholderTextColor={colors.textSecondary}
                  multiline
                  maxLength={SESSION_DETAIL_NOTES_MAX_LENGTH}
                />
                <Text style={styles.noteCounter}>
                  {note.length}/{SESSION_DETAIL_NOTES_MAX_LENGTH}
                </Text>
              </>
            ) : note.trim() ? (
              <Text style={styles.noteReadOnly}>{note}</Text>
            ) : (
              <Text style={styles.mutedNote}>{t("sessionDetail.noNotes")}</Text>
            )}
          </View>

          {tagList.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t("sessionDetail.tags")}</Text>
              <View style={styles.tagRow}>
                {tagList.map((tag) => (
                  <View key={tag} style={styles.tag}>
                    <Text style={styles.tagTxt}>{tag}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t("friendsScreen.reactionsTitle")}</Text>
            {reactionsLoading ? (
              <Text style={styles.mutedNote}>{t("friendsScreen.loading")}</Text>
            ) : (
              <View style={styles.reactionRow}>
                {DEFAULT_REACTIONS.map((emoji) => {
                  const row = reactions.find((item) => item.emoji === emoji);
                  const count = row?.count ?? 0;
                  const active = Boolean(row?.reacted_by_me);
                  return (
                    <Pressable
                      key={emoji}
                      style={({ pressed }) => [
                        styles.reactionChip,
                        active && styles.reactionChipActive,
                        pressed && { opacity: 0.9 },
                      ]}
                      disabled={Boolean(reactionBusyEmoji)}
                      onPress={() => void onToggleReaction(emoji)}
                    >
                      <Text style={styles.reactionEmoji}>{emoji}</Text>
                      <Text style={[styles.reactionCount, active && styles.reactionCountActive]}>
                        {count}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
            {reactionsError ? <Text style={styles.errorText}>{reactionsError}</Text> : null}
            {!reactionsLoading && reactions.length === 0 ? (
              <Text style={styles.mutedNote}>{t("friendsScreen.noReactionsYet")}</Text>
            ) : null}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t("friendsScreen.commentsTitle")}</Text>
            {commentsLoading ? (
              <Text style={styles.mutedNote}>{t("friendsScreen.loading")}</Text>
            ) : comments.length === 0 ? (
              <Text style={styles.mutedNote}>{t("friendsScreen.beFirstToComment")}</Text>
            ) : (
              comments.map((comment) => (
                <View key={comment.id}>
                  <CommentRow comment={comment} highlighted={newCommentId === comment.id} />
                  <View style={styles.commentMetaRow}>
                    <Text style={styles.commentTime}>{formatCommentAgo(comment.created_at)}</Text>
                  </View>
                </View>
              ))
            )}
            <View style={styles.commentComposerRow}>
              <TextInput
                value={commentInput}
                onChangeText={setCommentInput}
                placeholder={t("friendsScreen.commentPlaceholder")}
                placeholderTextColor={colors.textSecondary}
                style={styles.commentInput}
                maxLength={400}
                onFocus={() => {
                  setTimeout(() => {
                    scrollRef.current?.scrollToEnd({ animated: true });
                  }, 120);
                }}
              />
              <Pressable
                style={({ pressed }) => [
                  styles.commentSendBtn,
                  commentSentPulse && styles.commentSendBtnSuccess,
                  pressed && { opacity: 0.85 },
                ]}
                disabled={commentSending}
                onPress={() => void submitComment()}
              >
                {commentSending ? (
                  <Text style={styles.commentSendText}>
                    {t("friendsScreen.commentSendingShort")}
                  </Text>
                ) : commentSentPulse ? (
                  <Check size={16} color="#22c55e" strokeWidth={2.4} />
                ) : (
                  <Text style={styles.commentSendText}>{t("friendsScreen.commentSend")}</Text>
                )}
              </Pressable>
            </View>
            {commentsError ? <Text style={styles.errorText}>{commentsError}</Text> : null}
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {isOwnSession ? (
            <>
              <PrimaryButton label={t("sessionDetail.saveChanges")} onPress={save} loading={busy} />
              <Pressable style={styles.dangerBtn} onPress={confirmDelete}>
                <Text style={styles.dangerTxt}>{t("sessionDetail.deleteSession")}</Text>
              </Pressable>
            </>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  keyboardWrap: { flex: 1 },
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
  shareSessionBtn: {
    marginTop: spacing.sm,
    alignSelf: "flex-start",
    borderRadius: radii.round,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "rgba(255,255,255,0.05)",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  shareSessionBtnText: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
    ...typography.caption,
  },
  friendReadOnlyHint: {
    marginTop: spacing.sm,
    color: colors.textSecondary,
    ...typography.caption,
    fontFamily: fontFamily.bodyMedium,
  },
  producerLink: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "rgba(255,255,255,0.04)",
    gap: 4,
  },
  producerLinkName: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
    ...typography.body,
  },
  producerLinkCta: {
    color: colors.secondary,
    fontFamily: fontFamily.bodyBold,
    ...typography.caption,
  },
  readOnlyVal: {
    color: colors.textPrimary,
    fontFamily: fontFamily.body,
    ...typography.body,
  },
  noteReadOnly: {
    color: colors.textPrimary,
    fontFamily: fontFamily.body,
    ...typography.body,
    lineHeight: 22,
  },
  mutedNote: { color: colors.textSecondary, ...typography.caption },
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
  noteCounter: {
    marginTop: spacing.xs,
    color: colors.textSecondary,
    textAlign: "right",
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
  commentItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    marginBottom: spacing.xs,
  },
  commentMetaRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: spacing.xs,
    marginBottom: spacing.xs,
  },
  commentAvatarImage: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  commentAvatarFallback: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "rgba(255,255,255,0.05)",
    alignItems: "center",
    justifyContent: "center",
  },
  commentAvatarInitials: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
    fontSize: 11,
  },
  commentContent: {
    flex: 1,
    gap: 4,
  },
  commentHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  commentAuthor: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
    ...typography.caption,
  },
  commentTime: {
    color: colors.textSecondary,
    fontFamily: fontFamily.body,
    ...typography.caption,
    fontSize: 11,
  },
  commentBody: {
    color: colors.textSecondary,
    fontFamily: fontFamily.body,
    ...typography.caption,
    lineHeight: 18,
  },
  commentComposerRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  reactionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  reactionChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.round,
    backgroundColor: "rgba(255,255,255,0.03)",
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  reactionChipActive: {
    borderColor: colors.primary,
    backgroundColor: "rgba(255,61,0,0.14)",
  },
  reactionEmoji: {
    fontSize: 16,
  },
  reactionCount: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyBold,
    ...typography.caption,
  },
  reactionCountActive: {
    color: colors.textPrimary,
  },
  commentInput: {
    flex: 1,
    height: 44,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    color: colors.textPrimary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 0,
    textAlignVertical: "center",
    ...typography.caption,
    fontFamily: fontFamily.body,
  },
  commentSendBtn: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: "rgba(255,61,0,0.12)",
    minWidth: 52,
    alignItems: "center",
  },
  commentSendBtnSuccess: {
    backgroundColor: "rgba(34,197,94,0.16)",
    borderColor: "rgba(34,197,94,0.8)",
  },
  commentSendText: {
    color: colors.primary,
    fontFamily: fontFamily.bodyBold,
    ...typography.caption,
  },
});
