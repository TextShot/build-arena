import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createManualEditLock, MANUAL_EDIT_LOCK_TIMEOUT_MS } from "./manual-edit-lock";

describe("manual edit lock", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("automatically unlocks after five minutes without agent activity", () => {
    const lock = createManualEditLock();

    lock.setLocked(true);
    vi.advanceTimersByTime(MANUAL_EDIT_LOCK_TIMEOUT_MS - 1);
    expect(lock.getSnapshot().locked).toBe(true);

    vi.advanceTimersByTime(1);
    expect(lock.getSnapshot()).toMatchObject({ locked: false, expiresAt: null });
  });

  it("refreshes the timeout while the agent remains active", () => {
    const lock = createManualEditLock();

    lock.setLocked(true);
    vi.advanceTimersByTime(MANUAL_EDIT_LOCK_TIMEOUT_MS - 1);
    lock.refresh();
    vi.advanceTimersByTime(MANUAL_EDIT_LOCK_TIMEOUT_MS - 1);

    expect(lock.getSnapshot().locked).toBe(true);
    vi.advanceTimersByTime(1);
    expect(lock.getSnapshot().locked).toBe(false);
  });

  it("unlocks immediately when requested", () => {
    const lock = createManualEditLock();

    lock.setLocked(true);
    lock.setLocked(false);
    vi.advanceTimersByTime(MANUAL_EDIT_LOCK_TIMEOUT_MS);

    expect(lock.getSnapshot()).toMatchObject({ locked: false, expiresAt: null });
  });
});
