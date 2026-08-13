import { Text } from "react-native";

import { SessionDetailMetadata } from "./SessionDetailMetadata";
import { SessionSocialSections } from "./SessionSocialSections";
import { SessionDeleteAction } from "./SessionEditActions";
import type { SessionDetailController } from "../hooks/useSessionDetailController";
import { sessionDetailStyles as styles } from "../sessionDetail.styles";
import { SessionDetailInsights } from "./SessionDetailInsights";

export function SessionDetailContent({ controller }: { controller: SessionDetailController }) {
  if (!controller.session || !controller.presentation) return null;
  return (
    <>
      <SessionDetailInsights controller={controller} />
      <SessionDetailMetadata
        session={controller.session}
        presentation={controller.presentation}
        isOwnSession={controller.isOwnSession}
        selectedType={controller.selectedType}
        note={controller.note}
        onTypeChange={controller.setSelectedType}
        onNoteChange={controller.setNote}
      />
      <SessionSocialSections
        comments={controller.comments}
        commentInput={controller.commentInput}
        commentsLoading={controller.commentsLoading}
        commentsError={controller.commentsError}
        commentSending={controller.commentSending}
        reactions={controller.reactions}
        reactionsLoading={controller.reactionsLoading}
        reactionsError={controller.reactionsError}
        reactionBusyEmoji={controller.reactionBusyEmoji}
        highlightedCommentId={controller.newCommentId}
        commentSentPulse={controller.commentSentPulse}
        onCommentInputChange={controller.setCommentInput}
        onCommentSubmit={() => void controller.submitComment()}
        onReactionToggle={(emoji) => void controller.toggleReaction(emoji)}
        onCommentFocus={controller.focusComment}
      />
      {controller.error ? <Text style={styles.errorText}>{controller.error}</Text> : null}
      {controller.isOwnSession && !controller.isDirty ? (
        <SessionDeleteAction onDelete={controller.confirmDelete} />
      ) : null}
    </>
  );
}
