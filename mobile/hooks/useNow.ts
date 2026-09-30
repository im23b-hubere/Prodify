import { useEffect, useState } from "react";

/** Current time in ms, refreshed on an interval so countdowns keep moving while a screen stays open. */
export function useNow(refreshMs = 60_000) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), refreshMs);
    return () => clearInterval(timer);
  }, [refreshMs]);

  return now;
}
