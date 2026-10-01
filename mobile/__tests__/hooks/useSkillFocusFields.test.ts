import { act, renderHook } from "@testing-library/react-native";

import { useSkillFocusFields } from "../../features/sessions/hooks/useSkillFocusFields";

describe("useSkillFocusFields suggestions", () => {
  it("selects and deselects a suggestion like its chip", () => {
    const { result } = renderHook(() => useSkillFocusFields("mixing"));

    act(() => result.current.applySuggestion("mixing.eq"));
    expect(result.current.focusIds).toEqual(["mixing.eq"]);

    act(() => result.current.applySuggestion("mixing.eq"));
    expect(result.current.focusIds).toEqual([]);
  });

  it("opens the suggested area in learning sessions", () => {
    const { result } = renderHook(() => useSkillFocusFields("learning"));

    act(() => result.current.applySuggestion("recording.room"));

    expect(result.current.practiceBranch).toBe("recording");
    expect(result.current.focusIds).toEqual(["recording.room"]);
  });

  it("keeps a suggestion picked earlier when its learning area is reopened", () => {
    const { result } = renderHook(() => useSkillFocusFields("learning"));

    act(() => result.current.applySuggestion("mixing.eq"));
    act(() => result.current.selectPracticeBranch("recording"));
    act(() => result.current.applySuggestion("mixing.eq"));

    expect(result.current.practiceBranch).toBe("mixing");
    expect(result.current.focusIds).toEqual(["mixing.eq"]);
  });

  it("blocks new suggestions once the selection is full", () => {
    const { result } = renderHook(() => useSkillFocusFields("mixing"));

    act(() => result.current.toggleFocus("mixing.eq"));
    act(() => result.current.toggleFocus("mixing.dynamics"));

    expect(result.current.canApplySuggestion("mixing.space")).toBe(false);
    expect(result.current.canApplySuggestion("mixing.eq")).toBe(true);
  });

  it("still allows a suggestion from another learning area when the current one is full", () => {
    const { result } = renderHook(() => useSkillFocusFields("learning"));

    act(() => result.current.selectPracticeBranch("mixing"));
    act(() => result.current.toggleFocus("mixing.eq"));
    act(() => result.current.toggleFocus("mixing.dynamics"));

    expect(result.current.canApplySuggestion("recording.room")).toBe(true);
  });
});
