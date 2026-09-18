import { fireEvent, render } from "@testing-library/react-native";

import { FriendsActivityWidget } from "../../../components/dashboard/FriendsActivityWidget";
import type { FriendActivityDto, FriendLeaderboardEntryDto } from "../../../types/friends";

const mockPush = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock("expo-haptics", () => ({
  selectionAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock("lucide-react-native", () => ({
  ChevronDown: () => null,
  ChevronRight: () => null,
  ChevronUp: () => null,
  Users: () => null,
}));

const ME = 7;

const self: FriendLeaderboardEntryDto = {
  rank: 1,
  user_id: ME,
  username: "me",
  current_streak_days: 1,
  sessions_in_period: 1,
};

function activityBy(userId: number, username: string): FriendActivityDto {
  return {
    session_id: userId * 100,
    user_id: userId,
    username,
    session_type: "beat_making",
    activity_at: "2026-09-18T10:00:00Z",
    status: "completed",
    completed_at: "2026-09-18T10:01:00Z",
  };
}

describe("FriendsActivityWidget", () => {
  beforeEach(() => mockPush.mockClear());

  it("shows the no-friends state when expanded, even with your own session in the feed", () => {
    const { getByTestId, getByText } = render(
      <FriendsActivityWidget
        currentUserId={ME}
        activity={[activityBy(ME, "me")]}
        leaderboard={[self]}
        loading={false}
        collapsible
      />,
    );

    expect(getByTestId("friends-widget-collapsed")).toBeTruthy();

    fireEvent.press(getByText("friendsWidget.title"));

    expect(getByTestId("friends-widget-empty")).toBeTruthy();
    expect(getByText("friendsWidget.emptyTitle")).toBeTruthy();
    expect(getByText("friendsWidget.emptySub")).toBeTruthy();

    fireEvent.press(getByText("friendsWidget.addFriends"));
    expect(mockPush).toHaveBeenCalledWith("/(tabs)/friends?addFriend=1");
  });

  it("shows friends' activity but not your own", () => {
    const { getByText, queryByText, queryByTestId } = render(
      <FriendsActivityWidget
        currentUserId={ME}
        activity={[activityBy(ME, "me"), activityBy(8, "sam")]}
        leaderboard={[self]}
        loading={false}
      />,
    );

    expect(queryByTestId("friends-widget-empty")).toBeNull();
    expect(getByText("sam")).toBeTruthy();
    expect(queryByText("me")).toBeNull();
  });
});
