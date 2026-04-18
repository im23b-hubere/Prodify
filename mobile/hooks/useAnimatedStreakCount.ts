import { useEffect, useRef, useState } from "react";

/** Ease-out cubic count toward target. */
export function useAnimatedStreakCount(target: number, durationMs = 700) {
  const [value, setValue] = useState(0);
  const startValRef = useRef(0);

  useEffect(() => {
    const from = startValRef.current;
    if (from === target) {
      setValue(target);
      return;
    }
    let frame: number;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - (1 - t) ** 3;
      const next = Math.round(from + (target - from) * eased);
      setValue(next);
      if (t < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        startValRef.current = target;
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, durationMs]);

  return value;
}
