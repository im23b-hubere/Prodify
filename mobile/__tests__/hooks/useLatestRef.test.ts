import { renderHook } from "@testing-library/react-native";

import { useLatestRef } from "../../hooks/useLatestRef";

describe("useLatestRef", () => {
  it("holds the initial value before anything changes", () => {
    const { result } = renderHook(() => useLatestRef("first"));

    expect(result.current.current).toBe("first");
  });

  it("points at the newest value after a re-render", () => {
    const { result, rerender } = renderHook(({ value }) => useLatestRef(value), {
      initialProps: { value: "first" },
    });

    rerender({ value: "second" });

    expect(result.current.current).toBe("second");
  });

  it("keeps one ref object, so a callback that captured it reads the newest value", () => {
    const { result, rerender } = renderHook(({ token }) => useLatestRef(token), {
      initialProps: { token: "old-token" },
    });
    const capturedByCallback = result.current;

    rerender({ token: "rotated-token" });

    expect(result.current).toBe(capturedByCallback);
    expect(capturedByCallback.current).toBe("rotated-token");
  });
});
