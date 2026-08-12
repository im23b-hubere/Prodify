import { useLocalSearchParams, useRouter, useSegments } from "expo-router";
import * as Haptics from "expo-haptics";

import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { SessionInsightSections } from "../../components/session/SessionInsightSections";
import { SessionShareImageModal } from "../../components/session/SessionShareImageModal";
import { SessionDetailHero } from "../../features/sessions/components/SessionDetailHero";
import {
  SessionDeleteAction,
  SessionEditFooter,
} from "../../features/sessions/components/SessionEditActions";
import { SessionDetailMetadata } from "../../features/sessions/components/SessionDetailMetadata";
import { SessionSocialSections } from "../../features/sessions/components/SessionSocialSections";
import {
  SESSION_INSIGHTS_MIN_SECONDS,
  useSessionDetailData,
} from "../../features/sessions/hooks/useSessionDetailData";
import { useSessionEditor } from "../../features/sessions/hooks/useSessionEditor";
import { useSessionSocial } from "../../features/sessions/hooks/useSessionSocial";
import {
  buildSessionDetailPresentation,
  resolveSessionDetailParams,
} from "../../features/sessions/sessionDetailPresentation";
import { ErrorState } from "../../components/states/ErrorState";
import { LoadingState } from "../../components/states/LoadingState";
import { fontFamily } from "../../constants/fonts";
import { colors, radii, spacing, typography } from "../../constants/theme";
import { useAuth } from "../../context/AuthContext";

export default function SessionDetailScreen() {
  const { t } = useTranslation();
  const { token, user } = useAuth();
  const router = useRouter();
  const rawParams = useLocalSearchParams<{
    id?: string | string[];
    ownerName?: string | string[];
  }>();
  const routeSegments = useSegments() as string[];
  const { sessionId: id, ownerName: ownerNameParam } = resolveSessionDetailParams(
    rawParams.id,
    rawParams.ownerName,
    routeSegments,
  );
  const {
    comments,
    commentInput,
    setCommentInput,
    commentsLoading,
    commentsError,
    commentSending,
    reactions,
    reactionsLoading,
    reactionsError,
    reactionBusyEmoji,
    newCommentId,
    commentSentPulse,
    refresh: refreshSocial,
    submitComment,
    toggleReaction: onToggleReaction,
  } = useSessionSocial({ token, sessionId: id, t });

  const {
    session,
    setSession,
    error,
    setError,
    insights,
    insightsError,
    refreshing,
    load,
    refresh,
    retryInsights,
  } = useSessionDetailData({ token, sessionId: id, t, refreshSocial });
  const [sessionImageShareOpen, setSessionImageShareOpen] = useState(false);
  const scrollRef = useRef<ScrollView | null>(null);
  const { selectedType, setSelectedType, note, setNote, busy, isDirty, save, confirmDelete } =
    useSessionEditor({
      token,
      sessionId: id,
      session,
      currentUserId: user?.id,
      t,
      onSessionUpdated: setSession,
      onClose: router.back,
      onError: setError,
    });

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

  const presentation = buildSessionDetailPresentation(session, insights, t);

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
              onRefresh={() => void refresh()}
              tintColor={colors.primary}
            />
          }
        >
          <Pressable onPress={() => router.back()} style={styles.backRow}>
            <Text style={styles.backChevron}>‹</Text>
            <Text style={styles.backText}>{t("sessionDetail.back")}</Text>
          </Pressable>

          <SessionDetailHero
            t={t}
            session={session}
            durationLabel={presentation.durationLabel}
            dateLine={presentation.dateLine}
            isOwnSession={isOwnSession}
            isActiveSession={presentation.isActiveSession}
            producerDisplayName={producerDisplayName}
            focusScore={presentation.focusScore}
            trackOutcomeLabel={presentation.trackOutcomeLabel}
            onShareStory={() => setSessionImageShareOpen(true)}
            onResumeActive={() => {
              if (typeof session.id !== "number" || !Number.isFinite(session.id)) return;
              router.push({
                pathname: "/session-active",
                params: { id: String(session.id), source: "session_detail" },
              });
            }}
            onOpenProfile={() => {
              Haptics.selectionAsync().catch(() => undefined);
              router.push(`/profile/${session.user_id}`);
            }}
          />

          {insightsError ? (
            <Pressable
              accessibilityRole="button"
              onPress={retryInsights}
              style={({ pressed }) => [styles.insightsWarning, pressed && { opacity: 0.92 }]}
            >
              <Text style={styles.insightsWarningText}>{insightsError}</Text>
              <Text style={styles.insightsWarningAction}>{t("common.tryAgain")}</Text>
            </Pressable>
          ) : null}

          {insights ? (
            <SessionInsightSections
              session={session}
              insights={insights}
              producerName={isOwnSession ? user?.username : producerDisplayName}
            />
          ) : session.duration_seconds != null &&
            session.duration_seconds < SESSION_INSIGHTS_MIN_SECONDS ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t("sessionInsights.productivity")}</Text>
              <Text style={styles.mutedNote}>
                {t("sessionInsights.availableAfterMinSession", { min: 5 })}
              </Text>
            </View>
          ) : null}

          <SessionDetailMetadata
            session={session}
            presentation={presentation}
            isOwnSession={isOwnSession}
            selectedType={selectedType}
            note={note}
            onTypeChange={setSelectedType}
            onNoteChange={setNote}
          />

          <SessionSocialSections
            comments={comments}
            commentInput={commentInput}
            commentsLoading={commentsLoading}
            commentsError={commentsError}
            commentSending={commentSending}
            reactions={reactions}
            reactionsLoading={reactionsLoading}
            reactionsError={reactionsError}
            reactionBusyEmoji={reactionBusyEmoji}
            highlightedCommentId={newCommentId}
            commentSentPulse={commentSentPulse}
            onCommentInputChange={setCommentInput}
            onCommentSubmit={() => void submitComment()}
            onReactionToggle={(emoji) => void onToggleReaction(emoji)}
            onCommentFocus={() => {
              setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 120);
            }}
          />

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {isOwnSession && !isDirty ? <SessionDeleteAction onDelete={confirmDelete} /> : null}
        </ScrollView>

        {isOwnSession && isDirty ? (
          <SessionEditFooter busy={busy} onSave={() => void save()} onDelete={confirmDelete} />
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  keyboardWrap: { flex: 1 },
  content: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  insightsWarning: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "rgba(255,170,0,0.35)",
    backgroundColor: "rgba(255,170,0,0.08)",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: 4,
  },
  insightsWarningText: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyMedium,
    ...typography.caption,
    lineHeight: 18,
  },
  insightsWarningAction: {
    color: colors.primary,
    fontFamily: fontFamily.bodyBold,
    ...typography.meta,
  },
  loadingWrap: { flex: 1, justifyContent: "center", alignItems: "center", padding: spacing.lg },
  backRow: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: spacing.sm },
  backChevron: { color: colors.primary, fontSize: 28, lineHeight: 32 },
  backText: { color: colors.primary, fontFamily: fontFamily.bodyBold, ...typography.body },
  mutedNote: { color: colors.textSecondary, ...typography.caption },
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
  errorText: { color: colors.danger, fontFamily: fontFamily.body, ...typography.caption },
});
