import {
  ACESFilmicToneMapping,
  DirectionalLight,
  HemisphereLight,
  InstancedMesh,
  Matrix4,
  PerspectiveCamera,
  Raycaster,
  Scene,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
  type Intersection,
} from "three";

import type { ArenaEngine } from "../core/arena-engine";
import type { Coordinate } from "../core/coordinates";
import type { CameraPreset } from "../state/ui-store";
import { createArenaGrid } from "./arena-grid";
import { createArenaSkyTexture } from "./arena-sky";
import { BlockMeshRegistry } from "./block-mesh-registry";
import { applyCameraPreset, createCameraControls } from "./camera-controls";
import { SelectionHighlight } from "./selection-highlight";

export type ArenaRendererOptions = Readonly<{
  /** Agent / WebMCP. Pointer clicks never call this. */
  onEdit: (coordinate: Coordinate) => void;
  onInspect: (coordinate: Coordinate) => void;

  /** Human. Pointer clicks call this. */
  onPlace: (coordinate: Coordinate) => void;
  onRemove: (coordinate: Coordinate) => void;
  onSelect: (coordinate: Coordinate) => void;
}>;

type CellHit = Readonly<{
  hit: Coordinate;
  place: Coordinate;
}>;

type LastLeftClick = Readonly<{
  at: number;
  hit: Coordinate;
  placed: Coordinate;
}>;

const DOUBLE_CLICK_MS = 280;
const _normal = new Vector3();
const _instanceMatrix = new Matrix4();

export class ArenaRenderer {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(46, 1, 0.1, 80);
  private readonly controls: ReturnType<typeof createCameraControls>;
  private readonly grid = createArenaGrid();
  private readonly sky = createArenaSkyTexture();
  private readonly blocks = new BlockMeshRegistry();
  private readonly highlight = new SelectionHighlight();
  private readonly raycaster = new Raycaster();
  private readonly pointer = new Vector2();
  private readonly pointerStart = new Vector2();
  private readonly resizeObserver: ResizeObserver;
  private readonly unsubscribe: () => void;
  private needsRender = true;
  private animationActive = false;
  private lastLeftClick: LastLeftClick | null = null;

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
      "Interactive three-dimensional Build Arena. Left-click places, including on top of a block. Double-click removes. Right-click selects.",
    );
    this.container.append(this.renderer.domElement);

    this.scene.background = this.sky;
    this.scene.add(this.grid.group, this.blocks.group, this.highlight.mesh);
    this.scene.add(new HemisphereLight(0x78a7ff, 0x5d9c46, 1.2));
    const keyLight = new DirectionalLight(0xffffff, 2.4);
    keyLight.position.set(8, 12, 7);
    this.scene.add(keyLight);

    this.controls = createCameraControls(this.camera, this.renderer.domElement, () => this.invalidate());
    applyCameraPreset(this.camera, this.controls, "iso");

    this.renderer.domElement.addEventListener("pointerdown", this.handlePointerDown);
    this.renderer.domElement.addEventListener("pointerup", this.handlePointerUp);
    this.renderer.domElement.addEventListener("contextmenu", this.handleContextMenu);
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
    this.lastLeftClick = null;
    this.unsubscribe();
    this.resizeObserver.disconnect();
    this.renderer.domElement.removeEventListener("pointerdown", this.handlePointerDown);
    this.renderer.domElement.removeEventListener("pointerup", this.handlePointerUp);
    this.renderer.domElement.removeEventListener("contextmenu", this.handleContextMenu);
    this.controls.dispose();
    this.blocks.dispose();
    this.grid.dispose();
    this.sky.dispose();
    this.highlight.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private readonly handleContextMenu = (event: MouseEvent): void => {
    event.preventDefault();
  };

  private readonly handlePointerDown = (event: PointerEvent): void => {
    this.pointerStart.set(event.clientX, event.clientY);
  };

  private readonly handlePointerUp = (event: PointerEvent): void => {
    if (event.button !== 0 && event.button !== 2) return;
    const deltaX = event.clientX - this.pointerStart.x;
    const deltaY = event.clientY - this.pointerStart.y;
    if ((deltaX * deltaX) + (deltaY * deltaY) > 16) return;
    const cell = this.cellAt(event);
    if (!cell) return;
    if (event.button === 2) {
      this.lastLeftClick = null;
      this.options.onSelect(cell.hit);
      return;
    }

    const now = performance.now();
    const previous = this.lastLeftClick;
    if (previous && now - previous.at < DOUBLE_CLICK_MS && sameCell(previous.hit, cell.hit)) {
      this.lastLeftClick = null;
      this.options.onRemove(cell.hit);
      if (!sameCell(previous.placed, cell.hit)) this.options.onRemove(previous.placed);
      return;
    }

    this.options.onPlace(cell.place);
    this.lastLeftClick = { at: now, hit: cell.hit, placed: cell.place };
  };

  private cellAt(event: PointerEvent): CellHit | null {
    const bounds = this.renderer.domElement.getBoundingClientRect();
    if (bounds.width === 0 || bounds.height === 0) return null;
    this.pointer.set(
      ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
      -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(this.pointer, this.camera);

    const targets = [...this.blocks.raycastTargets, this.grid.platform];
    const intersection = this.raycaster.intersectObjects(targets, false)[0];
    if (!intersection) return null;

    if (intersection.object === this.grid.platform) {
      const hit = this.grid.coordinateFor(intersection.instanceId);
      return hit ? { hit, place: hit } : null;
    }

    const hit = this.blocks.coordinateFor(intersection.object, intersection.instanceId);
    if (!hit) return null;
    return { hit, place: adjacentCell(hit, intersection) };
  }

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

function adjacentCell(hit: Coordinate, intersection: Intersection): Coordinate {
  const face = intersection.face;
  if (!face) return { x: hit.x, y: hit.y + 1, z: hit.z };

  _normal.copy(face.normal);
  const object = intersection.object;
  if (object instanceof InstancedMesh && intersection.instanceId !== undefined) {
    object.getMatrixAt(intersection.instanceId, _instanceMatrix);
    _normal.transformDirection(_instanceMatrix);
  } else {
    _normal.transformDirection(object.matrixWorld);
  }

  const absX = Math.abs(_normal.x);
  const absY = Math.abs(_normal.y);
  const absZ = Math.abs(_normal.z);
  const offset = { x: 0, y: 0, z: 0 };
  if (absY >= absX && absY >= absZ) offset.y = _normal.y >= 0 ? 1 : -1;
  else if (absX >= absZ) offset.x = _normal.x >= 0 ? 1 : -1;
  else offset.z = _normal.z >= 0 ? 1 : -1;

  return { x: hit.x + offset.x, y: hit.y + offset.y, z: hit.z + offset.z };
}

function sameCell(a: Coordinate, b: Coordinate): boolean {
  return a.x === b.x && a.y === b.y && a.z === b.z;
}
