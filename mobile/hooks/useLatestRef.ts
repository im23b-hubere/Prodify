import { useEffect, useRef, type RefObject } from "react";

/**
 * A ref that tracks the most recent committed `value`.
 *
 * Long-lived callbacks read fresh data through the ref instead of listing the value as a
 * dependency, which would recreate them on every change. Assigning during render would be the
 * shorter spelling, but a render React throws away would leave the ref holding a value that was
 * never committed — so the write happens in an effect.
 *
 * Call this before any effect that reads the ref: effects run in declaration order, so the
 * ref is current by the time those effects fire.
 */
export function useLatestRef<T>(value: T): RefObject<T> {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref;
}
