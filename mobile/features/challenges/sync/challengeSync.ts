import { type SuccessfulMutation, subscribeSuccessfulMutations } from "../../../lib/client";

/**
 * `changed`: something moved a challenge (session stopped or deleted, invite answered, push arrived).
 * `foreground`: the app came back and a friend may have played meanwhile.
 */
export type ChallengeSyncReason = "changed" | "foreground";
type Listener = (reason: ChallengeSyncReason) => void;

const listeners = new Set<Listener>();

const CHALLENGE_AFFECTING_WRITES: { method: string | null; path: RegExp }[] = [
  { method: "POST", path: /^\/sessions\/stop$/ },
  { method: "DELETE", path: /^\/sessions\/item\/\d+$/ },
  { method: "POST", path: /^\/sessions\/item\/\d+\/restore$/ },
  { method: null, path: /^\/social\/challenges(\/|$)/ },
];

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

export function affectsChallenges({ path, method }: SuccessfulMutation): boolean {
  const route = path.split("?")[0];
  return CHALLENGE_AFFECTING_WRITES.some(
    (write) => (write.method == null || write.method === method) && write.path.test(route),
  );
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
