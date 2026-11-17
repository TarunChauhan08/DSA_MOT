import type { TrendPoint } from '../../application/queries';
import { formatDay, formatInr } from '../format';
import { TONES } from '../semantics';

/** Virtual penalty per evaluated day; bar colour = day outcome. */
export function TrendBars({
  points,
  height = 56,
}: {
  points: readonly TrendPoint[];
  height?: number;
}) {
  const max = Math.max(...points.map((p) => p.penaltyPaise), 1);
  return (
    <div
      className="flex items-end gap-[3px]"
      style={{ height }}
      role="img"
      aria-label={`Virtual penalty over the last ${String(points.length)} challenge days, highest ${formatInr(max)}`}
    >
      {points.map((p) => {
        const h =
          p.penaltyPaise === 0 ? 2 : Math.max(4, Math.round((p.penaltyPaise / max) * height));
        return (
          <span
            key={p.day}
            title={`${formatDay(p.day)}: ${TONES[p.outcome].label}, ${formatInr(p.penaltyPaise)}`}
            className="flex-1 rounded-t-[2px]"
            style={{
              height: h,
              background: p.penaltyPaise === 0 ? 'var(--border)' : TONES[p.outcome].color,
              maxWidth: 12,
            }}
          />
        );
      })}
    </div>
  );
}
