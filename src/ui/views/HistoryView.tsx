import type { DashboardView } from '../../application/queries';
import { EmptyState } from '../design-system/EmptyState';
import { Section } from '../design-system/Section';
import { Stat } from '../design-system/Stat';
import { formatDay, formatInr, plural } from '../format';
import { StatusBadge } from './badges';

export function HistoryView({ view }: { view: DashboardView }) {
  if (!view.hasAnyChallenge) {
    return (
      <EmptyState
        title="No history yet"
        description="Challenges, streaks and your virtual penalty ledger build up as you practise."
      />
    );
  }
  const { streak } = view;
  return (
    <div className="flex flex-col gap-5">
      <Section title="All time">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
          <Stat label="Longest streak" value={plural(streak.longest, 'day')} />
          <Stat label="Full days" value={streak.successfulDays} />
          <Stat label="Problems solved" value={streak.totalSolved} />
          <Stat
            label="Virtual penalty"
            value={formatInr(view.lifetimePenaltyPaise)}
            hint="all challenges"
          />
        </dl>
      </Section>
      <Section title="Challenges">
        <ul className="flex flex-col divide-y divide-border">
          {view.challenges.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 py-2.5">
              <div className="flex flex-col">
                <span className="text-sm font-medium">
                  {c.planDays}-day · {c.dailyTarget}/day
                </span>
                <span className="text-xs text-muted">
                  {formatDay(c.startDay)} – {formatDay(c.endDay)} · {c.successDays}/
                  {c.requiredSuccessDays} full days · {formatInr(c.totalPenaltyPaise)}
                </span>
              </div>
              <StatusBadge status={c.status} />
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
