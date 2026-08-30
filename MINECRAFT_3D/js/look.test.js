import { describe, expect, it } from "vitest";
import * as THREE from "../vendor/three.module.js";

import { applyLookDelta, LOOK_BY_ARROW, lookDeltaFromKeys } from "./look.js";

function readEuler(camera) {
  const euler = new THREE.Euler(0, 0, 0, "YXZ");
  euler.setFromQuaternion(camera.quaternion);
  return euler;
}

describe("applyLookDelta", () => {
  it("returns yaw near start after equal left then right steps", () => {
    const camera = new THREE.PerspectiveCamera();
    const start = readEuler(camera).y;
    const step = Math.PI / 18;
    applyLookDelta(camera, step, 0);
    applyLookDelta(camera, -step, 0);
    expect(readEuler(camera).y).toBeCloseTo(start, 6);
  });

  it("returns pitch near start after equal up then down steps", () => {
    const camera = new THREE.PerspectiveCamera();
    const start = readEuler(camera).x;
    const step = Math.PI / 18;
    applyLookDelta(camera, 0, step);
    applyLookDelta(camera, 0, -step);
    expect(readEuler(camera).x).toBeCloseTo(start, 6);
  });

  it("does not let repeated up exceed π/2", () => {
    const camera = new THREE.PerspectiveCamera();
    for (let i = 0; i < 40; i++) applyLookDelta(camera, 0, Math.PI / 18);
    expect(readEuler(camera).x).toBeLessThanOrEqual(Math.PI / 2);
    expect(readEuler(camera).x).toBeCloseTo(Math.PI / 2, 6);
  });

  it("increases yaw after a quaternion was set via Euler YXZ, then pad-left", () => {
    const camera = new THREE.PerspectiveCamera();
    camera.quaternion.setFromEuler(new THREE.Euler(0.2, 0.4, 0, "YXZ"));
    const before = readEuler(camera).y;
    applyLookDelta(camera, Math.PI / 18, 0);
    expect(readEuler(camera).y).toBeGreaterThan(before);
  });
});

describe("lookDeltaFromKeys", () => {
  it("maps ArrowLeft to positive yaw over dt", () => {
    expect(lookDeltaFromKeys({ ArrowLeft: true }, 0.5, 2)).toEqual([1, 0]);
  });

  it("cancels opposing arrows", () => {
    expect(lookDeltaFromKeys({ ArrowLeft: true, ArrowRight: true }, 1, 2)).toEqual([0, 0]);
  });

  it("maps the four arrow codes onto pad directions", () => {
    expect(LOOK_BY_ARROW).toEqual({
      ArrowLeft: "left",
      ArrowRight: "right",
      ArrowUp: "up",
      ArrowDown: "down",
    });
  });
});
