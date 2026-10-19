import { useSyncExternalStore } from "react";

/**
 * The launch: the logo layer covers the app while it decides where to go, then zooms
 * away to reveal the first screen.
 *
 * - `splash`: the logo layer is up.
 * - `revealing`: the first screen is mounted underneath and the logo is zooming away.
 * - `done`: the layer is gone.
 */
export type LaunchPhase = "splash" | "revealing" | "done";

let phase: LaunchPhase = "splash";
const listeners = new Set<() => void>();

export function getLaunchPhase(): LaunchPhase {
  return phase;
}

export function setLaunchPhase(next: LaunchPhase): void {
  if (next === phase) return;
  phase = next;
  for (const listener of listeners) listener();
}

export function subscribeLaunchPhase(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useLaunchPhase(): LaunchPhase {
  return useSyncExternalStore(subscribeLaunchPhase, getLaunchPhase);
}
