import { fireEvent, render, screen } from "@testing-library/react-native";
import type { ComponentProps } from "react";

import { ChallengeCreateModal } from "../../../features/friends/components/ChallengeCreateModal";
import type { FriendLeaderboardEntryDto } from "../../../types/friends";

const friend = {
  rank: 1,
  user_id: 2,
  username: "Mia",
  current_streak_days: 5,
  sessions_in_period: 8,
} satisfies FriendLeaderboardEntryDto;

function modalProps(overrides: Partial<ComponentProps<typeof ChallengeCreateModal>> = {}) {
  return {
    t: (key: string) => key,
    open: true,
    title: "",
    onTitleChange: jest.fn(),
    target: "5",
    onTargetChange: jest.fn(),
    duration: "7",
    onDurationChange: jest.fn(),
    entries: [friend],
    currentUserId: 1,
    selectedMembers: [],
    setSelectedMembers: jest.fn(),
    busy: false,
    onSubmit: jest.fn(),
    onReset: jest.fn(),
    onAddFriend: jest.fn(),
    ...overrides,
  };
}

describe("ChallengeCreateModal", () => {
  it("connects fields, member selection and submit action", () => {
    const props = modalProps();
    render(<ChallengeCreateModal {...props} />);

    fireEvent.changeText(screen.getByLabelText("friendsScreen.challengeTitleLabel"), "Finish EP");
    fireEvent.press(screen.getByLabelText("Mia"));
    fireEvent.press(screen.getByText("friendsScreen.createChallengeCta"));

    expect(props.onTitleChange).toHaveBeenCalledWith("Finish EP");
    expect(props.setSelectedMembers).toHaveBeenCalledWith(expect.any(Function));
    expect(props.onSubmit).toHaveBeenCalledTimes(1);
  });

  it("resets the challenge before opening add friend from an empty state", () => {
    const props = modalProps({ entries: [] });
    render(<ChallengeCreateModal {...props} />);

    fireEvent.press(screen.getByText("friendsScreen.challengeMemberEmptyCta"));
    expect(props.onReset).toHaveBeenCalledTimes(1);
    expect(props.onAddFriend).toHaveBeenCalledTimes(1);
  });
});
