import { act, renderHook, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";

import { useCommentSafety } from "../../../features/safety/hooks/useCommentSafety";
import type { SocialCommentDto } from "../../../types/friends";
import { mockTFunction } from "../../helpers/mockTFunction";

type MenuItem = { label: string; onSelect: () => void };
const mockShowActionMenu = jest.fn();
const mockDeleteComment = jest.fn();
const mockBlockUser = jest.fn();

jest.mock("../../../features/safety/showActionMenu", () => ({
  showActionMenu: (menu: unknown) => mockShowActionMenu(menu),
}));

jest.mock("../../../lib/moderation", () => ({
  deleteSessionComment: (...args: unknown[]) => mockDeleteComment(...args),
  blockUser: (...args: unknown[]) => mockBlockUser(...args),
  reportUser: jest.fn(),
  reportComment: jest.fn(),
}));

jest.mock("expo-haptics", () => ({
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  NotificationFeedbackType: { Success: "success" },
}));

const t = mockTFunction();

function comment(authorId: number): SocialCommentDto {
  return {
    id: 12,
    target_type: "session",
    target_id: 3,
    author_id: authorId,
    author_username: "bob",
    author_profile_picture_url: null,
    body: "nice",
    created_at: "2026-10-12T10:00:00Z",
  };
}

function menuLabels(): string[] {
  const menu = mockShowActionMenu.mock.calls.at(-1)?.[0] as { items: MenuItem[] };
  return menu.items.map((item) => item.label);
}

function pick(label: string) {
  const menu = mockShowActionMenu.mock.calls.at(-1)?.[0] as { items: MenuItem[] };
  act(() => menu.items.find((item) => item.label === label)?.onSelect());
}

function renderSafety({ isOwnSession = false } = {}) {
  const onChanged = jest.fn();
  const hook = renderHook(() =>
    useCommentSafety({ token: "tok", t, sessionId: 3, currentUserId: 5, isOwnSession, onChanged }),
  );
  return { ...hook, onChanged };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockDeleteComment.mockResolvedValue(undefined);
  mockBlockUser.mockResolvedValue(undefined);
  jest.spyOn(Alert, "alert").mockImplementation((_title, _body, buttons) => {
    buttons?.find((button) => button.style === "destructive")?.onPress?.();
  });
});

afterEach(() => jest.restoreAllMocks());

describe("useCommentSafety", () => {
  it("lets you delete your own comment after confirming", async () => {
    const { result, onChanged } = renderSafety();

    act(() => result.current.openCommentMenu(comment(5)));
    expect(menuLabels()).toEqual(["safety.menu.deleteComment"]);
    pick("safety.menu.deleteComment");

    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(mockDeleteComment).toHaveBeenCalledWith("tok", 3, 12);
  });

  it("lets the session owner remove someone else's comment", () => {
    const { result } = renderSafety({ isOwnSession: true });

    act(() => result.current.openCommentMenu(comment(7)));

    expect(menuLabels()).toEqual(["safety.menu.deleteComment", "safety.menu.report", "safety.menu.block"]);
  });

  it("opens the report sheet for the comment", () => {
    const { result } = renderSafety();

    act(() => result.current.openCommentMenu(comment(7)));
    pick("safety.menu.report");

    expect(result.current.report.target).toEqual({ kind: "comment", commentId: 12, authorId: 7, name: "bob" });
  });

  it("blocks the commenter and refreshes the thread", async () => {
    const { result, onChanged } = renderSafety();

    act(() => result.current.openCommentMenu(comment(7)));
    pick("safety.menu.block");

    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(mockBlockUser).toHaveBeenCalledWith("tok", 7);
  });
});
