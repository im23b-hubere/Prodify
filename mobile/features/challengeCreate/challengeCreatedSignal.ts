type Listener = () => void;

const listeners = new Set<Listener>();

/** Lets screens behind the create sheet refresh once a challenge was sent. */
export function subscribeChallengeCreated(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function notifyChallengeCreated() {
  for (const listener of listeners) listener();
}
