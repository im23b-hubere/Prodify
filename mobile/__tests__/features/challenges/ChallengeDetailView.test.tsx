import { fireEvent, render, screen } from "@testing-library/react-native";

import { ChallengeDetailContent } from "../../../features/challenges/components/ChallengeDetailContent";
import { ChallengeEditModal } from "../../../features/challenges/components/ChallengeEditModal";
import type { ChallengeDetailController } from "../../../features/challenges/hooks/useChallengeDetail";
import type { SocialChallengeDto } from "../../../types/friends";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const challenge: SocialChallengeDto = {
  id: 9,
  owner_id: 1,
  challenge_kind: "duel",
  title: "Finish tracks",
  week_start: "2026-08-10",
  target_sessions: 5,
  duration_days: 7,
  status: "active",
  members: [
    { user_id: 1, username: "Ada", progress_sessions: 4 },
    { user_id: 2, username: "Lin", progress_sessions: 2 },
  ],
};

function controller(overrides: Partial<ChallengeDetailController> = {}): ChallengeDetailController {
  return {
    challenge,
    loading: false,
    refreshing: false,
    error: null,
    busyActionKey: null,
    load: jest.fn().mockResolvedValue(undefined),
    join: jest.fn().mockResolvedValue(undefined),
    confirmCancel: jest.fn(),
    confirmLeave: jest.fn(),
    isMember: false,
    isOwner: false,
    isActive: true,
    daysLeft: 5,
    leaderMember: challenge.members[0],
    totalSessions: 6,
    outcomeLine: null,
    editOpen: false,
    closeEdit: jest.fn(),
    openEdit: jest.fn(),
    editTitle: "Finish tracks",
    setEditTitle: jest.fn(),
    editTarget: "5",
    setEditTarget: jest.fn(),
    editDuration: "7",
    setEditDuration: jest.fn(),
    editBusy: false,
    submitEdit: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("Challenge detail views", () => {
  it("renders progress and lets a non-member join", () => {
    const detail = controller();
    render(<ChallengeDetailContent detail={detail} currentUserId={2} />);

    expect(screen.getByText("Finish tracks")).toBeTruthy();
    expect(screen.getByText("4/5")).toBeTruthy();
    fireEvent.press(screen.getByText("friendsScreen.joinThisChallenge"));
    expect(detail.join).toHaveBeenCalledTimes(1);
  });

  it("exposes edit and cancel actions only to an active owner", () => {
    const detail = controller({ isMember: true, isOwner: true });
    render(<ChallengeDetailContent detail={detail} currentUserId={1} />);

    fireEvent.press(screen.getByText("friendsScreen.challengeEdit"));
    fireEvent.press(screen.getByText("friendsScreen.challengeEnd"));
    expect(detail.openEdit).toHaveBeenCalledTimes(1);
    expect(detail.confirmCancel).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("friendsScreen.joinThisChallenge")).toBeNull();
  });

  it("binds edit fields, save and close actions", () => {
    const detail = controller({ editOpen: true });
    render(<ChallengeEditModal detail={detail} />);

    fireEvent.changeText(
      screen.getByPlaceholderText("friendsScreen.challengeTitlePlaceholder"),
      "New title",
    );
    fireEvent.press(screen.getByText("friendsScreen.saveChallenge"));
    fireEvent.press(screen.getByText("friendsScreen.modalCancel"));

    expect(detail.setEditTitle).toHaveBeenCalledWith("New title");
    expect(detail.submitEdit).toHaveBeenCalledTimes(1);
    expect(detail.closeEdit).toHaveBeenCalledTimes(1);
  });
});
