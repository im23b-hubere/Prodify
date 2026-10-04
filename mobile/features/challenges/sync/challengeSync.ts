import { type SuccessfulMutation, subscribeSuccessfulMutations } from "../../../lib/client";
import { affectsCountedSessions } from "../../sessions/sessionMutations";

/**
 * `changed`: something moved a challenge (session stopped or deleted, invite answered, push arrived).
 * `foreground`: the app came back and a friend may have played meanwhile.
 */
export type ChallengeSyncReason = "changed" | "foreground";
type Listener = (reason: ChallengeSyncReason) => void;

const listeners = new Set<Listener>();

const CHALLENGE_WRITES = /^\/social\/challenges(\/|$)/;

/** Screens that show challenges refetch through this, so every place agrees on the score. */
export function subscribeChallengeSync(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function requestChallengeSync(reason: ChallengeSyncReason = "changed"): void {
  for (const listener of listeners) listener(reason);
}

export function affectsChallenges(mutation: SuccessfulMutation): boolean {
  const route = mutation.path.split("?")[0];
  return affectsCountedSessions(mutation) || CHALLENGE_WRITES.test(route);
}

export function isChallengePushKind(kind: unknown): boolean {
  return typeof kind === "string" && (kind.startsWith("duel_") || kind.startsWith("challenge_"));
}

/** Any successful write that can move a challenge asks all challenge screens to refresh. */
export function syncChallengesOnWrites(): () => void {
  return subscribeSuccessfulMutations((mutation) => {
    if (affectsChallenges(mutation)) requestChallengeSync("changed");
  });
}
