import { type SuccessfulMutation } from "../../lib/client";

const COUNTED_SESSION_WRITES: { method: string; path: RegExp }[] = [
  { method: "POST", path: /^\/sessions\/stop$/ },
  { method: "DELETE", path: /^\/sessions\/item\/\d+$/ },
  { method: "POST", path: /^\/sessions\/item\/\d+\/restore$/ },
];

/** Stop, delete and restore change the hours Stats counts. Start and edits do not. */
export function affectsCountedSessions({ path, method }: SuccessfulMutation): boolean {
  const route = path.split("?")[0];
  return COUNTED_SESSION_WRITES.some(
    (write) => write.method === method && write.path.test(route),
  );
}
