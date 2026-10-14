/** Wraps an async task so overlapping calls run one after another instead of interleaving. */
export function serializeAsync<Args extends unknown[]>(
  task: (...args: Args) => Promise<void>,
): (...args: Args) => Promise<void> {
  let tail: Promise<void> = Promise.resolve();
  return (...args: Args) => {
    const run = tail.then(() => task(...args));
    tail = run.catch(() => undefined);
    return run;
  };
}
