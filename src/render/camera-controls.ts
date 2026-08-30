import { PerspectiveCamera, Vector3 } from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

import type { CameraPreset } from "../state/ui-store";

const CAMERA_TARGET = new Vector3(0, 2, 0);

export function createCameraControls(
  camera: PerspectiveCamera,
  element: HTMLElement,
  onChange: () => void,
): OrbitControls {
  const controls = new OrbitControls(camera, element);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 4;
  controls.maxDistance = 26;
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.target.copy(CAMERA_TARGET);
  controls.addEventListener("change", onChange);
  return controls;
}

export function applyCameraPreset(
  camera: PerspectiveCamera,
  controls: OrbitControls,
  preset: CameraPreset,
  platformSize = 7,
): void {
  const scale = Math.max(1, platformSize / 7);
  controls.maxDistance = Math.max(26, platformSize * 3);
  camera.up.set(0, 1, 0);
  switch (preset) {
    case "top":
      camera.up.set(0, 0, -1);
      camera.position.set(0, 13 * scale, 0.001);
      break;
    case "front":
      camera.position.set(0, 4.5 * scale, 12 * scale);
      break;
    case "right":
      camera.position.set(12 * scale, 4.5 * scale, 0);
      break;
    case "iso":
      camera.position.set(9 * scale, 8 * scale, 9 * scale);
      break;
  }
  controls.target.copy(CAMERA_TARGET);
  controls.update();
}
