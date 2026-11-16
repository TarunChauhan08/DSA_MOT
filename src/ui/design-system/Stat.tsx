import type { ReactNode } from 'react';

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="text-base font-semibold tabular-nums">{value}</dd>
      {hint !== undefined && <dd className="text-xs text-muted">{hint}</dd>}
    </div>
  );
}
