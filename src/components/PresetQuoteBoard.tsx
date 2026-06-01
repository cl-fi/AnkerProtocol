export function PresetQuoteBoard({
  spot,
  onSelectTarget,
}: {
  spot: number;
  onSelectTarget: (target: number) => void;
}) {
  const presets = [1.03, 1.02, 1.01, 1.005].map((ratio) => Math.round(spot * ratio));
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
