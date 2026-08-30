import {
  ACESFilmicToneMapping,
  Color,
  DirectionalLight,
  HemisphereLight,
  PerspectiveCamera,
  Raycaster,
  Scene,
  SRGBColorSpace,
  Vector2,
  WebGLRenderer,
} from "three";

import type { ArenaEngine } from "../core/arena-engine";
import type { Coordinate } from "../core/coordinates";
import type { CameraPreset } from "../state/ui-store";
import { createArenaGrid } from "./arena-grid";
import { BlockMeshRegistry } from "./block-mesh-registry";
import { applyCameraPreset, createCameraControls } from "./camera-controls";
import { SelectionHighlight } from "./selection-highlight";

export type ArenaRendererOptions = Readonly<{
  onSelect: (coordinate: Coordinate) => void;
}>;

export class ArenaRenderer {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(46, 1, 0.1, 80);
  private readonly controls: ReturnType<typeof createCameraControls>;
  private readonly grid = createArenaGrid();
  private readonly blocks = new BlockMeshRegistry();
  private readonly highlight = new SelectionHighlight();
  private readonly raycaster = new Raycaster();
  private readonly pointer = new Vector2();
  private readonly pointerStart = new Vector2();
  private readonly resizeObserver: ResizeObserver;
  private readonly unsubscribe: () => void;
  private needsRender = true;
  private animationActive = false;

  constructor(
    private readonly container: HTMLElement,
    private readonly engine: ArenaEngine,
    private readonly options: ArenaRendererOptions,
  ) {
    this.renderer = new WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.domElement.className = "arena-canvas";
    this.renderer.domElement.tabIndex = 0;
    this.renderer.domElement.setAttribute("role", "img");
    this.renderer.domElement.setAttribute(
      "aria-label",
      "Interactive three-dimensional Build Arena. Use the coordinate controls for keyboard editing.",
    );
    this.container.append(this.renderer.domElement);

    this.scene.background = new Color(0x0f161c);
    this.scene.add(this.grid.group, this.blocks.group, this.highlight.mesh);
    this.scene.add(new HemisphereLight(0xb9dcff, 0x27313a, 1.35));
    const keyLight = new DirectionalLight(0xffffff, 2.4);
    keyLight.position.set(8, 12, 7);
    this.scene.add(keyLight);

    this.controls = createCameraControls(this.camera, this.renderer.domElement, () => this.invalidate());
    applyCameraPreset(this.camera, this.controls, "iso");

    this.renderer.domElement.addEventListener("pointerdown", this.handlePointerDown);
    this.renderer.domElement.addEventListener("pointerup", this.handlePointerUp);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.container);
    this.unsubscribe = this.engine.subscribe(() => this.refreshBlocks());

    this.refreshBlocks();
    this.resize();
    this.invalidate();
  }

  setCameraPreset(preset: CameraPreset): void {
    applyCameraPreset(this.camera, this.controls, preset);
    this.invalidate();
  }

  setSelectedCoordinate(coordinate: Coordinate | null): void {
    this.highlight.setCoordinate(coordinate);
    this.invalidate();
  }

  dispose(): void {
    this.renderer.setAnimationLoop(null);
    this.animationActive = false;
    this.unsubscribe();
    this.resizeObserver.disconnect();
    this.renderer.domElement.removeEventListener("pointerdown", this.handlePointerDown);
    this.renderer.domElement.removeEventListener("pointerup", this.handlePointerUp);
    this.controls.dispose();
    this.blocks.dispose();
    this.grid.dispose();
    this.highlight.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private readonly handlePointerDown = (event: PointerEvent): void => {
    this.pointerStart.set(event.clientX, event.clientY);
  };

  private readonly handlePointerUp = (event: PointerEvent): void => {
    const deltaX = event.clientX - this.pointerStart.x;
    const deltaY = event.clientY - this.pointerStart.y;
    if ((deltaX * deltaX) + (deltaY * deltaY) > 16) return;
    const bounds = this.renderer.domElement.getBoundingClientRect();
    if (bounds.width === 0 || bounds.height === 0) return;
    this.pointer.set(
      ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
      -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(this.pointer, this.camera);

    const targets = [...this.blocks.raycastTargets, this.grid.platform];
    const intersection = this.raycaster.intersectObjects(targets, false)[0];
    if (!intersection) return;

    const coordinate = intersection.object === this.grid.platform
      ? this.grid.coordinateFor(intersection.instanceId)
      : this.blocks.coordinateFor(intersection.object, intersection.instanceId);
    if (coordinate) this.options.onSelect(coordinate);
  };

  private refreshBlocks(): void {
    this.blocks.update(this.engine.queryBlocks({ limit: 500 }).blocks);
    this.invalidate();
  }

  private resize(): void {
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    this.invalidate();
  }

  private readonly animate = (): void => {
    const controlsChanged = this.controls.update();
    if (this.needsRender || controlsChanged) {
      this.needsRender = false;
      this.renderer.render(this.scene, this.camera);
    }
    if (!this.needsRender && !controlsChanged) {
      this.renderer.setAnimationLoop(null);
      this.animationActive = false;
    }
  };

  private invalidate(): void {
    this.needsRender = true;
    if (this.animationActive) return;
    this.animationActive = true;
    this.renderer.setAnimationLoop(this.animate);
  }
}
