type HistoryControlsProps = Readonly<{
  onUndo: () => void;
  onRedo: () => void;
}>;

export function HistoryControls({ onUndo, onRedo }: HistoryControlsProps) {
  return (
    <section className="control-section" aria-labelledby="history-title">
      <p className="panel-kicker">Revisioned history</p>
      <h3 id="history-title">History</h3>
      <div className="action-grid two-columns">
        <button onClick={onUndo} type="button">Undo latest</button>
        <button onClick={onRedo} type="button">Redo</button>
      </div>
    </section>
  );
}
