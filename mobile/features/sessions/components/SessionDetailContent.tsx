import { Text } from "react-native";

import { SessionDetailMetadata } from "./SessionDetailMetadata";
import { SessionCommentsSection } from "./SessionCommentsSection";
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
        focusSelection={controller.focusSelection}
        canEditFocuses={controller.canEditFocuses}
      />
      <SessionCommentsSection
        comments={controller.comments}
        loading={controller.commentsLoading}
        error={controller.commentsError}
        highlightedCommentId={controller.newCommentId}
      />
      {controller.error ? <Text style={styles.errorText}>{controller.error}</Text> : null}
      {controller.isOwnSession && !controller.isDirty ? (
        <SessionDeleteAction onDelete={controller.confirmDelete} />
      ) : null}
    </>
  );
}
