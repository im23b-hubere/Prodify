import { useEffect, useState } from "react";

const HINT_DELAY_MS = 4_000;

/**
 * Whether a sign-in request has been running long enough to warn about a slow connection.
 *
 * Hiding the hint belongs in the cleanup rather than the effect body: the effect only ever
 * starts the timer, and every path that ends the request — settling, unmounting — already
 * tears that timer down.
 */
export function useConnectionHint(loading: boolean): boolean {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!loading) return;
    const timer = setTimeout(() => setVisible(true), HINT_DELAY_MS);
    return () => {
      clearTimeout(timer);
      setVisible(false);
    };
  }, [loading]);

  return visible;
}
