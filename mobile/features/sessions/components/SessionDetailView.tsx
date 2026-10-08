import { Trash2 } from "lucide-react-native";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { SessionShareImageModal } from "../../../components/session/SessionShareImageModal";
import { BackButton } from "../../../components/ui/BackButton";
import { ScrollRevealProvider, useScrollRevealSource } from "../../../components/ui/ScrollReveal";
import { colors } from "../../../constants/theme";
import type { SessionDetailController } from "../hooks/useSessionDetailController";
import { sessionDetailStyles as styles } from "../sessionDetail.styles";
import { SessionCommentComposer } from "./SessionCommentComposer";
import { SessionDetailContent } from "./SessionDetailContent";
import { SessionEditFooter } from "./SessionEditActions";
import { SessionDetailHero } from "./SessionDetailHero";
import { SessionDetailLoading } from "./SessionDetailStates";
import { SessionReactionBar } from "./SessionReactionBar";

export function SessionDetailView({ controller }: { controller: SessionDetailController }) {
  // Lets the session type menu scroll the page so it can open in full.
  const scrollReveal = useScrollRevealSource(controller.scrollRef);
  if (!controller.session) return <SessionDetailLoading controller={controller} />;
  const { session, presentation } = controller;
  if (!presentation) return null;
  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <SessionShareImageModal
        visible={controller.shareOpen}
        onClose={controller.closeShare}
        session={session}
        insights={controller.insights}
        focusScore={session.focus_score ?? null}
        producerName={controller.isOwnSession ? controller.user?.username : controller.producerName}
      />
      <KeyboardAvoidingView
        style={styles.keyboardWrap}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 12 : 0}
      >
        <ScrollView
          ref={controller.scrollRef}
          onContentSizeChange={controller.onContentSizeChange}
          onScrollBeginDrag={controller.stopFollowingComments}
          onScroll={scrollReveal.onScroll}
          scrollEventThrottle={16}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={controller.refreshing}
              onRefresh={() => void controller.refresh()}
              tintColor={colors.primary}
            />
          }
        >
          <View style={styles.topRow}>
            <BackButton onPress={controller.goBack} />
            {controller.isOwnSession ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={controller.t("sessionDetail.deleteSession")}
                hitSlop={12}
                onPress={controller.confirmDelete}
                style={({ pressed }) => pressed && styles.pressed}
                testID="session-detail-delete"
              >
                <Trash2 color={colors.danger} size={20} strokeWidth={2} />
              </Pressable>
            ) : null}
          </View>
          <SessionDetailHero
            t={controller.t}
            session={session}
            durationLabel={presentation.durationLabel}
            dateLine={presentation.dateLine}
            isOwnSession={controller.isOwnSession}
            isActiveSession={presentation.isActiveSession}
            producerDisplayName={controller.producerName}
            focusScore={presentation.focusScore}
            trackOutcomeLabel={presentation.trackOutcomeLabel}
            onShareStory={controller.openShare}
            onResumeActive={controller.resumeActive}
            onOpenProfile={controller.openProfile}
          />
          <SessionReactionBar
            reactions={controller.reactions}
            loading={controller.reactionsLoading}
            error={controller.reactionsError}
            busyEmoji={controller.reactionBusyEmoji}
            onToggle={(emoji) => void controller.toggleReaction(emoji)}
          />
          <ScrollRevealProvider value={scrollReveal.reveal}>
            <SessionDetailContent controller={controller} />
          </ScrollRevealProvider>
        </ScrollView>
        {controller.isOwnSession && controller.isDirty ? (
          <SessionEditFooter
            busy={controller.busy}
            onSave={() => void controller.save()}
            onDelete={controller.confirmDelete}
          />
        ) : (
          <SessionCommentComposer
            value={controller.commentInput}
            sending={controller.commentSending}
            sentPulse={controller.commentSentPulse}
            onChange={controller.setCommentInput}
            onSubmit={() => void controller.submitComment()}
            onFocus={controller.focusComment}
          />
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
