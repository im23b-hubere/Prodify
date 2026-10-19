import { type SuccessfulMutation, subscribeSuccessfulMutations } from "../../../lib/client";

/**
 * `changed`: a friendship moved (request, accept, delete, block) or a friend push arrived.
 * `foreground`: the app came back and a peer may have acted meanwhile.
 */
export type FriendsSyncReason = "changed" | "foreground";
type Listener = (reason: FriendsSyncReason) => void;

const listeners = new Set<Listener>();

const FRIEND_WRITES = /^\/friends(\/|$)/;
const BLOCK_WRITES = /^\/users\/\d+\/block$/;

/** Screens that show friends refetch through this, so every place agrees on the graph. */
export function subscribeFriendsSync(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function requestFriendsSync(reason: FriendsSyncReason = "changed"): void {
  for (const listener of listeners) listener(reason);
}

export function affectsFriends(mutation: SuccessfulMutation): boolean {
  const route = mutation.path.split("?")[0];
  if (mutation.method === "GET") return false;
  return FRIEND_WRITES.test(route) || BLOCK_WRITES.test(route);
}

export function isFriendPushKind(kind: unknown): boolean {
  return kind === "friend_request" || kind === "friend_accepted";
}

/** Any successful write that can move a friendship asks all friends screens to refresh. */
export function syncFriendsOnWrites(): () => void {
  return subscribeSuccessfulMutations((mutation) => {
    if (affectsFriends(mutation)) requestFriendsSync("changed");
  });
}
