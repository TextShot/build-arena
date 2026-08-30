import { describe, expect, it } from "vitest";

import {
  SPACE_LOAD_DONE_PERCENT,
  SPACE_LOAD_FALLBACK_MS,
  SPACE_LOAD_MID_AT_MS,
  SPACE_LOAD_MID_PERCENT,
  SPACE_LOAD_MIN_MS,
  SPACE_LOAD_START_PERCENT,
  spaceLoadPercent,
  spaceLoadShouldDismiss,
} from "./space-load";

describe("space load sequence", () => {
  it("starts at 13% and holds there before the mid beat, even if the space is already ready", () => {
    expect(spaceLoadPercent(0, false)).toBe(SPACE_LOAD_START_PERCENT);
    expect(spaceLoadPercent(SPACE_LOAD_MID_AT_MS - 1, true)).toBe(SPACE_LOAD_START_PERCENT);
  });

  it("eases to 66% at 500ms and stays there until the space is ready", () => {
    expect(spaceLoadPercent(SPACE_LOAD_MID_AT_MS, false)).toBe(SPACE_LOAD_MID_PERCENT);
    expect(spaceLoadPercent(SPACE_LOAD_MIN_MS + 200, false)).toBe(SPACE_LOAD_MID_PERCENT);
  });

  it("holds 66% through the minimum overlay time if the space is ready early", () => {
    expect(spaceLoadPercent(SPACE_LOAD_MID_AT_MS, true)).toBe(SPACE_LOAD_MID_PERCENT);
    expect(spaceLoadPercent(SPACE_LOAD_MIN_MS - 1, true)).toBe(SPACE_LOAD_MID_PERCENT);
  });

  it("completes to 100% once the space is ready and the minimum overlay time has passed", () => {
    expect(spaceLoadPercent(SPACE_LOAD_MIN_MS, true)).toBe(SPACE_LOAD_DONE_PERCENT);
  });

  it("does not dismiss until the space is ready and at least 600ms have elapsed", () => {
    expect(spaceLoadShouldDismiss(SPACE_LOAD_MIN_MS, false)).toBe(false);
    expect(spaceLoadShouldDismiss(SPACE_LOAD_MIN_MS - 1, true)).toBe(false);
    expect(spaceLoadShouldDismiss(SPACE_LOAD_MIN_MS, true)).toBe(true);
  });

  it("completes and dismisses after a fallback so a stuck renderer cannot trap the overlay", () => {
    expect(spaceLoadPercent(SPACE_LOAD_FALLBACK_MS, false)).toBe(SPACE_LOAD_DONE_PERCENT);
    expect(spaceLoadShouldDismiss(SPACE_LOAD_FALLBACK_MS, false)).toBe(true);
  });
});
