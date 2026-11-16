interface ProgressBarProps {
  value: number;
  max: number;
  label: string;
}

export function ProgressBar({ value, max, label }: ProgressBarProps) {
  const percent = max <= 0 ? 0 : Math.min(100, Math.round((value / max) * 100));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.min(value, max)}
      className="h-2 w-full overflow-hidden rounded-full bg-surface-raised"
    >
      <div
        className="h-full rounded-full bg-accent transition-[width] duration-500 ease-out motion-reduce:transition-none"
        style={{ width: `${String(percent)}%` }}
      />
    </div>
  );
}
