export function PresetQuoteBoard({
  spot,
  onSelectTarget,
}: {
  spot: number;
  onSelectTarget: (target: number) => void;
}) {
  const presets = [0.95, 0.92, 0.9, 0.88].map((ratio) => Math.round(spot * ratio));
  return (
    <div className="preset-board">
      {presets.map((target) => (
        <button type="button" key={target} onClick={() => onSelectTarget(target)}>
          <span>Target</span>
          <strong>{target.toLocaleString('en-US')}</strong>
        </button>
      ))}
    </div>
  );
}
