import { fireEvent, render, screen } from "@testing-library/react-native";

import { SessionCommentsSection } from "../../../features/sessions/components/SessionCommentsSection";
import type { SocialCommentDto } from "../../../types/friends";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const comment: SocialCommentDto = {
  id: 12,
  target_type: "session",
  target_id: 3,
  author_id: 7,
  author_username: "bob",
  author_profile_picture_url: null,
  body: "nice beat",
  created_at: "2026-10-12T10:00:00Z",
};

function renderSection(onCommentOptions = jest.fn()) {
  render(
    <SessionCommentsSection
      comments={[comment]}
      loading={false}
      error={null}
      highlightedCommentId={null}
      onCommentOptions={onCommentOptions}
    />,
  );
  return onCommentOptions;
}

describe("SessionCommentsSection", () => {
  it("opens the options for a comment on long press", () => {
    const onCommentOptions = renderSection();

    fireEvent(screen.getByTestId("session-comment-12"), "longPress");

    expect(onCommentOptions).toHaveBeenCalledWith(comment);
  });

  it("offers the same options to screen reader users", () => {
    const onCommentOptions = renderSection();
    const row = screen.getByTestId("session-comment-12");

    fireEvent(row, "accessibilityAction", { nativeEvent: { actionName: "longpress" } });

    expect(row.props.accessibilityHint).toBe("safety.menu.commentHint");
    expect(onCommentOptions).toHaveBeenCalledWith(comment);
  });
});
