import { type SuccessfulMutation } from "../../lib/client";

const COUNTED_SESSION_WRITES: { method: string; path: RegExp }[] = [
  { method: "POST", path: /^\/sessions\/stop$/ },
  { method: "DELETE", path: /^\/sessions\/item\/\d+$/ },
  { method: "POST", path: /^\/sessions\/item\/\d+\/restore$/ },
];

const SESSION_EDIT = { method: "PATCH", path: /^\/sessions\/item\/\d+$/ };

/** Stop, delete and restore change the hours Stats counts. Start and edits do not. */
export function affectsCountedSessions(mutation: SuccessfulMutation): boolean {
  return COUNTED_SESSION_WRITES.some((write) => matches(mutation, write));
}

/** Everything Stats shows: counted hours plus the type and focus split an edit can change. */
export function affectsSessionStats(mutation: SuccessfulMutation): boolean {
  return affectsCountedSessions(mutation) || matches(mutation, SESSION_EDIT);
}

function matches({ path, method }: SuccessfulMutation, write: { method: string; path: RegExp }) {
  return write.method === method && write.path.test(path.split("?")[0]);
}
