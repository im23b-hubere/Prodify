import type { ComponentProps } from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";

import { SessionSocialSections } from "../../../features/sessions/components/SessionSocialSections";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

function renderSections(overrides: Partial<ComponentProps<typeof SessionSocialSections>> = {}) {
  const props: ComponentProps<typeof SessionSocialSections> = {
    comments: [],
    commentInput: "",
    commentsLoading: false,
    commentsError: null,
    commentSending: false,
    reactions: [
      {
        target_type: "session",
        target_id: 12,
        emoji: "🔥",
        count: 3,
        reacted_by_me: true,
      },
    ],
    reactionsLoading: false,
    reactionsError: null,
    reactionBusyEmoji: null,
    highlightedCommentId: null,
    commentSentPulse: false,
    onCommentInputChange: jest.fn(),
    onCommentSubmit: jest.fn(),
    onCommentFocus: jest.fn(),
    onReactionToggle: jest.fn(),
    ...overrides,
  };
  render(<SessionSocialSections {...props} />);
  return props;
}

describe("SessionSocialSections", () => {
  it("keeps reaction and comment actions independent", () => {
    const props = renderSections();

    fireEvent.press(screen.getByText("🔥"));
    fireEvent.changeText(screen.getByPlaceholderText("friendsScreen.commentPlaceholder"), "Nice");
    fireEvent(screen.getByPlaceholderText("friendsScreen.commentPlaceholder"), "focus");
    fireEvent.press(screen.getByText("friendsScreen.commentSend"));

    expect(props.onReactionToggle).toHaveBeenCalledWith("🔥");
    expect(props.onCommentInputChange).toHaveBeenCalledWith("Nice");
    expect(props.onCommentFocus).toHaveBeenCalledTimes(1);
    expect(props.onCommentSubmit).toHaveBeenCalledTimes(1);
  });

  it("renders independent loading and error states", () => {
    renderSections({
      commentsLoading: true,
      reactionsError: "reactions unavailable",
    });

    expect(screen.getAllByText("friendsScreen.loading")).toHaveLength(1);
    expect(screen.getByText("reactions unavailable")).toBeTruthy();
  });
});
