import { useCallback, useEffect, useRef, useState } from "react";

import type { ArenaResult, BlockEdit, BuildSummary } from "../core/arena-engine";
import { PHASE_A_BLOCK_IDS } from "../core/block-types";
import type { Coordinate } from "../core/coordinates";
import { createArenaEngine } from "../core/arena-world";
import { ArenaRenderer } from "../render/three-renderer";
import { type CameraPreset, type SidebarPanel, useUiStore } from "../state/ui-store";
import { ArenaControls } from "./ArenaControls";
import { BlockPalette } from "./BlockPalette";
import { CoordinateInspector } from "./CoordinateInspector";
import { HistoryControls } from "./HistoryControls";
import { ValidationPanel, type ValidationNotice } from "./ValidationPanel";

type ActivityEntry = Readonly<{
  id: number;
  message: string;
}>;

const CAMERA_PRESETS: readonly CameraPreset[] = ["iso", "top", "front", "right"];
const SIDEBAR_PANELS: readonly SidebarPanel[] = ["controls", "layers", "json", "activity"];

export function BuildArenaPage() {
  const [engine] = useState(() => createArenaEngine());
  const [summary, setSummary] = useState<BuildSummary>(() => engine.getSummary());
  const [notice, setNotice] = useState<ValidationNotice>({
    tone: "neutral",
    message: "Select a cell, choose a block, then apply one bounded edit.",
  });
  const [activity, setActivity] = useState<readonly ActivityEntry[]>([
    { id: 0, message: "Arena ready at revision 0." },
  ]);
  const nextActivityId = useRef(1);
  const rendererHost = useRef<HTMLDivElement>(null);
  const rendererInstance = useRef<ArenaRenderer | null>(null);

  const selectedBlock = useUiStore((state) => state.selectedBlock);
  const selectedCoordinate = useUiStore((state) => state.selectedCoordinate);
  const cameraPreset = useUiStore((state) => state.cameraPreset);
  const sidebarCollapsed = useUiStore((state) => state.sidebarCollapsed);
  const activeSidebarPanel = useUiStore((state) => state.activeSidebarPanel);
  const setSelectedBlock = useUiStore((state) => state.setSelectedBlock);
  const setSelectedCoordinate = useUiStore((state) => state.setSelectedCoordinate);
  const setCameraPreset = useUiStore((state) => state.setCameraPreset);
  const setSidebarCollapsed = useUiStore((state) => state.setSidebarCollapsed);
  const setActiveSidebarPanel = useUiStore((state) => state.setActiveSidebarPanel);

  const addActivity = useCallback((message: string) => {
    const entry = { id: nextActivityId.current, message };
    nextActivityId.current += 1;
    setActivity((current) => [entry, ...current].slice(0, 30));
  }, []);

  useEffect(() => engine.subscribe((change) => {
    setSummary(engine.getSummary());
    addActivity(`${formatCommand(change.commandType)} committed ${change.affectedBlocks} block${change.affectedBlocks === 1 ? "" : "s"}; revision ${change.revision}.`);
  }), [addActivity, engine]);

  useEffect(() => {
    const host = rendererHost.current;
    if (!host) return;
    const arenaRenderer = new ArenaRenderer(host, engine, {
      onSelect: (coordinate) => useUiStore.getState().setSelectedCoordinate(coordinate),
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

  const handleResult = (result: ArenaResult, action: string) => {
    setSummary(engine.getSummary());
    if (result.success) {
      const changed = result.affectedBlocks > 0;
      setNotice({
        tone: changed ? "success" : "neutral",
        message: changed
          ? `${action} changed ${result.affectedBlocks} block${result.affectedBlocks === 1 ? "" : "s"}.`
          : `${action} was a valid no-op; revision remains ${result.revision}.`,
      });
      if (!changed) addActivity(`${action} completed with no world change.`);
      return;
    }
    const location = result.fieldPath ? ` (${result.fieldPath})` : "";
    setNotice({ tone: "error", message: `${result.error}${location}` });
    addActivity(`${action} rejected: ${result.error}${location}.`);
  };

  const applyEdit = (action: BlockEdit["action"]) => {
    if (!selectedCoordinate) {
      setNotice({ tone: "error", message: "Select a coordinate before editing." });
      return;
    }
    const edit: BlockEdit = action === "remove"
      ? { action, position: selectedCoordinate }
      : { action, position: selectedCoordinate, block: selectedBlock };
    const result = engine.apply({
      type: "set_blocks",
      expectedRevision: engine.getContext().revision,
      edits: [edit],
    });
    handleResult(result, formatCommand(action));
  };

  const applyHistory = (type: "undo" | "redo") => {
    const result = engine.apply({ type, expectedRevision: engine.getContext().revision });
    handleResult(result, formatCommand(type));
  };

  const currentBlocks = engine.queryBlocks({ limit: 500 }).blocks;

  return (
    <div className="arena-app-shell">
      <a className="skip-link" href="#arena-workspace">Skip to Build Arena</a>

      <header className="arena-topbar">
        <div className="brand-lockup">
          <p className="eyebrow">Minecraft-inspired voxel workspace</p>
          <h1>Build Arena</h1>
        </div>
        <nav className="product-tabs" aria-label="Workspace">
          <button aria-current="page" type="button">Build Arena</button>
          <button disabled type="button">Game <span>Later</span></button>
        </nav>
        <div className="topbar-actions">
          <p className="revision-badge" role="status">Revision {summary.revision}</p>
          <button disabled title="Blueprint export arrives in Phase 4" type="button">Export later</button>
          <button
            aria-controls="arena-editor-sidebar"
            aria-expanded={!sidebarCollapsed}
            aria-label={sidebarCollapsed ? "Expand editor sidebar" : "Collapse editor sidebar"}
            className="sidebar-toggle"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
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
          <div className="viewport-status">
            <span>Protected platform: 7×7</span>
            <strong>
              {selectedCoordinate
                ? `(${selectedCoordinate.x}, ${selectedCoordinate.y}, ${selectedCoordinate.z})`
                : "No coordinate selected"}
            </strong>
          </div>
          <BlockPalette selectedBlock={selectedBlock} onSelect={setSelectedBlock} />
        </section>

        <aside
          className="arena-sidebar"
          data-collapsed={sidebarCollapsed}
          hidden={sidebarCollapsed}
          id="arena-editor-sidebar"
        >
          <div className="sidebar-header">
            <div>
              <p className="panel-kicker">Editor tools</p>
              <h2>Build controls</h2>
            </div>
          </div>

          {!sidebarCollapsed && (
            <>
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
                {activeSidebarPanel === "controls" && (
                  <>
                    <CoordinateInspector
                      coordinate={selectedCoordinate}
                      onChange={setSelectedCoordinate}
                      onSelectCentre={() => setSelectedCoordinate({ x: 0, y: 1, z: 0 })}
                    />
                    <ArenaControls
                      disabled={!selectedCoordinate}
                      onPlace={() => applyEdit("place")}
                      onRemove={() => applyEdit("remove")}
                      onReplace={() => applyEdit("replace")}
                    />
                    <HistoryControls
                      onRedo={() => applyHistory("redo")}
                      onUndo={() => applyHistory("undo")}
                    />
                    <ValidationPanel notice={notice} />
                  </>
                )}

                {activeSidebarPanel === "layers" && (
                  <section aria-labelledby="summary-title">
                    <p className="panel-kicker">Live engine read</p>
                    <h3 id="summary-title">Build summary</h3>
                    <p className="summary-total">{summary.blockCount} placed blocks</p>
                    <ul className="material-counts">
                      {PHASE_A_BLOCK_IDS.map((blockId) => (
                        <li key={blockId}><span>{blockId.replaceAll("_", " ")}</span><strong>{summary.counts[blockId]}</strong></li>
                      ))}
                    </ul>
                  </section>
                )}

                {activeSidebarPanel === "json" && (
                  <section aria-labelledby="json-title">
                    <p className="panel-kicker">Read-only preview</p>
                    <h3 id="json-title">Current build JSON</h3>
                    <p className="control-hint">Versioned blueprint import/export arrives in Phase 4.</p>
                    <pre className="json-preview">{JSON.stringify({ revision: summary.revision, blocks: currentBlocks }, null, 2)}</pre>
                  </section>
                )}

                {activeSidebarPanel === "activity" && (
                  <section aria-labelledby="activity-title">
                    <p className="panel-kicker">Engine events</p>
                    <h3 id="activity-title">Activity</h3>
                    <ol className="activity-list">
                      {activity.map((entry) => <li key={entry.id}>{entry.message}</li>)}
                    </ol>
                  </section>
                )}
              </div>
            </>
          )}
        </aside>
      </main>
    </div>
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

function capitalize(value: string): string {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

function formatCommand(value: string): string {
  return value.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase());
}
