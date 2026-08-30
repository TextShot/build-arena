import type { Coordinate } from "../core/coordinates";

type CoordinateInspectorProps = Readonly<{
  coordinate: Coordinate | null;
  onChange: (coordinate: Coordinate) => void;
  onSelectCentre: () => void;
}>;

const AXES = [
  { key: "x", label: "X", min: -3, max: 3, help: "left and right" },
  { key: "y", label: "Y", min: 1, max: 6, help: "height" },
  { key: "z", label: "Z", min: -3, max: 3, help: "forward and back" },
] as const;

export function CoordinateInspector({
  coordinate,
  onChange,
  onSelectCentre,
}: CoordinateInspectorProps) {
  const updateAxis = (axis: "x" | "y" | "z", rawValue: string, min: number, max: number) => {
    const parsed = Number(rawValue);
    if (!Number.isSafeInteger(parsed)) return;
    const base = coordinate ?? { x: 0, y: 1, z: 0 };
    onChange({ ...base, [axis]: Math.max(min, Math.min(max, parsed)) });
  };

  return (
    <section className="control-section" aria-labelledby="coordinate-title">
      <div className="section-heading-row">
        <div>
          <p className="panel-kicker">Exact target</p>
          <h3 id="coordinate-title">Coordinate</h3>
        </div>
        <button className="text-button" onClick={onSelectCentre} type="button">Centre</button>
      </div>

      <div className="coordinate-grid">
        {AXES.map((axis) => (
          <label className="coordinate-field" key={axis.key}>
            <span>{axis.label}</span>
            <input
              aria-describedby={`${axis.key}-axis-help`}
              max={axis.max}
              min={axis.min}
              onChange={(event) => updateAxis(axis.key, event.target.value, axis.min, axis.max)}
              step={1}
              type="number"
              value={coordinate?.[axis.key] ?? ""}
            />
            <span className="sr-only" id={`${axis.key}-axis-help`}>{axis.help}</span>
          </label>
        ))}
      </div>
      <p className="coordinate-readout" aria-live="polite">
        {coordinate
          ? `Selected (${coordinate.x}, ${coordinate.y}, ${coordinate.z})`
          : "Select a platform cell or enter coordinates."}
      </p>
    </section>
  );
}
