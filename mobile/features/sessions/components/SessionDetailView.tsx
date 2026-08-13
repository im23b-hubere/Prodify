import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { SessionShareImageModal } from "../../../components/session/SessionShareImageModal";
import { colors } from "../../../constants/theme";
import type { SessionDetailController } from "../hooks/useSessionDetailController";
import { sessionDetailStyles as styles } from "../sessionDetail.styles";
import { SessionDetailContent } from "./SessionDetailContent";
import { SessionEditFooter } from "./SessionEditActions";
import { SessionDetailHero } from "./SessionDetailHero";
import { BackButton, SessionDetailLoading } from "./SessionDetailStates";

export function SessionDetailView({ controller }: { controller: SessionDetailController }) {
  if (!controller.session) return <SessionDetailLoading controller={controller} />;
  const { session, presentation } = controller;
  if (!presentation) return null;
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
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
          <BackButton controller={controller} />
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
          <SessionDetailContent controller={controller} />
        </ScrollView>
        {controller.isOwnSession && controller.isDirty ? (
          <SessionEditFooter
            busy={controller.busy}
            onSave={() => void controller.save()}
            onDelete={controller.confirmDelete}
          />
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
