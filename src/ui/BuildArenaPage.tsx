import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import exportIcon from "../assets/svg/export.svg";
import importIcon from "../assets/svg/import.svg";
import inventoryIcon from "../assets/svg/inventory.svg";
import questionMarkIcon from "../assets/svg/question-mark.svg";
import clearIcon from "../assets/svg/clear.svg";
import type { ArenaEngine, ArenaResult, BuildSummary } from "../core/arena-engine";
import { createArenaConfig, MAX_BUILD_HEIGHT, MAX_PLATFORM_SIZE } from "../core/arena-config";
import { createBlueprint, diffBlueprintBlocks } from "../core/blueprint";
import { defaultStateFor, rotateFacing, type BlockId, type BlockState } from "../core/block-types";
import type { Coordinate } from "../core/coordinates";
import { createArenaEngine } from "../core/arena-world";
import { ArenaRenderer } from "../render/three-renderer";
import { createManualEditLock } from "../webmcp/manual-edit-lock";
import { registerArenaTools } from "../webmcp/register-arena-tools";
import { type CameraPreset, type SidebarPanel, useUiStore } from "../state/ui-store";
import {
  downloadBlueprintJson,
  parseBlueprintJson,
  serializeBlueprintJson,
} from "../storage/blueprint-json";
import {
  addEntry,
  readInventory,
  removeEntry,
  toArenaBlocks,
  toRelativeBlocks,
  writeHandoff,
} from "../storage/inventory";
import { BlockPalette } from "./BlockPalette";
import { InventoryOverlay } from "./InventoryOverlay";
import { SpaceLoadOverlay } from "./SpaceLoadOverlay";

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
  const [manualEditLock] = useState(() => createManualEditLock());
  const [manualEditLockState, setManualEditLockState] = useState(() => manualEditLock.getSnapshot());
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
  const [statusMessage, setStatusMessage] = useState("");
  const [spaceReady, setSpaceReady] = useState(false);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [controlsHelpOpen, setControlsHelpOpen] = useState(false);
  const [inventoryEntries, setInventoryEntries] = useState(() => readInventory().entries);
  const nextActivityId = useRef(1);
  const importInput = useRef<HTMLInputElement>(null);
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

  useEffect(() => engine.subscribe(() => {
    setSummary(engine.getSummary());
  }), [engine]);

  useEffect(() => manualEditLock.subscribe((snapshot) => {
    setManualEditLockState(snapshot);
    setStatusMessage(snapshot.locked ? "Agent is editing the arena" : "Manual editing unlocked");
  }), [manualEditLock]);

  useEffect(() => () => manualEditLock.dispose(), [manualEditLock]);

  const blockLockedManualWrite = useCallback(() => {
    if (!manualEditLock.getSnapshot().locked) return false;
    setStatusMessage("Agent is editing. Use Unlock in the top bar to take control.");
    return true;
  }, [manualEditLock]);

  const inspectCell = useCallback((coordinate: Coordinate) => {
    useUiStore.getState().setSelectedCoordinate(coordinate);
    const occupant = blockAt(engine, coordinate);
    setStatusMessage(`${formatCoord(coordinate)} — ${occupant ?? "empty"}`);
  }, [engine]);

  const placeCell = useCallback((coordinate: Coordinate) => {
    if (blockLockedManualWrite()) return;
    const block = useUiStore.getState().selectedBlock;
    const state = defaultStateFor(block);
    const result = engine.apply({
      type: "set_blocks",
      expectedRevision: engine.getContext().revision,
      edits: [{ action: "place", position: coordinate, block, ...(state ? { state } : {}) }],
    });
    setSummary(engine.getSummary());
    addActivity({
      actor: "you",
      name: "place",
      success: result.success,
      revision: result.revision,
      payload: result.success
        ? JSON.stringify({ position: coordinate, block })
        : JSON.stringify({ error: result.error, fieldPath: result.fieldPath }),
    });
    if (result.success) setStatusMessage(formatCoord(coordinate));
    else setStatusMessage(result.error);
  }, [addActivity, blockLockedManualWrite, engine]);

  const removeCell = useCallback((coordinate: Coordinate) => {
    if (blockLockedManualWrite()) return;
    const result = engine.apply({
      type: "set_blocks",
      expectedRevision: engine.getContext().revision,
      edits: [{ action: "remove", position: coordinate }],
    });
    setSummary(engine.getSummary());
    addActivity({
      actor: "you",
      name: "remove",
      success: result.success,
      revision: result.revision,
      payload: result.success
        ? JSON.stringify({ position: coordinate })
        : JSON.stringify({ error: result.error, fieldPath: result.fieldPath }),
    });
    if (result.success) setStatusMessage(formatCoord(coordinate));
    else setStatusMessage(result.error);
  }, [addActivity, blockLockedManualWrite, engine]);

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
      onFirstFrame: () => setSpaceReady(true),
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

  // WebMCP lifecycle: register once while mounted; aborting removes every
  // page-scoped registration. Unsupported browsers keep the full human editor.
  useEffect(() => {
    const controller = new AbortController();
    void registerArenaTools(engine, {
      signal: controller.signal,
      onRegistrationError: () => {
        if (!controller.signal.aborted) setStatusMessage("Agent tools unavailable. Reload to retry.");
      },
      hooks: {
        manualEditLock,
        onToolCall: (name, success, revision, payload) =>
          addActivity({ actor: "agent", name, success, revision, payload }),
        onRenderView: (view) => useUiStore.getState().setCameraPreset(view),
      },
    });
    return () => controller.abort();
  }, [addActivity, engine, manualEditLock]);

  const currentBlocks = useMemo(
    () => engine.snapshotBlocks(),
    [engine, summary.revision],
  );
  const objectGroups = summary.objectGroups;
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
    addActivity({
      actor: "you",
      name,
      success: result.success,
      revision: result.revision,
      payload: result.success
        ? payload
        : JSON.stringify({ error: result.error, fieldPath: result.fieldPath }),
    });
  };

  const applyHistory = (type: "undo" | "redo") => {
    if (blockLockedManualWrite()) return;
    const result = engine.apply({ type, expectedRevision: engine.getContext().revision });
    handleResult(result, type, "{}");
  };

  const clearPlatform = () => {
    if (blockLockedManualWrite()) return;
    const result = engine.apply({
      type: "clear_blocks",
      expectedRevision: engine.getContext().revision,
    });
    handleResult(
      result,
      "clear",
      JSON.stringify({ removed: result.success ? result.affectedBlocks : 0 }),
    );
    if (!result.success) {
      setStatusMessage(result.error);
      return;
    }
    useUiStore.getState().setSelectedCoordinate(null);
    setStatusMessage(
      result.affectedBlocks === 0 ? "Nothing to clear" : `Cleared ${result.affectedBlocks} blocks`,
    );
  };

  const applyReplace = (position: Coordinate, block: BlockId, state: BlockState) => {
    if (blockLockedManualWrite()) return;
    const result = engine.apply({
      type: "set_blocks",
      expectedRevision: engine.getContext().revision,
      edits: [{ action: "replace", position, block, state }],
    });
    handleResult(result, "rotate", JSON.stringify({ position, block, state }));
  };

  const saveToInventory = () => {
    const blocks = engine.snapshotBlocks();
    if (blocks.length === 0) {
      setStatusMessage("Nothing to save");
      return;
    }
    const result = addEntry({
      name: `Build ${readInventory().entries.length + 1}`,
      platformSize,
      buildHeight,
      thumbnail: rendererInstance.current?.captureThumbnail() ?? "",
      blocks: toRelativeBlocks(blocks),
    });
    if (!result.ok) {
      setStatusMessage(result.error);
      return;
    }
    setInventoryEntries(readInventory().entries);
    setStatusMessage(`Saved ${result.entry.name}`);
  };

  const goToPlaySpace = (kind: "visit" | "place") => {
    const blocks = engine.snapshotBlocks();
    const handoff = kind === "place" && blocks.length > 0
      ? { kind: "place" as const, platformSize, buildHeight, blocks: toArenaBlocks(blocks) }
      : { kind: "visit" as const, platformSize, buildHeight };
    const written = writeHandoff(handoff);
    if (!written.ok) {
      setStatusMessage(written.error);
      return;
    }
    window.location.assign("/MINECRAFT_3D/index.html");
  };

  const resizePlatform = (nextSize: number) => {
    if (blockLockedManualWrite()) return;
    const result = engine.resizePlatform(nextSize);
    handleResult(result, "platform.resize", JSON.stringify({ size: nextSize }));
    if (!result.success) return;
    setPlatformSize(nextSize);
    const selected = useUiStore.getState().selectedCoordinate;
    if (selected && !isInsideArena(selected, engine)) {
      useUiStore.getState().setSelectedCoordinate(null);
    }
  };

  const resizeHeight = (nextHeight: number) => {
    if (blockLockedManualWrite()) return;
    const result = engine.resizeHeight(nextHeight);
    handleResult(result, "height.resize", JSON.stringify({ height: nextHeight }));
    if (!result.success) return;
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
        return;
      }
      const selected = useUiStore.getState().selectedCoordinate;
      if (!selected) return;
      const cell = cellAt(engine, selected);
      if (!cell) return;
      if (event.key.toLowerCase() === "r" && (cell.block === "repeater" || cell.block === "comparator")) {
        event.preventDefault();
        const facing = rotateFacing(cell.state?.facing ?? "east", 1);
        const state = cell.block === "comparator"
          ? { facing, mode: cell.state?.mode === "subtract" ? "subtract" as const : "compare" as const }
          : { facing };
        applyReplace(selected, cell.block, state);
        return;
      }
      if (event.key.toLowerCase() === "m" && cell.block === "comparator") {
        event.preventDefault();
        const facing = cell.state?.facing ?? "east";
        const mode = cell.state?.mode === "subtract" ? "compare" as const : "subtract" as const;
        applyReplace(selected, cell.block, { facing, mode });
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
    if (blockLockedManualWrite()) return;
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

  const importBlueprint = async (file: File | undefined) => {
    if (!file) return;

    try {
      setJsonDraft(await file.text());
      setJsonError(null);
      useUiStore.getState().setJsonMode(true);
      setStatusMessage("Blueprint loaded. Review and validate it before applying.");
    } catch {
      setStatusMessage("Could not read the blueprint file.");
    }
  };

  const toggleSidebar = () => {
    const store = useUiStore.getState();
    store.setSidebarCollapsed(!store.sidebarCollapsed);
  };

  return (
    <div className="arena-app-shell">
      <SpaceLoadOverlay spaceReady={spaceReady} />
      <a className="skip-link" href="#arena-workspace">Skip to Build Arena</a>
      <h1 className="sr-only">Build Arena</h1>

      <header className="arena-topbar">
        <nav className="product-tabs" aria-label="Workspace">
          <button onClick={() => goToPlaySpace("visit")} title="Opens 3d world" type="button">Minecraft</button>
          <button aria-current="page" type="button">Build Arena</button>
        </nav>
        <div className="topbar-actions">
          {manualEditLockState.locked && (
            <button
              className="agent-lock-button"
              onClick={() => manualEditLock.setLocked(false)}
              type="button"
            >
              Agent editing · Unlock
            </button>
          )}
          <button
            aria-label="Import blueprint"
            className="icon-button"
            data-tooltip="Import"
            onClick={() => importInput.current?.click()}
            type="button"
          >
            <img alt="" src={importIcon} />
          </button>
          <input
            accept=".json,.build-arena.json,application/json"
            className="sr-only"
            onChange={(event) => {
              void importBlueprint(event.currentTarget.files?.[0]);
              event.currentTarget.value = "";
            }}
            ref={importInput}
            type="file"
          />
          <button aria-label="Export blueprint" className="icon-button" data-tooltip="Export" onClick={exportBlueprint} type="button">
            <img alt="" src={exportIcon} />
          </button>
          <button aria-label="Add to inventory" className="icon-button" data-tooltip="Inventory" onClick={saveToInventory} type="button">
            <img alt="" src={inventoryIcon} />
          </button>
          <button
            aria-controls="build-controls-help"
            aria-expanded={controlsHelpOpen}
            aria-label="Show build controls"
            className="icon-button"
            data-tooltip="Help"
            onClick={() => setControlsHelpOpen((open) => !open)}
            type="button"
          >
            <img alt="" src={questionMarkIcon} />
          </button>
          {controlsHelpOpen && (
            <section aria-labelledby="build-controls-title" className="controls-help-popover" id="build-controls-help" role="dialog">
              <div className="controls-help-heading">
                <h2 id="build-controls-title">Build controls</h2>
                <button aria-label="Close build controls" onClick={() => setControlsHelpOpen(false)} type="button">×</button>
              </div>
              <h3>Mouse</h3>
              <ul>
                <li><strong>Click</strong><span>Place block</span></li>
                <li><strong>Double-click</strong><span>Select block</span></li>
                <li><strong>Right-click</strong><span>Remove block</span></li>
                <li><strong>Scroll</strong><span>Zoom in/out</span></li>
                <li><strong>Clear</strong><span>Remove every block; Undo restores them</span></li>
              </ul>

              <h3>Keyboard</h3>
              <ul>
                <li><strong>R</strong><span>Rotate repeater or comparator</span></li>
                <li><strong>M</strong><span>Change comparator mode</span></li>
                <li><strong>]</strong><span>Toggle editor sidebar</span></li>
              </ul>
            </section>
          )}
          <button aria-label="Undo" className="icon-button" data-flip="true" data-tooltip="Undo" disabled={manualEditLockState.locked} onClick={() => applyHistory("undo")} type="button">
            <RedoIcon />
          </button>
          <button aria-label="Redo" className="icon-button" data-tooltip="Redo" disabled={manualEditLockState.locked} onClick={() => applyHistory("redo")} type="button">
            <RedoIcon />
          </button>
          <button
            aria-controls="arena-editor-sidebar"
            aria-expanded={!sidebarCollapsed}
            aria-keyshortcuts="]"
            aria-label={sidebarCollapsed ? "Expand editor sidebar" : "Collapse editor sidebar"}
            className="icon-button sidebar-toggle"
            data-tooltip="Sidebar"
            onClick={toggleSidebar}
            type="button"
          >
            <SidebarToggleIcon />
          </button>
          <button className="open-3d-button" data-tooltip="Play" onClick={() => goToPlaySpace("place")} type="button">Open in 3D</button>
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
          <div className="viewport-chrome">
            <div className="viewport-status" hidden={!statusMessage} role="status" aria-live="polite">
              {statusMessage ? <strong>{statusMessage}</strong> : null}
            </div>
            <button
              aria-label="Clear all blocks"
              className="viewport-clear"
              data-tooltip="Clear"
              disabled={manualEditLockState.locked || summary.blockCount === 0}
              onClick={clearPlatform}
              type="button"
            >
              <img alt="" src={clearIcon} />
            </button>
          </div>
          <BlockPalette
            onOpenInventory={() => {
              setInventoryEntries(readInventory().entries);
              setInventoryOpen(true);
            }}
            onSelect={setSelectedBlock}
            selectedBlock={selectedBlock}
          />
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
                  <button disabled={manualEditLockState.locked} onClick={validateAndApplyJson} type="button">Validate and apply</button>
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
                    {objectGroups.length === 0 ? (
                      <p className="empty-state">No layers yet</p>
                    ) : (
                      <ul className="layers-list">
                        {objectGroups.map((group) => (
                          <li key={group.objectId}>
                            <span className="layer-name">{group.objectId}</span>
                            <span className="layer-meta">{group.block} × {group.count}</span>
                          </li>
                        ))}
                      </ul>
                    )}
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
                      disabled={manualEditLockState.locked}
                      max={MAX_PLATFORM_SIZE}
                      min={7}
                      onChange={resizePlatform}
                      value={platformSize}
                    />
                    <OddSlider
                      ariaLabel="Build height"
                      disabled={manualEditLockState.locked}
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
      {inventoryOpen && (
        <InventoryOverlay
          entries={inventoryEntries}
          onClose={() => setInventoryOpen(false)}
          onDelete={(id) => {
            const result = removeEntry(id);
            if (!result.ok) {
              setStatusMessage(result.error);
              return;
            }
            setInventoryEntries(readInventory().entries);
          }}
        />
      )}
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
  disabled,
  max,
  min,
  value,
  onChange,
}: {
  ariaLabel: string;
  disabled?: boolean;
  max: number;
  min: number;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <input
      aria-label={ariaLabel}
      className="odd-slider"
      disabled={disabled}
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

function cellAt(engine: ArenaEngine, coordinate: Coordinate) {
  return engine.queryBlocks({
    region: { min: coordinate, max: coordinate },
    limit: 1,
  }).blocks[0] ?? null;
}

function blockAt(engine: ArenaEngine, coordinate: Coordinate) {
  return cellAt(engine, coordinate)?.block ?? null;
}

function isInsideArena(coordinate: Coordinate, engine: ArenaEngine): boolean {
  const bounds = engine.getContext().bounds;
  return coordinate.x >= bounds.minX && coordinate.x <= bounds.maxX &&
    coordinate.y >= bounds.minY && coordinate.y <= bounds.maxY &&
    coordinate.z >= bounds.minZ && coordinate.z <= bounds.maxZ;
}
