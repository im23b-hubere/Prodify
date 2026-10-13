import { act, renderHook } from "@testing-library/react-native";

import { useReportFlow } from "../../../features/safety/hooks/useReportFlow";
import { ApiError } from "../../../lib/client";
import { mockTFunction } from "../../helpers/mockTFunction";

const mockReportUser = jest.fn();
const mockReportComment = jest.fn();

jest.mock("../../../lib/moderation", () => ({
  reportUser: (...args: unknown[]) => mockReportUser(...args),
  reportComment: (...args: unknown[]) => mockReportComment(...args),
}));

const t = mockTFunction();
const draft = { reason: "spam" as const, note: "" };

beforeEach(() => {
  mockReportUser.mockReset().mockResolvedValue(undefined);
  mockReportComment.mockReset().mockResolvedValue(undefined);
});

describe("useReportFlow", () => {
  it("reports a user and shows the confirmation", async () => {
    const { result } = renderHook(() => useReportFlow("tok", t));

    act(() => result.current.open({ kind: "user", userId: 7, name: "bob" }));
    await act(() => result.current.submit(draft));

    expect(mockReportUser).toHaveBeenCalledWith("tok", 7, draft);
    expect(result.current.phase).toBe("done");
  });

  it("reports a comment", async () => {
    const { result } = renderHook(() => useReportFlow("tok", t));

    act(() => result.current.open({ kind: "comment", commentId: 12, authorId: 7, name: "bob" }));
    await act(() => result.current.submit(draft));

    expect(mockReportComment).toHaveBeenCalledWith("tok", 12, draft);
  });

  it("explains the daily limit and lets the user stay in the form", async () => {
    mockReportUser.mockRejectedValue(new ApiError(429, "slow down", null, "REPORT_LIMIT_REACHED"));
    const { result } = renderHook(() => useReportFlow("tok", t));

    act(() => result.current.open({ kind: "user", userId: 7, name: "bob" }));
    await act(() => result.current.submit(draft));

    expect(result.current.phase).toBe("editing");
    expect(result.current.error).toBe("safety.report.limitReached");
  });

  it("shows a generic retry hint for other failures", async () => {
    mockReportUser.mockRejectedValue(new Error("offline"));
    const { result } = renderHook(() => useReportFlow("tok", t));

    act(() => result.current.open({ kind: "user", userId: 7, name: "bob" }));
    await act(() => result.current.submit(draft));

    expect(result.current.error).toBe("safety.report.failed");
  });

  it("starts fresh when opened again", async () => {
    mockReportUser.mockRejectedValueOnce(new Error("offline"));
    const { result } = renderHook(() => useReportFlow("tok", t));
    act(() => result.current.open({ kind: "user", userId: 7, name: "bob" }));
    await act(() => result.current.submit(draft));

    act(() => result.current.close());
    act(() => result.current.open({ kind: "user", userId: 8, name: "eve" }));

    expect(result.current.error).toBeNull();
    expect(result.current.phase).toBe("editing");
    expect(result.current.target).toEqual({ kind: "user", userId: 8, name: "eve" });
  });
});
