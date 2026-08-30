import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { ArenaEngine, ArenaResult, BuildSummary } from "../core/arena-engine";
import { createArenaConfig, MAX_BUILD_HEIGHT, MAX_PLATFORM_SIZE } from "../core/arena-config";
import { createBlueprint, diffBlueprintBlocks } from "../core/blueprint";
import type { Coordinate } from "../core/coordinates";
import { createArenaEngine } from "../core/arena-world";
import { ArenaRenderer } from "../render/three-renderer";
import { type CameraPreset, type SidebarPanel, useUiStore } from "../state/ui-store";
import {
  downloadBlueprintJson,
  parseBlueprintJson,
  serializeBlueprintJson,
} from "../storage/blueprint-json";
import { BlockPalette } from "./BlockPalette";

type ActivityActor = "you" | "agent";

type ActivityEntry = Readonly<{
  id: number;
  time: string;
  actor: ActivityActor;
  name: string;
  success: boolean;
  revision: number;
  payload: string;
}>;

const CAMERA_PRESETS: readonly CameraPreset[] = ["iso", "top", "front", "right"];
const SIDEBAR_PANELS: readonly SidebarPanel[] = ["layers", "activity", "slider"];

export function BuildArenaPage() {
  const [engine] = useState(() => createArenaEngine(createArenaConfig(51, 31)));
  const [summary, setSummary] = useState<BuildSummary>(() => engine.getSummary());
  const [activity, setActivity] = useState<readonly ActivityEntry[]>(() => [
    {
      id: 0,
      time: clock(),
      actor: "you",
      name: "arena.ready",
      success: true,
      revision: 0,
      payload: "{}",
    },
  ]);
  const [jsonDraft, setJsonDraft] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("Click place \ndouble-click select\nRight-click remove");
  const nextActivityId = useRef(1);
  const rendererHost = useRef<HTMLDivElement>(null);
  const rendererInstance = useRef<ArenaRenderer | null>(null);

  const selectedBlock = useUiStore((state) => state.selectedBlock);
  const selectedCoordinate = useUiStore((state) => state.selectedCoordinate);
  const cameraPreset = useUiStore((state) => state.cameraPreset);
  const sidebarCollapsed = useUiStore((state) => state.sidebarCollapsed);
  const activeSidebarPanel = useUiStore((state) => state.activeSidebarPanel);
  const jsonMode = useUiStore((state) => state.jsonMode);
  const platformSize = useUiStore((state) => state.platformSize);
  const buildHeight = useUiStore((state) => state.buildHeight);
  const setSelectedBlock = useUiStore((state) => state.setSelectedBlock);
  const setActiveSidebarPanel = useUiStore((state) => state.setActiveSidebarPanel);
  const setJsonMode = useUiStore((state) => state.setJsonMode);
  const setPlatformSize = useUiStore((state) => state.setPlatformSize);
  const setBuildHeight = useUiStore((state) => state.setBuildHeight);
  const setCameraPreset = useUiStore((state) => state.setCameraPreset);

  const addActivity = useCallback((entry: Omit<ActivityEntry, "id" | "time">) => {
    const next = { id: nextActivityId.current, time: clock(), ...entry };
    nextActivityId.current += 1;
    setActivity((current) => [next, ...current].slice(0, 40));
  }, []);

  useEffect(() => engine.subscribe((change) => {
    setSummary(engine.getSummary());
    addActivity({
      actor: "you",
      name: change.commandType,
      success: true,
      revision: change.revision,
      payload: JSON.stringify({
        affectedBlocks: change.affectedBlocks,
        undoId: change.undoId,
      }),
    });
  }), [addActivity, engine]);

  const inspectCell = useCallback((coordinate: Coordinate) => {
    useUiStore.getState().setSelectedCoordinate(coordinate);
    const occupant = blockAt(engine, coordinate);
    setStatusMessage(`${formatCoord(coordinate)} — ${occupant ?? "empty"}`);
  }, [engine]);

  const placeCell = useCallback((coordinate: Coordinate) => {
    const block = useUiStore.getState().selectedBlock;
    const result = engine.apply({
      type: "set_blocks",
      expectedRevision: engine.getContext().revision,
      edits: [{ action: "place", position: coordinate, block }],
    });
    setSummary(engine.getSummary());
    if (result.success) {
      setStatusMessage(formatCoord(coordinate));
      if (result.affectedBlocks === 0) {
        addActivity({
          actor: "you",
          name: "place",
          success: true,
          revision: result.revision,
          payload: JSON.stringify({ position: coordinate, block }),
        });
      }
      return;
    }
    setStatusMessage(result.error);
    addActivity({
      actor: "you",
      name: "place",
      success: false,
      revision: result.revision,
      payload: JSON.stringify({ error: result.error, fieldPath: result.fieldPath }),
    });
  }, [addActivity, engine]);

  const removeCell = useCallback((coordinate: Coordinate) => {
    const result = engine.apply({
      type: "set_blocks",
      expectedRevision: engine.getContext().revision,
      edits: [{ action: "remove", position: coordinate }],
    });
    setSummary(engine.getSummary());
    if (result.success) {
      setStatusMessage(formatCoord(coordinate));
      if (result.affectedBlocks === 0) {
        addActivity({
          actor: "you",
          name: "remove",
          success: true,
          revision: result.revision,
          payload: JSON.stringify({ position: coordinate }),
        });
      }
      return;
    }
    setStatusMessage(result.error);
    addActivity({
      actor: "you",
      name: "remove",
      success: false,
      revision: result.revision,
      payload: JSON.stringify({ error: result.error, fieldPath: result.fieldPath }),
    });
  }, [addActivity, engine]);

  useEffect(() => {
    const host = rendererHost.current;
    if (!host) return;
    const arenaRenderer = new ArenaRenderer(host, engine, {
      // Agent / WebMCP stubs. Clicks use onPlace / onRemove / onSelect.
      onEdit: (coordinate) => placeCell(coordinate),
      onInspect: (coordinate) => inspectCell(coordinate),
      onPlace: (coordinate) => placeCell(coordinate),
      onRemove: (coordinate) => removeCell(coordinate),
      onSelect: (coordinate) => inspectCell(coordinate),
    });
    rendererInstance.current = arenaRenderer;
    arenaRenderer.setCameraPreset(useUiStore.getState().cameraPreset);
    arenaRenderer.setSelectedCoordinate(useUiStore.getState().selectedCoordinate);
    return () => {
      rendererInstance.current = null;
      arenaRenderer.dispose();
    };
  }, [engine]);

  useEffect(() => rendererInstance.current?.setCameraPreset(cameraPreset), [cameraPreset]);
  useEffect(
    () => rendererInstance.current?.setSelectedCoordinate(selectedCoordinate),
    [selectedCoordinate],
  );

  const currentBlocks = useMemo(
    () => engine.snapshotBlocks(),
    [engine, summary.revision],
  );
  const blueprint = createBlueprint(currentBlocks, { id: "arena-build", name: "Arena Build" });
  const blueprintText = serializeBlueprintJson(blueprint);

  useEffect(() => {
    if (!jsonMode) {
      setJsonDraft(blueprintText);
      setJsonError(null);
    }
  }, [blueprintText, jsonMode]);

  const handleResult = (result: ArenaResult, name: string, payload: string) => {
    setSummary(engine.getSummary());
    if (result.success) {
      if (result.affectedBlocks === 0) {
        addActivity({ actor: "you", name, success: true, revision: result.revision, payload });
      }
      return;
    }
    addActivity({
      actor: "you",
      name,
      success: false,
      revision: result.revision,
      payload: JSON.stringify({ error: result.error, fieldPath: result.fieldPath }),
    });
  };

  const applyHistory = (type: "undo" | "redo") => {
    const result = engine.apply({ type, expectedRevision: engine.getContext().revision });
    handleResult(result, type, "{}");
  };

  const resizePlatform = (nextSize: number) => {
    const result = engine.resizePlatform(nextSize);
    if (!result.success) {
      handleResult(result, "platform.resize", JSON.stringify({ size: nextSize }));
      return;
    }
    setPlatformSize(nextSize);
    const selected = useUiStore.getState().selectedCoordinate;
    if (selected && !isInsideArena(selected, engine)) {
      useUiStore.getState().setSelectedCoordinate(null);
    }
  };

  const resizeHeight = (nextHeight: number) => {
    const result = engine.resizeHeight(nextHeight);
    if (!result.success) {
      handleResult(result, "height.resize", JSON.stringify({ height: nextHeight }));
      return;
    }
    setBuildHeight(nextHeight);
    const selected = useUiStore.getState().selectedCoordinate;
    if (selected && !isInsideArena(selected, engine)) {
      useUiStore.getState().setSelectedCoordinate(null);
    }
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;
      if (event.key === "]") {
        event.preventDefault();
        const store = useUiStore.getState();
        store.setSidebarCollapsed(!store.sidebarCollapsed);
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        applyHistory(event.shiftKey ? "redo" : "undo");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [engine]);

  const exportBlueprint = () => {
    try {
      downloadBlueprintJson(blueprint);
      addActivity({
        actor: "you",
        name: "export",
        success: true,
        revision: summary.revision,
        payload: JSON.stringify({ bytes: blueprintText.length }),
      });
    } catch (error) {
      addActivity({
        actor: "you",
        name: "export",
        success: false,
        revision: summary.revision,
        payload: JSON.stringify({ error: error instanceof Error ? error.message : "Download unavailable" }),
      });
    }
  };

  const validateAndApplyJson = () => {
    const parsed = parseBlueprintJson(jsonDraft, engine.getContext().bounds);
    if (!parsed.success) {
      setJsonError(parsed.error);
      addActivity({
        actor: "you",
        name: "json.validate",
        success: false,
        revision: summary.revision,
        payload: JSON.stringify({ error: parsed.error }),
      });
      return;
    }
    setJsonError(null);
    const edits = diffBlueprintBlocks(currentBlocks, parsed.blueprint.blocks);
    const maxBatchEdits = engine.getContext().limits.maxBatchEdits;
    if (edits.length > maxBatchEdits) {
      const error = `Blueprint needs ${edits.length} edits; the maximum is ${maxBatchEdits}`;
      setJsonError(error);
      addActivity({
        actor: "you",
        name: "json.validate",
        success: false,
        revision: summary.revision,
        payload: JSON.stringify({ error }),
      });
      return;
    }
    const result = engine.apply({
      type: "set_blocks",
      expectedRevision: engine.getContext().revision,
      edits,
    });
    handleResult(result, "json.apply", JSON.stringify({ edits: edits.length }));
    if (result.success) useUiStore.getState().setJsonMode(false);
  };

  const toggleSidebar = () => {
    const store = useUiStore.getState();
    store.setSidebarCollapsed(!store.sidebarCollapsed);
  };

  return (
    <div className="arena-app-shell">
      <a className="skip-link" href="#arena-workspace">Skip to Build Arena</a>
      <h1 className="sr-only">Build Arena</h1>

      <header className="arena-topbar">
        <nav className="product-tabs" aria-label="Workspace">
          <button disabled title="Game tab comes after the arena" type="button">Minecraft</button>
          <button aria-current="page" type="button">Build Arena</button>
        </nav>
        <div className="topbar-actions">
          <button className="export-button" onClick={exportBlueprint} type="button">Export</button>
          <button aria-label="Undo" className="icon-button" data-flip="true" onClick={() => applyHistory("undo")} title="Undo" type="button">
            <RedoIcon />
          </button>
          <button aria-label="Redo" className="icon-button" onClick={() => applyHistory("redo")} title="Redo" type="button">
            <RedoIcon />
          </button>
          <button
            aria-controls="arena-editor-sidebar"
            aria-expanded={!sidebarCollapsed}
            aria-keyshortcuts="]"
            aria-label={sidebarCollapsed ? "Expand editor sidebar" : "Collapse editor sidebar"}
            className="icon-button sidebar-toggle"
            onClick={toggleSidebar}
            title={sidebarCollapsed ? "Show sidebar" : "Hide sidebar"}
            type="button"
          >
            <SidebarToggleIcon />
          </button>
        </div>
      </header>

      <main
        className="arena-workspace"
        data-sidebar-collapsed={sidebarCollapsed}
        id="arena-workspace"
        tabIndex={-1}
      >
        <section className="arena-stage" aria-labelledby="viewport-title">
          <h2 className="sr-only" id="viewport-title">Three-dimensional arena viewport</h2>
          <div className="camera-toolbar" aria-label="Camera views">
            {CAMERA_PRESETS.map((preset) => (
              <button
                aria-pressed={cameraPreset === preset}
                key={preset}
                onClick={() => setCameraPreset(preset)}
                type="button"
              >
                {preset === "iso" ? "Isometric" : capitalize(preset)}
              </button>
            ))}
          </div>
          <div className="renderer-host" ref={rendererHost} />
          <div className="viewport-status" role="status" aria-live="polite">
            <strong>{statusMessage}</strong>
          </div>
          <BlockPalette selectedBlock={selectedBlock} onSelect={setSelectedBlock} />
        </section>

        <aside
          className="arena-sidebar"
          data-collapsed={sidebarCollapsed}
          hidden={sidebarCollapsed}
          id="arena-editor-sidebar"
        >
          {jsonMode ? (
            <section className="json-editor" aria-labelledby="json-editor-title">
              <div className="json-editor-toolbar">
                <div>
                  <h2 id="json-editor-title">JSON editor</h2>
                </div>
                <div className="json-editor-actions">
                  <button onClick={validateAndApplyJson} type="button">Validate and apply</button>
                  <button className="text-button" onClick={() => setJsonMode(false)} type="button">Back</button>
                </div>
              </div>
              <p className="control-hint">Invalid JSON never applies. Valid apply uses the current revision.</p>
              {jsonError && <p className="json-error" role="alert">{jsonError}</p>}
              <textarea
                aria-label="Blueprint JSON"
                onChange={(event) => setJsonDraft(event.target.value)}
                spellCheck={false}
                value={jsonDraft}
              />
            </section>
          ) : (
            <div className="sidebar-shell">
              <nav className="sidebar-tabs" aria-label="Editor panels">
                {SIDEBAR_PANELS.map((panel) => (
                  <button
                    aria-pressed={activeSidebarPanel === panel}
                    key={panel}
                    onClick={() => setActiveSidebarPanel(panel)}
                    type="button"
                  >
                    {capitalize(panel)}
                  </button>
                ))}
              </nav>

              <div className="sidebar-panel">
                {activeSidebarPanel === "layers" && (
                  <section aria-labelledby="layers-title">
                    <h3 id="layers-title">Layers</h3>
                    <p className="empty-state">No layers yet</p>
                  </section>
                )}

                {activeSidebarPanel === "activity" && (
                  <div className="split-stack" aria-label="Activity and JSON">
                    <ActivityList activity={activity} titleId="activity-feed-title" title="Agent activity" />
                    <JsonPane
                      text={blueprintText}
                      titleId="activity-json-title"
                      onEdit={() => {
                        setJsonDraft(blueprintText);
                        setJsonMode(true);
                      }}
                    />
                  </div>
                )}

                {activeSidebarPanel === "slider" && (
                  <section aria-label="Arena dimensions" className="slider-stack">
                    <OddSlider
                      ariaLabel="Platform width"
                      max={MAX_PLATFORM_SIZE}
                      min={7}
                      onChange={resizePlatform}
                      value={platformSize}
                    />
                    <OddSlider
                      ariaLabel="Build height"
                      max={MAX_BUILD_HEIGHT}
                      min={7}
                      onChange={resizeHeight}
                      value={buildHeight}
                    />
                  </section>
                )}
              </div>
            </div>
          )}
        </aside>
      </main>
    </div>
  );
}

function ActivityList({
  activity,
  title,
  titleId,
}: {
  activity: readonly ActivityEntry[];
  title: string;
  titleId: string;
}) {
  return (
    <section className="activity-pane" aria-labelledby={titleId}>
      <h3 id={titleId}>{title}</h3>
      <ol className="activity-list">
        {activity.map((entry) => (
          <li data-failed={entry.success ? undefined : "true"} key={`${titleId}-${entry.id}`}>
            <div className="activity-meta">
              <time>{entry.time}</time>
              <span>{entry.actor}</span>
              <strong>{entry.name}</strong>
              <span data-ok={entry.success}>{entry.success ? "ok" : "fail"}</span>
              <span>r{entry.revision}</span>
            </div>
            <details>
              <summary>JSON payload</summary>
              <pre>{entry.payload}</pre>
            </details>
          </li>
        ))}
      </ol>
    </section>
  );
}

function JsonPane({
  text,
  onEdit,
  titleId,
}: {
  text: string;
  onEdit: () => void;
  titleId: string;
}) {
  return (
    <section className="json-pane" aria-labelledby={titleId}>
      <div className="section-heading-row">
        <h3 id={titleId}>JSON</h3>
        <button className="text-button" onClick={onEdit} type="button">Edit</button>
      </div>
      <pre className="json-preview">{text}</pre>
    </section>
  );
}

function OddSlider({
  ariaLabel,
  max,
  min,
  value,
  onChange,
}: {
  ariaLabel: string;
  max: number;
  min: number;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <input
      aria-label={ariaLabel}
      className="odd-slider"
      max={max}
      min={min}
      onChange={(event) => onChange(Number(event.target.value))}
      step={2}
      type="range"
      value={value}
    />
  );
}

function SidebarToggleIcon() {
  return (
    <svg aria-hidden="true" fill="none" focusable="false" viewBox="0 0 24 24">
      <rect height="17" rx="4.25" stroke="currentColor" strokeWidth="1.75" width="17" x="3.5" y="3.5" />
      <path d="M15.75 3.5v17" stroke="currentColor" strokeLinecap="round" strokeWidth="1.75" />
    </svg>
  );
}

function RedoIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
      <polygon
        fill="currentColor"
        points="20,6 20,5 19,5 19,4 18,4 18,3 8,3 8,4 7,4 7,5 6,5 6,6 5,6 5,5 5,4 3,4 3,10 9,10 9,8 7,8 7,7 8,7 8,6 9,6 9,5 16,5 16,6 17,6 17,7 18,7 18,8 19,8 19,16 18,16 18,17 17,17 17,18 16,18 16,19 9,19 9,18 8,18 8,17 7,17 7,16 6,16 6,15 4,15 4,18 5,18 5,19 6,19 6,20 7,20 7,21 18,21 18,20 19,20 19,19 20,19 20,18 21,18 21,6"
      />
    </svg>
  );
}

function capitalize(value: string): string {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

function clock(): string {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function isTypingTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && Boolean(target.closest("input, textarea, select, [contenteditable=true]"));
}

function formatCoord(coordinate: Coordinate): string {
  return `(${coordinate.x}, ${coordinate.y}, ${coordinate.z})`;
}

function blockAt(engine: ArenaEngine, coordinate: Coordinate) {
  return engine.queryBlocks({
    region: { min: coordinate, max: coordinate },
    limit: 1,
  }).blocks[0]?.block ?? null;
}

function isInsideArena(coordinate: Coordinate, engine: ArenaEngine): boolean {
  const bounds = engine.getContext().bounds;
  return coordinate.x >= bounds.minX && coordinate.x <= bounds.maxX &&
    coordinate.y >= bounds.minY && coordinate.y <= bounds.maxY &&
    coordinate.z >= bounds.minZ && coordinate.z <= bounds.maxZ;
}
