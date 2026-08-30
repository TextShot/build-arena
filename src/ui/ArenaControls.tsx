type ArenaControlsProps = Readonly<{
  disabled: boolean;
  onPlace: () => void;
  onReplace: () => void;
  onRemove: () => void;
}>;

export function ArenaControls({ disabled, onPlace, onReplace, onRemove }: ArenaControlsProps) {
  return (
    <section className="control-section" aria-labelledby="edit-actions-title">
      <p className="panel-kicker">Atomic edit</p>
      <h3 id="edit-actions-title">Block action</h3>
      <div className="action-grid">
        <button className="primary-action" disabled={disabled} onClick={onPlace} type="button">
          Place
        </button>
        <button disabled={disabled} onClick={onReplace} type="button">Replace</button>
        <button className="danger-action" disabled={disabled} onClick={onRemove} type="button">
          Remove
        </button>
      </div>
      <p className="control-hint">Place requires air; replace requires an existing block.</p>
    </section>
  );
}
