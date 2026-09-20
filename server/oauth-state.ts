// Short-lived, single-use OAuth `state` values.
//
// Google redirects the user's browser back to /auth/google/callback with no
// Authorization header, so the callback cannot know who is connecting. Instead
// the authenticated POST /auth/google/start stores who asked under a random
// unguessable state; the callback consumes it exactly once. That also blocks
// forged callbacks (login CSRF): a state we never issued, or one already used
// or expired, is refused.

import crypto from "node:crypto";

export function createStateStore<T>(ttlMs = 10 * 60_000, now: () => number = Date.now) {
  const entries = new Map<string, { value: T; expiresAt: number }>();
  const MAX_ENTRIES = 1000;

  function prune() {
    const t = now();
    for (const [key, entry] of entries) if (entry.expiresAt <= t) entries.delete(key);
  }

  return {
    create(value: T): string {
      prune();
      if (entries.size >= MAX_ENTRIES) entries.delete(entries.keys().next().value as string);
      const state = crypto.randomBytes(24).toString("base64url");
      entries.set(state, { value, expiresAt: now() + ttlMs });
      return state;
    },
    /** Returns the stored value once, then forgets it. Unknown, reused or expired -> null. */
    consume(state: string | null | undefined): T | null {
      if (!state) return null;
      const entry = entries.get(state);
      entries.delete(state);
      if (!entry || entry.expiresAt <= now()) return null;
      return entry.value;
    },
  };
}
