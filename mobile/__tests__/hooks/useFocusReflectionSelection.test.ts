import { act, renderHook } from "@testing-library/react-native";

import { useFocusReflectionSelection } from "../../features/sessions/hooks/useFocusReflectionSelection";
import type { FocusReflection } from "../../features/sessions/skillFocusReflection";

const planned: FocusReflection = {
  focusIds: ["beat_making.groove"],
  primaryFocusId: null,
  areaWeights: {},
};

describe("useFocusReflectionSelection for production sessions", () => {
  it("shows the areas the session went into", () => {
    const { result } = renderHook(() => useFocusReflectionSelection("production", planned));

    act(() => result.current.toggleArea("mixing"));

    expect(result.current.visibleBranches).toEqual(["beat_making", "mixing"]);
  });

  it("saves a new area weight right away", () => {
    const onCommit = jest.fn();
    const { result } = renderHook(() =>
      useFocusReflectionSelection("production", planned, onCommit),
    );

    act(() => result.current.setAreaWeight("beat_making", 3));

    expect(onCommit).toHaveBeenLastCalledWith({ ...planned, areaWeights: { beat_making: 3 } });
  });

  it("keeps focuses of every area when the reflection is saved", () => {
    const { result } = renderHook(() => useFocusReflectionSelection("production", planned));

    act(() => result.current.toggleFocus("mixing.eq"));

    expect(result.current.committedReflection.focusIds).toEqual([
      "beat_making.groove",
      "mixing.eq",
    ]);
  });

  it("keeps a planned area when its last focus is deselected", () => {
    const { result } = renderHook(() => useFocusReflectionSelection("production", planned));

    act(() => result.current.toggleFocus("beat_making.groove"));

    expect(result.current.visibleBranches).toEqual(["beat_making"]);
    expect(result.current.committedReflection.areaWeights).toEqual({ beat_making: 2 });
  });

  it("removes an area together with its focuses", () => {
    const { result } = renderHook(() => useFocusReflectionSelection("production", planned));

    act(() => result.current.toggleArea("beat_making"));

    expect(result.current.visibleBranches).toEqual([]);
    expect(result.current.committedReflection.focusIds).toEqual([]);
  });
});
