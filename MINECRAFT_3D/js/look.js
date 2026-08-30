import * as THREE from "../vendor/three.module.js";

const euler = new THREE.Euler(0, 0, 0, "YXZ");
const PITCH_LIMIT = Math.PI / 2;

export const LOOK_SPEED = 1.6;

export const LOOK_BY_ARROW = {
  ArrowLeft: "left",
  ArrowRight: "right",
  ArrowUp: "up",
  ArrowDown: "down",
};

export function applyLookDelta(camera, yawDelta, pitchDelta) {
  euler.setFromQuaternion(camera.quaternion);
  euler.y += yawDelta;
  euler.x = THREE.MathUtils.clamp(euler.x + pitchDelta, -PITCH_LIMIT, PITCH_LIMIT);
  camera.quaternion.setFromEuler(euler);
}

export function lookDeltaFromKeys(keys, dt, speed = LOOK_SPEED) {
  const yaw = ((keys.ArrowLeft ? 1 : 0) - (keys.ArrowRight ? 1 : 0)) * speed * dt;
  const pitch = ((keys.ArrowUp ? 1 : 0) - (keys.ArrowDown ? 1 : 0)) * speed * dt;
  return [yaw, pitch];
}
