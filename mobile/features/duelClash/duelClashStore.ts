import { useSyncExternalStore } from "react";

export type DuelClashSide = {
  name: string;
  photoUri: string | null;
};

export type DuelClashPayload = {
  challengeId: number;
  you: DuelClashSide;
  opponent: DuelClashSide;
};

type Listener = () => void;

let queue: DuelClashPayload[] = [];
const listeners = new Set<Listener>();

function emit() {
  for (const listener of listeners) listener();
}

/** Queues a clash; the same challenge is never queued twice. */
export function showDuelClash(payload: DuelClashPayload) {
  if (queue.some((item) => item.challengeId === payload.challengeId)) return;
  queue = [...queue, payload];
  emit();
}

export function dismissCurrentDuelClash() {
  if (queue.length === 0) return;
  queue = queue.slice(1);
  emit();
}

export function clearDuelClashQueue() {
  queue = [];
  emit();
}

function subscribe(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function currentClash() {
  return queue[0] ?? null;
}

export function useCurrentDuelClash(): DuelClashPayload | null {
  return useSyncExternalStore(subscribe, currentClash, currentClash);
}
