import type { DashboardView } from '../../application/queries';
import { PLAN_RULES } from '../../domain/challenge/config';
import { Badge } from '../design-system/Badge';
import { DayStrip } from '../design-system/DayStrip';
import { EmptyState } from '../design-system/EmptyState';
import { LinkButton } from '../design-system/LinkButton';
import { Section } from '../design-system/Section';
import { formatDay, formatInr } from '../format';
import { ToneLabel } from '../semantics';

export function ChallengeView({ view }: { view: DashboardView }) {
  const c = view.current;
  if (c === null) {
    return (
      <EmptyState
        title="No active challenge"
        description="Past challenges are in History. Start a new one whenever you are ready."
        action={<LinkButton to="setup">Start a challenge</LinkButton>}
      />
    );
  }
  const rule = PLAN_RULES[c.config.planDays];
  const fullDaysStillNeeded = Math.max(0, c.requiredSuccessDays - c.successDays);

  return (
    <div className="flex flex-col gap-6">
      <Section
        title={`${String(c.planDays)}-day challenge`}
        aside={<Badge tone="muted">Locked</Badge>}
      >
        <p className="text-sm text-muted">
          {formatDay(c.startDay)} to {formatDay(c.endDay)}. {c.config.dailyTarget} problems a day,{' '}
          {rule.requiredSuccessDays} full days to pass, {rule.graceDays} grace days. Penalty starts
          at {formatInr(c.config.startPenaltyPaise)} and rises {formatInr(c.config.incrementPaise)}{' '}
          each penalized day.{' '}
          {c.config.countManual ? 'Manual entries count.' : 'Only verified solves count.'}
        </p>
        <DayStrip days={c.days} target={c.config.dailyTarget} />
        <p className="text-sm">
          {fullDaysStillNeeded === 0
            ? 'You have enough full days to pass.'
            : c.canStillPass
              ? `${String(fullDaysStillNeeded)} more full days needed in ${String(c.planDays - c.dayNumber + 1)} days left.`
              : 'Passing is no longer possible. Every day still counts.'}
        </p>
      </Section>

      <Section title="Day by day">
        <table className="w-full text-sm">
          <thead className="sr-only">
            <tr>
              <th>Day</th>
              <th>Date</th>
              <th>Solved</th>
              <th>Result</th>
              <th>Virtual penalty</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {c.days.map((d) => (
              <tr key={d.day} className={d.state === 'upcoming' ? 'text-muted' : ''}>
                <td className="py-2 pr-2 text-muted">{d.dayIndex + 1}</td>
                <td className="py-2 pr-2">{formatDay(d.day)}</td>
                <td className="py-2 pr-2">
                  {d.solved === null ? '' : `${String(d.solved)} / ${String(c.config.dailyTarget)}`}
                </td>
                <td className="py-2 pr-2">
                  {d.outcome !== null ? (
                    <ToneLabel tone={d.outcome} />
                  ) : d.state === 'today' ? (
                    <ToneLabel tone="TODAY" />
                  ) : null}
                </td>
                <td className="py-2 text-right">
                  {d.penaltyPaise !== null ? (
                    <span className={d.penaltyPaise > 0 ? 'text-danger' : 'text-muted'}>
                      {formatInr(d.penaltyPaise)}
                    </span>
                  ) : d.state === 'today' ? (
                    <span className="text-muted">{formatInr(c.projectedToday.penaltyPaise)}*</span>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-xs text-muted">* If today ended now.</p>
      </Section>
    </div>
  );
}
