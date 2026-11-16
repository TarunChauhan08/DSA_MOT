import type { DashboardView } from '../../application/queries';
import { PLAN_RULES } from '../../domain/challenge/config';
import { Badge } from '../design-system/Badge';
import { EmptyState } from '../design-system/EmptyState';
import { LinkButton } from '../design-system/LinkButton';
import { Section } from '../design-system/Section';
import { formatDay, formatInr } from '../format';
import { OutcomeBadge } from './badges';

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

  return (
    <div className="flex flex-col gap-5">
      <Section
        title={`${String(c.planDays)}-day challenge`}
        aside={<Badge tone="muted">Locked</Badge>}
      >
        <p className="text-sm text-muted">
          {formatDay(c.startDay)} – {formatDay(c.endDay)} · {c.config.dailyTarget} problems a day ·{' '}
          {rule.requiredSuccessDays} full days to pass · {rule.graceDays} grace days · penalty{' '}
          {formatInr(c.config.startPenaltyPaise)} +{formatInr(c.config.incrementPaise)} ·{' '}
          {c.config.countManual ? 'manual entries count' : 'verified solves only'}
        </p>
      </Section>

      <Section title="Days">
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
                <td className="py-2 pr-2 tabular-nums">{d.dayIndex + 1}</td>
                <td className="py-2 pr-2">{formatDay(d.day)}</td>
                <td className="py-2 pr-2 tabular-nums">
                  {d.solved === null
                    ? '—'
                    : `${String(d.solved)} / ${String(c.config.dailyTarget)}`}
                </td>
                <td className="py-2 pr-2">
                  {d.outcome !== null ? (
                    <OutcomeBadge outcome={d.outcome} />
                  ) : d.state === 'today' ? (
                    <Badge tone="info">Today</Badge>
                  ) : null}
                </td>
                <td className="py-2 text-right tabular-nums">
                  {d.penaltyPaise !== null
                    ? formatInr(d.penaltyPaise)
                    : d.state === 'today'
                      ? `${formatInr(c.projectedToday.penaltyPaise)}*`
                      : '—'}
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
