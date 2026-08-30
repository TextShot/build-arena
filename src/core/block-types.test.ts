import { describe, expect, it } from "vitest";

import { defaultStateFor, normalizeBlockState } from "./block-types";

describe("defaultStateFor", () => {
  it("returns undefined for a cube with no state", () => {
    expect(defaultStateFor("stone")).toBeUndefined();
  });

  it("defaults a repeater to east", () => {
    expect(defaultStateFor("repeater")).toEqual({ facing: "east" });
  });
});

describe("normalizeBlockState", () => {
  it("accepts a repeater facing", () => {
    expect(normalizeBlockState("repeater", { facing: "north" })).toEqual({
      ok: true,
      state: { facing: "north" },
    });
  });

  it("rejects a repeater with no state", () => {
    expect(normalizeBlockState("repeater", undefined)).toEqual({
      ok: false,
      error: "repeater requires block state",
    });
  });

  it("accepts a comparator facing and mode", () => {
    expect(normalizeBlockState("comparator", { facing: "west", mode: "subtract" })).toEqual({
      ok: true,
      state: { facing: "west", mode: "subtract" },
    });
  });

  it("rejects state on a lever", () => {
    expect(normalizeBlockState("lever", { facing: "east" })).toEqual({
      ok: false,
      error: "lever does not support block state",
    });
  });
});
