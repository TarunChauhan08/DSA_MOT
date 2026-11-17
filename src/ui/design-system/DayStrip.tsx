import type { ChallengeDayView } from '../../application/queries';
import { formatDay } from '../format';
import { TONES, type DayTone } from '../semantics';

function toneOf(d: ChallengeDayView): DayTone {
  if (d.outcome !== null) return d.outcome;
  return d.state === 'today' ? 'TODAY' : 'UPCOMING';
}

/** One segment per challenge day in the shared colour code; today fills as you solve. */
export function DayStrip({ days, target }: { days: readonly ChallengeDayView[]; target: number }) {
  return (
    <ol className="flex gap-1" aria-label="Challenge days">
      {days.map((d) => {
        const tone = toneOf(d);
        const spec = TONES[tone];
        const todayShare = d.state === 'today' ? Math.min(1, (d.solved ?? 0) / target) : 1;
        const label = `Day ${String(d.dayIndex + 1)}, ${formatDay(d.day)}: ${spec.label}${d.solved === null ? '' : `, ${String(d.solved)} of ${String(target)}`}`;
        return (
          <li
            key={d.day}
            title={label}
            aria-label={label}
            className={`relative h-2.5 flex-1 overflow-hidden rounded-full bg-surface-raised ${d.state === 'today' ? 'outline-2 outline-offset-1 outline-violet' : ''}`}
          >
            {tone !== 'UPCOMING' && (
              <span
                className="absolute inset-y-0 left-0 rounded-full"
                style={{ width: `${String(todayShare * 100)}%`, background: spec.color }}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
