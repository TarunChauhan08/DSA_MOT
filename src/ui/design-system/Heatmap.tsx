import type { HeatCell } from '../../domain/analytics/heatmap';
import { formatDay } from '../format';

const LEVEL_FILL = [
  'var(--heat-0)',
  'var(--heat-1)',
  'var(--heat-2)',
  'var(--heat-3)',
  'var(--heat-4)',
] as const;
const WEEKDAY_LABELS = ['Mon', '', 'Wed', '', 'Fri', '', 'Sun'] as const;

function describe(c: HeatCell): string {
  if (c.future) return `${formatDay(c.day)}: upcoming`;
  if (!c.tracked) return `${formatDay(c.day)}: before tracking started`;
  return `${formatDay(c.day)}: ${String(c.solved)} solved${c.target === null ? '' : ` of ${String(c.target)}`}`;
}

/** Light → deep green by share of the day's target (owner decision). */
export function Heatmap({ weeks }: { weeks: readonly (readonly HeatCell[])[] }) {
  return (
    <figure className="flex flex-col gap-2">
      <div className="flex gap-[3px]" role="grid" aria-label="Daily practice heatmap">
        <div className="mr-1 flex flex-col gap-[3px]" aria-hidden="true">
          {WEEKDAY_LABELS.map((l, i) => (
            <span key={i} className="h-3 text-[10px] leading-3 text-muted">
              {l}
            </span>
          ))}
        </div>
        {weeks.map((week) => (
          <div key={week[0]?.day} className="flex flex-col gap-[3px]" role="row">
            {week.map((c) => (
              <span
                key={c.day}
                role="gridcell"
                title={describe(c)}
                aria-label={describe(c)}
                className={`size-3 rounded-[3px] ${c.today ? 'outline-[1.5px] outline-offset-1 outline-violet' : ''} `}
                style={{
                  background: c.tracked || c.future ? LEVEL_FILL[c.level] : 'transparent',
                  boxShadow: c.tracked || c.future ? undefined : 'inset 0 0 0 1px var(--border)',
                }}
              />
            ))}
          </div>
        ))}
      </div>
      <figcaption className="flex items-center gap-1.5 text-[11px] text-muted">
        Fewer
        {LEVEL_FILL.map((fill) => (
          <span key={fill} className="size-2.5 rounded-[2px]" style={{ background: fill }} />
        ))}
        More of your target
      </figcaption>
    </figure>
  );
}
