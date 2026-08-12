import type { SocialCommentDto, SocialReactionDto } from "../../../types/friends";
import { SessionCommentsSection } from "./SessionCommentsSection";
import { SessionReactionsSection } from "./SessionReactionsSection";

type SessionSocialSectionsProps = {
  comments: SocialCommentDto[];
  commentInput: string;
  commentsLoading: boolean;
  commentsError: string | null;
  commentSending: boolean;
  reactions: SocialReactionDto[];
  reactionsLoading: boolean;
  reactionsError: string | null;
  reactionBusyEmoji: string | null;
  highlightedCommentId: number | null;
  commentSentPulse: boolean;
  onCommentInputChange: (value: string) => void;
  onCommentSubmit: () => void;
  onCommentFocus: () => void;
  onReactionToggle: (emoji: string) => void;
};

export function SessionSocialSections(props: SessionSocialSectionsProps) {
  return (
    <>
      <SessionReactionsSection
        reactions={props.reactions}
        loading={props.reactionsLoading}
        error={props.reactionsError}
        busyEmoji={props.reactionBusyEmoji}
        onToggle={props.onReactionToggle}
      />
      <SessionCommentsSection
        comments={props.comments}
        input={props.commentInput}
        loading={props.commentsLoading}
        error={props.commentsError}
        sending={props.commentSending}
        highlightedCommentId={props.highlightedCommentId}
        sentPulse={props.commentSentPulse}
        onInputChange={props.onCommentInputChange}
        onSubmit={props.onCommentSubmit}
        onFocus={props.onCommentFocus}
      />
    </>
  );
}
