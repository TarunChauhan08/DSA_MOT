import type { Urgency } from '../../domain/analytics/nudges';
import { CheckGlyph } from './glyphs';

const URGENCY_STROKE: Record<Urgency, string> = {
  done: 'var(--accent)',
  calm: 'var(--violet)',
  'heads-up': 'var(--warning)',
  urgent: 'var(--danger)',
};

interface DayRingProps {
  solved: number;
  target: number;
  urgency: Urgency;
  size?: number;
}

/**
 * Today's progress. Fill = share of the target; colour = time pressure
 * (violet calm → amber after 18:00 → rose in the last two hours → emerald when met).
 */
export function DayRing({ solved, target, urgency, size = 132 }: DayRingProps) {
  const stroke = Math.round(size * 0.085);
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const share = Math.min(1, target <= 0 ? 0 : solved / target);
  const met = urgency === 'done';
  return (
    <div
      className={`relative shrink-0 ${met ? 'ring-settle' : ''}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${String(solved)} of ${String(target)} problems solved today`}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${String(size)} ${String(size)}`}
        className="-rotate-90"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--surface-raised)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={URGENCY_STROKE[urgency]}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${String(circumference * share)} ${String(circumference)}`}
          className="transition-[stroke-dasharray] duration-700 ease-out motion-reduce:transition-none"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span
          className="display-condensed"
          style={{ fontSize: size * 0.36 }}
          data-testid="ring-solved"
        >
          {solved}
        </span>
        <span className="mt-1 text-[13px] text-muted">
          {met ? (
            <span className="inline-flex items-center gap-1 text-accent">
              <CheckGlyph /> of {target}
            </span>
          ) : (
            `of ${String(target)}`
          )}
        </span>
      </div>
    </div>
  );
}
