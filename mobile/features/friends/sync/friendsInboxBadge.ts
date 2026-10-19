import { useEffect, useState } from "react";

type Listener = (count: number) => void;

let incomingCount = 0;
const listeners = new Set<Listener>();

export function getIncomingFriendRequestCount(): number {
  return incomingCount;
}

export function setIncomingFriendRequestCount(next: number): void {
  const count = Math.max(0, Math.floor(next));
  if (count === incomingCount) return;
  incomingCount = count;
  for (const listener of listeners) listener(incomingCount);
}

export function subscribeIncomingFriendRequestCount(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Tab badge and other chrome that need the latest incoming request count. */
export function useIncomingFriendRequestCount(): number {
  const [count, setCount] = useState(incomingCount);
  useEffect(() => subscribeIncomingFriendRequestCount(setCount), []);
  return count;
}
