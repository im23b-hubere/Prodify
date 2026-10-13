import { fireEvent, render, screen } from "@testing-library/react-native";
import type { ComponentProps } from "react";

import { BlockedUsersView } from "../../../features/safety/components/BlockedUsersView";
import type { BlockedUserDto } from "../../../lib/moderation";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock("react-native-safe-area-context", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    SafeAreaView: ({ children }: { children: React.ReactNode }) => React.createElement(View, null, children),
  };
});

const bob: BlockedUserDto = {
  user_id: 7,
  username: "bob",
  profile_picture_url: null,
  blocked_at: "2026-10-12T10:00:00Z",
};

function renderView(overrides: Partial<ComponentProps<typeof BlockedUsersView>> = {}) {
  const props: ComponentProps<typeof BlockedUsersView> = {
    status: "ready",
    users: [bob],
    unblockingIds: [],
    onRetry: jest.fn(),
    onUnblock: jest.fn(),
    onBack: jest.fn(),
    ...overrides,
  };
  render(<BlockedUsersView {...props} />);
  return props;
}

describe("BlockedUsersView", () => {
  it("shows a loading state while the list loads", () => {
    renderView({ status: "loading", users: [] });

    expect(screen.getByLabelText("safety.blocked.loading")).toBeTruthy();
  });

  it("explains an empty list", () => {
    renderView({ users: [] });

    expect(screen.getByText("safety.blocked.emptyTitle")).toBeTruthy();
  });

  it("offers a retry when loading failed", () => {
    const props = renderView({ status: "error", users: [] });

    fireEvent.press(screen.getByText("common.retry"));

    expect(props.onRetry).toHaveBeenCalledTimes(1);
  });

  it("unblocks a listed user", () => {
    const props = renderView();

    expect(screen.getByText("bob")).toBeTruthy();
    fireEvent.press(screen.getByLabelText("safety.blocked.unblockA11y"));

    expect(props.onUnblock).toHaveBeenCalledWith(bob);
  });

  it("shows progress and ignores taps while a user is being unblocked", () => {
    const props = renderView({ unblockingIds: [7] });
    const button = screen.getByLabelText("safety.blocked.unblockA11y");

    fireEvent.press(button);

    expect(button.props.accessibilityState).toMatchObject({ busy: true, disabled: true });
    expect(props.onUnblock).not.toHaveBeenCalled();
  });

  it("goes back from the top bar", () => {
    const props = renderView();

    fireEvent.press(screen.getByLabelText("common.goBack"));

    expect(props.onBack).toHaveBeenCalledTimes(1);
  });
});
