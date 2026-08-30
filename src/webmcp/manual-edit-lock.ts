export const MANUAL_EDIT_LOCK_TIMEOUT_MS = 5 * 60 * 1000;

export type ManualEditLockSnapshot = Readonly<{
  locked: boolean;
  expiresAt: number | null;
}>;

export type ManualEditLock = Readonly<{
  getSnapshot(): ManualEditLockSnapshot;
  setLocked(locked: boolean): ManualEditLockSnapshot;
  refresh(): ManualEditLockSnapshot;
  subscribe(listener: (snapshot: ManualEditLockSnapshot) => void): () => void;
  dispose(): void;
}>;

export function createManualEditLock(
  timeoutMs = MANUAL_EDIT_LOCK_TIMEOUT_MS,
): ManualEditLock {
  let snapshot: ManualEditLockSnapshot = Object.freeze({ locked: false, expiresAt: null });
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const listeners = new Set<(next: ManualEditLockSnapshot) => void>();

  const publish = (locked: boolean, expiresAt: number | null) => {
    snapshot = Object.freeze({ locked, expiresAt });
    for (const listener of listeners) listener(snapshot);
    return snapshot;
  };

  const clearExpiry = () => {
    if (timeout !== undefined) clearTimeout(timeout);
    timeout = undefined;
  };

  const scheduleExpiry = () => {
    clearExpiry();
    const expiresAt = Date.now() + timeoutMs;
    timeout = setTimeout(() => {
      timeout = undefined;
      publish(false, null);
    }, timeoutMs);
    return expiresAt;
  };

  return Object.freeze({
    getSnapshot: () => snapshot,
    setLocked(locked) {
      if (!locked) {
        clearExpiry();
        return publish(false, null);
      }
      return publish(true, scheduleExpiry());
    },
    refresh() {
      if (!snapshot.locked) return snapshot;
      snapshot = Object.freeze({ locked: true, expiresAt: scheduleExpiry() });
      return snapshot;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispose() {
      clearExpiry();
      listeners.clear();
    },
  });
}
