import type { DashboardView } from '../../application/queries';
import { Countdown } from '../design-system/Countdown';
import { DayRing } from '../design-system/DayRing';
import { FlameGlyph } from '../design-system/glyphs';
import { streakLabel } from '../format';
import { todayCopy } from './todayCopy';

/** Ring + the one sentence that matters right now. Shared by the side panel and the popup. */
export function TodayHero({ view, compact = false }: { view: DashboardView; compact?: boolean }) {
  const copy = todayCopy(view);
  const target = view.todayTarget;
  const streak = view.streak.current;
  const met = view.urgency === 'done';
  return (
    <div className="flex items-center gap-4">
      {target !== null && (
        <DayRing
          solved={view.todaySolved}
          target={target}
          urgency={view.urgency}
          size={compact ? 96 : 132}
        />
      )}
      <div className="flex min-w-0 flex-col gap-1.5">
        <p className={`font-semibold tracking-tight ${compact ? 'text-lg' : 'text-xl'}`}>
          {copy.headline}
        </p>
        <p className="text-sm text-muted">{copy.detail}</p>
        <div className="flex flex-wrap items-center gap-2 pt-0.5">
          {target !== null && <Countdown msLeft={view.msLeftToday} urgency={view.urgency} />}
          <span
            className={`inline-flex items-center gap-1 text-[13px] font-medium ${streak === 0 ? 'text-muted' : met ? 'text-accent' : 'text-warning'}`}
            title={copy.streakWarning ?? undefined}
          >
            <FlameGlyph />
            {streak === 0 ? 'No streak yet' : streakLabel(streak)}
          </span>
        </div>
        {copy.streakWarning !== null && (
          <p className="text-[13px] font-medium text-warning">{copy.streakWarning}</p>
        )}
      </div>
    </div>
  );
}
