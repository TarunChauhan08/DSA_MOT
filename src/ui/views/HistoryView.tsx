import type { DashboardView } from '../../application/queries';
import { heatmapWeeks } from '../../domain/analytics/heatmap';
import type { CompletionRate } from '../../domain/analytics/rates';
import { EmptyState } from '../design-system/EmptyState';
import { Heatmap } from '../design-system/Heatmap';
import { Section } from '../design-system/Section';
import { Stat } from '../design-system/Stat';
import { TrendBars } from '../design-system/TrendBars';
import { formatDay, formatInr, plural } from '../format';
import { StatusBadge } from './badges';

const HEATMAP_WEEKS = 18;

function RateBar({ label, rate }: { label: string; rate: CompletionRate }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between text-sm">
        <span>{label}</span>
        <span className="font-semibold">
          {rate.percent === null ? 'No data yet' : `${String(rate.percent)}%`}
          {rate.percent !== null && (
            <span className="ml-1.5 text-xs font-normal text-muted">
              {rate.successDays} of {plural(rate.eligibleDays, 'day')}
            </span>
          )}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface-raised">
        <div
          className="h-full rounded-full bg-accent"
          style={{ width: `${String(rate.percent ?? 0)}%` }}
        />
      </div>
    </div>
  );
}

export function HistoryView({ view }: { view: DashboardView }) {
  if (!view.hasAnyChallenge) {
    return (
      <EmptyState
        title="No history yet"
        description="Your heatmap, streaks and virtual penalty ledger build up as you practise."
      />
    );
  }
  const { streak, penalty } = view;
  return (
    <div className="flex flex-col gap-6">
      <Section title="Practice">
        <Heatmap weeks={heatmapWeeks(view.history, view.today, HEATMAP_WEEKS)} />
        <dl className="grid grid-cols-3 gap-x-4 gap-y-3">
          <Stat label="Current streak" value={plural(streak.current, 'day')} />
          <Stat label="Longest streak" value={plural(streak.longest, 'day')} />
          <Stat label="Problems solved" value={streak.totalSolved} />
          <Stat label="Full days" value={streak.successfulDays} />
          <Stat label="Incomplete days" value={streak.incompleteDays} />
        </dl>
      </Section>

      <Section title="Completion rate">
        <RateBar label="Last 7 days" rate={view.rates.week} />
        <RateBar label="Last 30 days" rate={view.rates.month} />
      </Section>

      <Section title="Virtual penalty">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
          <Stat
            label="All challenges"
            value={
              <span className={penalty.totalPaise > 0 ? 'text-danger' : ''}>
                {formatInr(penalty.totalPaise)}
              </span>
            }
          />
          <Stat label="Highest day" value={formatInr(penalty.highestPaise)} />
          <Stat label="Average per challenge day" value={formatInr(penalty.averagePerDayPaise)} />
          <Stat
            label="Average per penalized day"
            value={formatInr(penalty.averagePerPenalizedDayPaise)}
          />
        </dl>
        {view.penaltyTrend.length > 0 && <TrendBars points={view.penaltyTrend} />}
      </Section>

      <Section title="Penalty ledger">
        {view.ledger.length === 0 ? (
          <p className="text-sm text-muted">No virtual penalties so far.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {view.ledger.map((l) => (
              <li
                key={`${l.challengeId}|${l.day}`}
                className="flex items-center justify-between gap-3 py-2 text-sm"
              >
                <span>
                  {formatDay(l.day)}
                  <span className="ml-2 text-xs text-muted">{l.planDays}-day challenge</span>
                </span>
                <span className="text-right">
                  {l.previousPenaltyPaise !== null && (
                    <span className="mr-2 text-xs text-muted line-through">
                      {formatInr(l.previousPenaltyPaise)}
                    </span>
                  )}
                  <span className={l.penaltyPaise > 0 ? 'font-medium text-danger' : 'text-muted'}>
                    {formatInr(l.penaltyPaise)}
                  </span>
                  {l.previousPenaltyPaise !== null && (
                    <span className="block text-[11px] text-muted">revised by a late solve</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Challenges">
        <ul className="flex flex-col divide-y divide-border">
          {view.challenges.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 py-2.5">
              <div className="flex flex-col">
                <span className="text-sm font-medium">
                  {c.planDays}-day, {c.dailyTarget}/day
                </span>
                <span className="text-xs text-muted">
                  {formatDay(c.startDay)} to {formatDay(c.endDay)}. {c.successDays}/
                  {c.requiredSuccessDays} full days, {formatInr(c.totalPenaltyPaise)}
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
